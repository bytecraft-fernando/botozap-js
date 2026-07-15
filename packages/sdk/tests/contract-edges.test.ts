/**
 * Testes de BORDA do contrato do SDK `@botozap/sdk` (item 6 do E0.3).
 *
 * Diferente de `contract.test.ts` (servidor HTTP real exercitando o happy path
 * de cada rota), aqui o alvo é o comportamento do CLIENTE nas bordas — o que
 * acontece quando o transporte ou o envelope saem do contrato:
 *   1. baseUrl PADRÃO quando ninguém passa `baseUrl`.
 *   2. `fetch` REJEITA (erro de rede / TypeError) — não pode vazar cru nem travar.
 *   3. 5xx com corpo NÃO-JSON (text/html) — não pode estourar JSON.parse.
 *   4. 200 sem envelope `{ data }` num endpoint de ITEM — não pode devolver
 *      `undefined` silencioso.
 *
 * Estratégia de fetch: os testes 1 e 2 STUBAM `globalThis.fetch` (o cliente
 * resolve `options.fetch ?? globalThis.fetch` no construtor, então stub ANTES
 * de `new BotoZap`); 3 e 4 INJETAM um fetch fake via `options.fetch` devolvendo
 * um `Response` controlado. Nenhum request de rede real acontece.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotoZap, BotoZapError } from "../src/index.js";

const API_KEY = "bz_live_edge_test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SDK contract — bordas de transporte e envelope", () => {
  it("baseUrl padrão: cliente SEM baseUrl chama https://botozap.com.br/api/v1", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({ id: "m1", wamid: "w", to: "+5531988887777", status: "sent" }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    });

    // sem baseUrl → cai no DEFAULT_BASE_URL; sem fetch → usa o global stubado.
    const boto = new BotoZap({ apiKey: API_KEY });
    await boto.messages.send({ to: "+5531988887777", text: "oi" });

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://botozap.com.br/api/v1/messages");
  });

  it("erro de rede: fetch REJEITA (TypeError) → BotoZapError de rede, não vaza cru nem trava", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const boto = new BotoZap({ apiKey: API_KEY });
    const err = await boto.messages
      .send({ to: "+5531988887777", text: "x" })
      .catch((e) => e);

    // Não pode ser undefined (hang/engolido) nem um TypeError cru: o chamador
    // precisa de UM tipo de erro pra capturar. code distingue rede de http.
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("network_error");
    expect((err as BotoZapError).status).toBe(0); // não houve resposta HTTP
    expect(String((err as Error).message)).toContain("fetch failed"); // preserva a causa
  });

  it("5xx com corpo NÃO-JSON (text/html): BotoZapError com status, sem crash de JSON.parse", async () => {
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response("<html><body>Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
    });

    const err = await boto.messages.get("m1").catch((e) => e);

    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).status).toBe(502);
    // sem envelope {error} parseável → fallback determinístico, nunca throw de parse.
    expect((err as BotoZapError).code).toBe("http_error");
    expect((err as Error).message).toBe("HTTP 502");
  });

  it("envelope de sucesso malformado: requestItem recebe 200 sem {data} → BotoZapError explícito", async () => {
    // 200 com JSON válido mas SEM a chave `data` (contrato de item violado).
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response(JSON.stringify({ foo: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const err = await boto.messages.get("m1").catch((e) => e);

    // Antes da correção isto RESOLVIA `undefined` em silêncio; agora falha alto.
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("malformed_response");
    expect(String((err as Error).message)).toContain("envelope data");
  });

  it("envelope de sucesso vazio: requestItem recebe 200 com {} → também lança (não undefined)", async () => {
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const err = await boto.messages.get("m1").catch((e) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("malformed_response");
  });

  it("resposta direta de mensagem precisa ser objeto JSON", async () => {
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response("<html>ok do proxy</html>", {
          status: 201,
          headers: { "content-type": "text/html" },
        }),
    });

    const err = await boto.messages
      .send({ to: "+5531988887777", text: "x" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("malformed_response");
  });

  it("resposta direta de mensagem exige os campos mínimos do contrato", async () => {
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response(JSON.stringify({}), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    });

    const err = await boto.messages
      .send({ to: "+5531988887777", text: "x" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("malformed_response");
  });

  it("lista por cursor exige data[] e paging", async () => {
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const err = await boto.messages.list().catch((e) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("malformed_response");
  });

  it("lista por offset exige data[] e meta", async () => {
    const boto = new BotoZap({
      apiKey: API_KEY,
      fetch: async () =>
        new Response(JSON.stringify({ data: [], paging: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const err = await boto.customers.list().catch((e) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).code).toBe("malformed_response");
  });
});
