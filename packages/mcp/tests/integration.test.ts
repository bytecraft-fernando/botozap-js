/**
 * Integração do servidor MCP ponta a ponta, SEM rede: conecta um `Client` real
 * do MCP a um `Server` real (par de transportes em memória) e injeta um `fetch`
 * stub no `BotoZap` (a opção `fetch` do construtor do SDK existe pra isso). O
 * stub grava cada request e devolve fixtures — assim verificamos o request que
 * cada tool emite (método, path, query, body) E o shape que ela devolve ao
 * agente (envelope preservado, item re-embrulhado em { data }, send direto, erro
 * virando isError sem vazar a apiKey).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  MESSAGE_ID,
  cursorPagingFixture,
  messageFixture,
} from "./contract-fixtures.js";

const API_KEY = "bz_live_integração_secreta_123";
const BASE_URL = "https://api.test/v1";

interface Captured {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: unknown;
}

const calls: Captured[] = [];

/** fetch stub: grava o request e roteia por método + pathname para uma fixture. */
const fetchStub = (async (input: unknown, init?: RequestInit) => {
  const rawUrl = typeof input === "string" ? input : String(input);
  const url = new URL(rawUrl);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = (init?.headers ?? {}) as Record<string, string>;
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, headers, body });

  const path = url.pathname.replace(/^\/v1/, "");

  // Erro: qualquer GET de webhook individual devolve 404 com envelope de erro.
  if (method === "GET" && /^\/webhooks\/[^/]+$/.test(path)) {
    return jsonResponse(404, {
      error: { code: "not_found", message: "Webhook não encontrado." },
    });
  }

  if (method === "POST" && path === "/messages") {
    // POST /messages responde DIRETO (sem envelope { data }).
    return jsonResponse(200, {
      id: MESSAGE_ID,
      wamid: "wamid.ABC",
      to: body?.to ?? "",
      status: "accepted",
    });
  }

  if (method === "GET" && path === `/conversations/${CONVERSATION_ID}`) {
    return jsonResponse(200, {
      data: {
        id: CONVERSATION_ID,
        phone_number_id: "20000000-0000-4000-8000-000000000001",
        contact: { wa_id: "BR.1A2B3C4D5E6F" },
      },
    });
  }

  if (method === "GET" && path === "/messages") {
    return jsonResponse(200, {
      data: [messageFixture],
      paging: cursorPagingFixture,
    });
  }

  if (method === "GET" && /^\/messages\/[^/]+$/.test(path)) {
    return jsonResponse(200, { data: messageFixture });
  }

  if (method === "GET" && path === "/customers") {
    return jsonResponse(200, {
      data: [
        {
          id: CUSTOMER_ID,
          name: "Acme",
          external_customer_id: null,
          created_at: "2026-08-25T10:00:00.000Z",
          updated_at: "2026-08-25T10:00:00.000Z",
        },
      ],
      meta: { page: 1, per_page: 20, total_pages: 1, total_count: 1 },
    });
  }

  return jsonResponse(200, { data: null });
}) as unknown as typeof fetch;

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function connect(): Promise<Client> {
  const server = buildServer({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchStub });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

/** Extrai o texto do primeiro bloco de conteúdo de um resultado de tool. */
function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  const first = result.content?.[0];
  return first?.text ?? "";
}

describe("servidor MCP — integração ponta a ponta (fetch stub)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("send_message: POST /messages com o body certo, resposta direta (sem envelope)", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "send_message",
      arguments: { to: "5511999999999", type: "text", text: { body: "olá" } },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    const sent = calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/messages"));
    expect(sent).toBeDefined();
    expect(sent!.body).toMatchObject({
      to: "5511999999999",
      type: "text",
      text: { body: "olá" },
    });
    // Autenticação por Bearer (SDK), nunca X-API-Key.
    expect(sent!.headers.Authorization).toBe(`Bearer ${API_KEY}`);

    const payload = JSON.parse(textOf(result));
    // Resposta direta: sem chave `data`.
    expect(payload).toMatchObject({ id: MESSAGE_ID, wamid: "wamid.ABC", status: "accepted" });
    expect(payload.data).toBeUndefined();
  });

  it("reply_to_conversation: recebe só Conversa + texto e resolve o envio pelo SDK", async () => {
    const client = await connect();
    const discovered = (await client.listTools()).tools.find(
      (tool) => tool.name === "reply_to_conversation",
    );
    expect(Object.keys(discovered?.inputSchema.properties ?? {})).toEqual([
      "conversation_id",
      "text",
    ]);
    expect(discovered?.inputSchema.additionalProperties).toBe(false);

    const result = (await client.callTool({
      name: "reply_to_conversation",
      arguments: {
        conversation_id: CONVERSATION_ID,
        text: { body: "Resposta do agente" },
      },
    })) as {
      content: Array<{ type: string; text?: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ method: "GET" });
    expect(calls[0].url.pathname).toBe(`/v1/conversations/${CONVERSATION_ID}`);
    expect(calls[1]).toMatchObject({
      method: "POST",
      body: {
        to: "BR.1A2B3C4D5E6F",
        type: "text",
        text: { body: "Resposta do agente" },
        from: "20000000-0000-4000-8000-000000000001",
      },
    });
    expect(result.structuredContent).toMatchObject({
      id: MESSAGE_ID,
      wamid: "wamid.ABC",
      status: "accepted",
    });
  });

  it("list_messages: cursor query certa e saída com envelope { data, paging }", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "list_messages",
      arguments: { limit: 5, direction: "inbound" },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    const listed = calls.find((c) => c.method === "GET" && c.url.pathname.endsWith("/messages"));
    expect(listed).toBeDefined();
    expect(listed!.url.searchParams.get("limit")).toBe("5");
    expect(listed!.url.searchParams.get("direction")).toBe("inbound");

    const payload = JSON.parse(textOf(result));
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.paging).toBeDefined();
  });

  it("list_customers: paginação offset envia page/per_page (não limit/offset)", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "list_customers",
      arguments: { page: 2, per_page: 50 },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    const listed = calls.find((c) => c.method === "GET" && c.url.pathname.endsWith("/customers"));
    expect(listed).toBeDefined();
    expect(listed!.url.searchParams.get("page")).toBe("2");
    expect(listed!.url.searchParams.get("per_page")).toBe("50");
    // Params legados NÃO devem aparecer.
    expect(listed!.url.searchParams.get("limit")).toBeNull();
    expect(listed!.url.searchParams.get("offset")).toBeNull();

    const payload = JSON.parse(textOf(result));
    expect(payload.meta).toBeDefined();
  });

  it("get_message: item re-embrulhado em { data }", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_message",
      arguments: { id: MESSAGE_ID },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(textOf(result));
    expect(payload.data).toMatchObject({ id: MESSAGE_ID });
  });

  it("erro da API vira isError com 'Erro [code]:' e NÃO vaza a apiKey", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_webhook",
      arguments: { id: "wh_missing" },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain("Erro [not_found]:");
    expect(text).toContain("Webhook não encontrado.");
    expect(text).not.toContain(API_KEY);
  });
});
