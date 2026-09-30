import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startStreamableHttpServer, type RunningStreamableHttpServer } from "../src/http.js";
import type { ApiIdentity } from "../src/server.js";

/**
 * #629: em produção, o ChatGPT abriu sessões MCP novas com frequência — 14
 * chamadas a `/v1/me` para 8 chamadas de tools — porque cada `initialize` sem
 * sessão prévia introspectava do zero, mesmo quando outra sessão já tinha
 * validado a MESMA credencial há poucos segundos. Este arquivo cobre o cache
 * de identidade COMPARTILHADO entre sessões do mesmo processo (`http.ts`),
 * distinto do cache por sessão (`resolveSessionIdentity`, já coberto em
 * `oauth-http.test.ts`).
 *
 * Cada teste usa credenciais únicas (`randomUUID`) para nunca reaproveitar uma
 * entrada de cache de um teste anterior no mesmo processo Vitest.
 */

const servers: RunningStreamableHttpServer[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

type Principal = Pick<ApiIdentity, "account_id" | "environment" | "scopes">;

function principalFor(token: string): Principal {
  return { account_id: `account-${token}`, environment: "live", scopes: ["contacts:read"] };
}

/** Servidor MCP remoto com um fetch fake: cada credencial em `accounts` tem
 * sua própria Conta; `failFor` simula introspecção falhando para tokens dados
 * (uma vez cada, consumido do set — usado para provar que falha não é cacheada). */
async function remote(accounts: ReadonlySet<string>, failFor: Set<string> = new Set()) {
  const calls: { token: string; path: string }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = new Headers(init?.headers).get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const path = new URL(String(input)).pathname;
    calls.push({ token, path });
    if (path === "/v1/me") {
      if (failFor.has(token)) {
        failFor.delete(token);
        return Response.json({ error: { code: "unauthorized", message: "boom" } }, { status: 401 });
      }
      if (!accounts.has(token)) {
        return Response.json({ error: { code: "unauthorized", message: "Revoked." } }, { status: 401 });
      }
      return Response.json({ data: principalFor(token) });
    }
    return Response.json({ data: {} });
  });
  const server = await startStreamableHttpServer({
    baseUrl: "https://api.test/v1",
    fetch,
    eventSignal: { subscribe: () => () => {} },
  });
  servers.push(server);
  return { server, calls, fetch };
}

async function initialize(server: RunningStreamableHttpServer, token: string): Promise<Response> {
  return fetch(server.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Protocol-Version": "2025-03-26",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "process-cache-test", version: "1" } },
    }),
  });
}

function meReads(calls: { token: string; path: string }[]): number {
  return calls.filter((c) => c.path === "/v1/me").length;
}

describe("cache de identidade compartilhado entre sessões (processo)", () => {
  it("N sessões novas com a mesma credencial dentro de 60s fazem 1 chamada a /v1/me", async () => {
    const token = `bz_live_${randomUUID()}`;
    const { server, calls } = await remote(new Set([token]));

    for (let i = 0; i < 5; i++) {
      const response = await initialize(server, token);
      expect(response.status).toBe(200);
    }

    expect(meReads(calls)).toBe(1);
  });

  it("credencial diferente sempre faz sua própria chamada", async () => {
    const tokenA = `bz_live_${randomUUID()}`;
    const tokenB = `bz_live_${randomUUID()}`;
    const { server, calls } = await remote(new Set([tokenA, tokenB]));

    await initialize(server, tokenA);
    await initialize(server, tokenA);
    await initialize(server, tokenB);
    await initialize(server, tokenB);

    expect(meReads(calls)).toBe(2);
    const meCallTokens = calls.filter((c) => c.path === "/v1/me").map((c) => c.token).sort();
    expect(meCallTokens).toEqual([tokenA, tokenB].sort());
  });

  it("expira depois do TTL de 60s e faz nova chamada", async () => {
    const token = `bz_live_${randomUUID()}`;
    const { server, calls } = await remote(new Set([token]));

    await initialize(server, token);
    await initialize(server, token);
    expect(meReads(calls)).toBe(1);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_001);
    await initialize(server, token);
    expect(meReads(calls)).toBe(2);
  });

  it("requisições concorrentes da mesma credencial deduplicam numa única introspecção", async () => {
    const token = `bz_live_${randomUUID()}`;
    const { server, calls } = await remote(new Set([token]));

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => initialize(server, token)),
    );
    for (const response of responses) expect(response.status).toBe(200);

    expect(meReads(calls)).toBe(1);
  });

  it("não cacheia falha de introspecção — cada tentativa malsucedida chama a API de novo", async () => {
    const token = `bz_live_${randomUUID()}`;
    // `failFor` é consumido por chamada (Set.delete no fake fetch): uma
    // instância só cobre uma falha, então recriamos o set achando o token
    // "ainda falhando" nas duas primeiras tentativas.
    const failing = new Set([token]);
    const { server, calls } = await remote(new Set([token]), failing);

    const first = await initialize(server, token);
    expect(first.status).toBe(401); // sem sessão prévia: introspecção falhou

    failing.add(token); // a próxima tentativa também deve falhar de verdade
    const second = await initialize(server, token);
    expect(second.status).toBe(401);
    expect(meReads(calls)).toBe(2); // nenhuma das duas falhas foi cacheada

    const third = await initialize(server, token);
    expect(third.status).toBe(200); // token não está mais em `failing` → sucesso
    expect(meReads(calls)).toBe(3);

    const fourth = await initialize(server, token);
    expect(fourth.status).toBe(200);
    expect(meReads(calls)).toBe(3); // sucesso anterior agora cacheado normalmente
  });
});
