/**
 * Smoke hermético do sandbox: exercita a tool `send_message` contra um fetch
 * stub FIEL ao contrato do handler real (src/app/api/v1/messages/route.ts) para
 * uma chave `bz_sandbox_`. Não toca rede nem credencial real.
 *
 * O que se garante aqui (o que um smoke contra o sandbox real também garantiria,
 * mas sem depender de credencial em CI):
 *  - o texto do agente (acento + emoji) sobrevive intacto ao pipeline
 *    JSON → zod → SDK → fetch (nada de mangling de UTF-8);
 *  - a chave sandbox vira `Authorization: Bearer <chave>` (nunca X-API-Key);
 *  - a resposta do sandbox (`sandbox: true` + `wamid.sandbox.<random>`) chega ao
 *    resultado da tool;
 *  - a chave de API NUNCA aparece em nenhum texto do resultado.
 *
 * Contrato do sandbox (do handler real, POST /v1/messages com chave sandbox):
 * responde 201 com o objeto DIRETO { id, wamid: "wamid.sandbox.<hex>", to,
 * status: "sent", sandbox: true } — sem envelope { data }, sem billable/pricing
 * (esses só existem no ciclo simulado interno, não na resposta do POST).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";

const API_KEY = "bz_sandbox_test-key";
const BASE_URL = "https://sandbox.test/v1";
/** Destinatário mágico de happy path (janela sempre aberta). */
const MAGIC_TO = "+5500000000001";
/** Texto com acento + emoji — precisa sobreviver byte a byte. */
const UNICODE_BODY = "Olá, tudo bem? 😀";

interface Captured {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: unknown;
}

const calls: Captured[] = [];

/** wamid sintético no formato do handler real (`wamid.sandbox.<hex>`). */
function sandboxWamid(): string {
  return `wamid.sandbox.${"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"}`;
}

/**
 * fetch stub fiel ao contrato sandbox: grava o request e responde 201 com o
 * objeto direto do handler real. NÃO inventa campos (billable/pricing não vêm
 * na resposta do POST).
 */
const fetchStub = (async (input: unknown, init?: RequestInit) => {
  const rawUrl = typeof input === "string" ? input : String(input);
  const url = new URL(rawUrl);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = (init?.headers ?? {}) as Record<string, string>;
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, headers, body });

  if (method === "POST" && url.pathname.endsWith("/messages")) {
    return new Response(
      JSON.stringify({
        id: "b1e6a0f2-0000-4000-8000-000000000001",
        wamid: sandboxWamid(),
        to: body?.to ?? "",
        status: "sent",
        sandbox: true,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  }

  // Nenhuma outra rota é exercida por este smoke.
  return new Response(JSON.stringify({ data: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as unknown as typeof fetch;

async function connect(): Promise<Client> {
  const server = buildServer({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchStub });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "sandbox-smoke-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.[0]?.text ?? "";
}

type ToolResult = { content: Array<{ type: string; text?: string }>; isError?: boolean };

describe("smoke hermético do sandbox — send_message (fetch stub fiel)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("texto: acento + emoji intactos, Bearer da chave sandbox, resposta sandbox, chave não vaza", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "send_message",
      arguments: { to: MAGIC_TO, type: "text", text: { body: UNICODE_BODY } },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();

    const sent = calls.find(
      (c) => c.method === "POST" && c.url.pathname.endsWith("/messages"),
    );
    expect(sent).toBeDefined();
    // O corpo do texto chega INTACTO (acento + emoji) após JSON → zod → SDK → fetch.
    expect(sent!.body).toMatchObject({
      to: MAGIC_TO,
      type: "text",
      text: { body: UNICODE_BODY },
    });
    // Chave sandbox autenticada por Bearer (nunca X-API-Key).
    expect(sent!.headers.Authorization).toBe(`Bearer ${API_KEY}`);

    const text = textOf(result);
    const payload = JSON.parse(text);
    // Resposta do sandbox chega ao agente: sandbox:true + wamid sintético.
    expect(payload.sandbox).toBe(true);
    expect(typeof payload.wamid).toBe("string");
    expect(payload.wamid.startsWith("wamid.sandbox.")).toBe(true);
    expect(payload.status).toBe("sent");
    // Contrato: resposta direta, sem envelope { data }.
    expect(payload.data).toBeUndefined();
    // A chave de API NUNCA aparece em nenhum texto do resultado.
    expect(text).not.toContain(API_KEY);
  });

  it("template: nome livre aceito no sandbox, resposta sandbox, chave não vaza", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "send_message",
      arguments: {
        to: MAGIC_TO,
        type: "template",
        template: { name: "qualquer_template", language: { code: "pt_BR" } },
      },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();

    const sent = calls.find(
      (c) => c.method === "POST" && c.url.pathname.endsWith("/messages"),
    );
    expect(sent).toBeDefined();
    expect(sent!.body).toMatchObject({
      to: MAGIC_TO,
      type: "template",
      template: { name: "qualquer_template", language: { code: "pt_BR" } },
    });
    expect(sent!.headers.Authorization).toBe(`Bearer ${API_KEY}`);

    const text = textOf(result);
    const payload = JSON.parse(text);
    expect(payload.sandbox).toBe(true);
    expect(payload.wamid.startsWith("wamid.sandbox.")).toBe(true);
    expect(text).not.toContain(API_KEY);
  });
});
