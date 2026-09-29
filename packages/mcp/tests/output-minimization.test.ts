import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { fullAccessIdentity } from "./helpers/identity.js";
import { CONTACT_ID, CUSTOMER_ID, MESSAGE_ID, PHONE_ID, CONNECTION_ID, CONVERSATION_ID, TEMPLATE_ID, messageFixture, cursorPagingFixture } from "./contract-fixtures.js";

const API_KEY = "bz_live_output_minimization_test";
const BASE_URL = "https://api.test/v1";
const clients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
});

async function connect(fetch: typeof globalThis.fetch): Promise<Client> {
  const server = await buildServer({ apiKey: API_KEY, baseUrl: BASE_URL, fetch }, fullAccessIdentity);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "output-minimization-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

function json(payload: unknown): Response {
  return Response.json(payload);
}

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((item) => item.type === "text");
  if (!block?.text) throw new Error("resposta sem bloco de texto");
  return block.text;
}

it("strip extras de item e envelope sem alterar campos de negócio, IDs ou cursores", async () => {
  const nextCursor = `opaque-${"c".repeat(2048)}`;
  const fetch = async () => json({
    data: [{
      ...messageFixture,
      external_id: "wamid.ABC",
      channel: "whatsapp",
      channel_account: { id: PHONE_ID, channel: "whatsapp", display: "+5511999999999" },
      content: { ...messageFixture.content, custom_payload: { campaign: "promo" } },
      private_trace: "must-be-stripped",
    }],
    paging: { cursors: { before: "older", after: "newer" }, next: nextCursor, previous: null },
    internal_debug: "must-also-be-stripped",
  });
  const client = await connect(fetch);

  const result = await client.callTool({ name: "list_messages", arguments: { limit: 20 } });
  const structured = result.structuredContent as Record<string, any>;
  const text = textOf(result);

  expect(result.isError).not.toBe(true);
  expect(structured).not.toHaveProperty("internal_debug");
  expect(structured.data[0]).not.toHaveProperty("private_trace");
  expect(structured.data[0]).toMatchObject({
    id: MESSAGE_ID,
    external_id: "wamid.ABC",
    channel: "whatsapp",
    channel_account: { id: PHONE_ID, channel: "whatsapp", display: "+5511999999999" },
    conversation_id: messageFixture.conversation_id,
    content: { body: "olá", custom_payload: { campaign: "promo" } },
  });
  expect(structured.paging.next).toBe(nextCursor);
  expect(JSON.parse(text)).toEqual(structured);
  expect(text).not.toContain("\n");
});

it("preserva o retorno textual null de 204 e o structured success", async () => {
  const fetch = async () => new Response(null, { status: 204 });
  const client = await connect(fetch);

  const result = await client.callTool({ name: "delete_contact", arguments: { id: CONTACT_ID } });

  expect(result.isError).not.toBe(true);
  expect(textOf(result)).toBe("null");
  expect(result.structuredContent).toEqual({ success: true });
});

it("mantém intactos os payloads dinâmicos de IA e compacta o JSON textual", async () => {
  const agentId = "80000000-0000-4000-8000-000000000001";
  const aiData = {
    agent: { id: agentId, config: { prompt: "responda com clareza", custom: [1, 2, 3] } },
    revision: 7,
  };
  const fetch = async () => json({
    data: aiData,
    internal_debug: "must-be-stripped",
  });
  const client = await connect(fetch);

  const result = await client.callTool({
    name: "ai_agents_get",
    arguments: { customer_id: CUSTOMER_ID, id: agentId },
  });
  const structured = result.structuredContent as Record<string, unknown>;
  const text = textOf(result);

  expect(result.isError).not.toBe(true);
  expect(structured).toEqual({ data: aiData });
  expect(JSON.parse(text)).toEqual(structured);
  expect(text).not.toContain("\n");
});

it("mantém o secret HMAC somente no create e conserva campos públicos de saúde", async () => {
  const webhookId = "90000000-0000-4000-8000-000000000001";
  const webhook = {
    id: webhookId,
    customer_id: CUSTOMER_ID,
    url: "https://hooks.example.test/events",
    events: ["messages"],
    active: true,
    has_authorization: true,
    health_status: "healthy",
    failure_streak: 0,
    verified_at: "2026-09-29T12:00:00.000Z",
    last_success_at: "2026-09-29T12:00:00.000Z",
    last_failure_at: null,
    last_response_code: 200,
    next_attempt_at: null,
    paused_at: null,
    created_at: "2026-09-29T11:00:00.000Z",
    updated_at: "2026-09-29T12:00:00.000Z",
  };
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/webhooks" && init?.method === "GET") {
      return json({ data: [{ ...webhook, secret: "must-be-stripped", authorization_secret_id: "vault-id" }], paging: cursorPagingFixture, internal_debug: true });
    }
    if (url.pathname === `/v1/webhooks/${webhookId}` && init?.method === "GET") {
      return json({ data: { ...webhook, secret: "must-be-stripped", authorization_secret_id: "vault-id" }, internal_debug: true });
    }
    if (url.pathname === `/v1/webhooks/${webhookId}` && init?.method === "PATCH") {
      return json({ data: { ...webhook, secret: "must-be-stripped", authorization_secret_id: "vault-id" }, internal_debug: true });
    }
    if (url.pathname === "/v1/webhooks" && init?.method === "POST") {
      return json({ data: { ...webhook, secret: "one-time-hmac-secret", authorization_secret_id: "vault-id" }, internal_debug: true });
    }
    throw new Error(`rota inesperada: ${init?.method} ${url.pathname}`);
  };
  const client = await connect(fetch);

  const list = await client.callTool({ name: "list_webhooks", arguments: {} });
  const get = await client.callTool({ name: "get_webhook", arguments: { id: webhookId } });
  const update = await client.callTool({ name: "update_webhook", arguments: { id: webhookId, active: true } });
  const create = await client.callTool({ name: "create_webhook", arguments: { url: webhook.url, events: webhook.events } });

  for (const [name, result] of [["list", list], ["get", get], ["update", update]] as const) {
    expect(result.isError, `${name}: ${textOf(result)}`).not.toBe(true);
    const structured = result.structuredContent as Record<string, any>;
    const endpoint = Array.isArray(structured.data) ? structured.data[0] : structured.data;
    expect(endpoint).not.toHaveProperty("secret");
    expect(endpoint).not.toHaveProperty("authorization_secret_id");
    expect(endpoint).toMatchObject({
      id: webhookId,
      health_status: "healthy",
      failure_streak: 0,
      last_response_code: 200,
    });
  }
  const created = (create.structuredContent as { data: Record<string, unknown> }).data;
  expect(create.isError).not.toBe(true);
  expect(created.secret).toBe("one-time-hmac-secret");
  expect(created).not.toHaveProperty("authorization_secret_id");
});


it("conserva campos públicos aditivos de identidade, diagnóstico e consentimento", async () => {
  const timestamp = "2026-09-29T12:00:00.000Z";
  const channel = { channel: "whatsapp", channel_account: { id: PHONE_ID, channel: "whatsapp", display: null } };
  const cases = [
    {
      name: "get_contact", arguments: { id: CONTACT_ID }, path: `/v1/contacts/${CONTACT_ID}`,
      data: { id: CONTACT_ID, wa_id: "5511999999999", profile_name: null, display_name: null, phone: null, user_id: null, username: null, parent_user_id: null, phone_number_id: PHONE_ID, last_seen_at: null, created_at: timestamp, notes: null, metadata: { custom: "preserved" }, stage: null, external_id: "5511999999999", profile_picture_url: "https://meta.example/photo", ...channel },
    },
    {
      name: "get_conversation", arguments: { id: CONVERSATION_ID }, path: `/v1/conversations/${CONVERSATION_ID}`,
      data: { id: CONVERSATION_ID, phone_number_id: PHONE_ID, phone_number_meta_id: "123", display_phone_number: null, contact_id: CONTACT_ID, contact: { name: "Teste", phone: null, username: null, wa_id: "5511999999999" }, status: "ended", window_expires_at: null, closed_at: timestamp, last_message_at: null, last_read_at: null, created_at: timestamp, ...channel },
    },
    {
      name: "get_customer", arguments: { id: CUSTOMER_ID }, path: `/v1/customers/${CUSTOMER_ID}`,
      data: { id: CUSTOMER_ID, name: "Conta", external_customer_id: null, is_self: true, created_at: timestamp, updated_at: timestamp },
    },
    {
      name: "get_template", arguments: { id: TEMPLATE_ID }, path: `/v1/templates/${TEMPLATE_ID}`,
      data: { id: TEMPLATE_ID, name: "modelo", language: "pt_BR", category: "UTILITY", status: "REJECTED", rejection_reason: "INVALID_FORMAT", meta_template_id: null, components: [], waba_connection_id: CONNECTION_ID, created_at: timestamp, last_synced_at: null },
    },
  ];
  for (const testCase of cases) {
    const client = await connect(async (input) => {
      expect(new URL(String(input)).pathname).toBe(testCase.path);
      return json({ data: { ...testCase.data, internal_debug: "strip" }, internal_debug: "strip" });
    });
    const result = await client.callTool({ name: testCase.name, arguments: testCase.arguments });
    expect(result.isError, testCase.name).not.toBe(true);
    expect(result.structuredContent).toEqual({ data: testCase.data });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  }
  const sent = { id: MESSAGE_ID, wamid: "wamid.ABC", to: "5511999999999", status: "sent", warnings: [{ code: "consent_missing", message: "Consentimento não registrado." }] };
  const client = await connect(async () => json({ ...sent, internal_debug: "strip" }));
  const result = await client.callTool({ name: "send_message", arguments: { idempotency_key: "intent-fixture-0001", to: sent.to, type: "text", text: { body: "olá" } } });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toEqual(sent);
  expect(JSON.parse(textOf(result))).toEqual(sent);
});

it("preserva diagnóstico de logs e o Cliente das entregas de webhook", async () => {
  const created_at = "2026-09-29T12:00:00.000Z";
  const log = { id: MESSAGE_ID, source: "api", method: "POST", path: "/v1/messages", status_code: 422, error_code: "meta_error", api_key_id: null, duration_ms: 10, created_at, meta_error_code: 131047, send_outcome: "rejected", phone_number_id: PHONE_ID, environment: "live" };
  const delivery = { id: MESSAGE_ID, endpoint_id: CONTACT_ID, customer_id: CUSTOMER_ID, event_type: "whatsapp.message.received", status: "success", response_code: 200, attempts: 1, last_attempt_at: created_at, next_retry_at: null, created_at };
  for (const [name, data] of [["list_api_logs", log], ["list_webhook_deliveries", delivery]] as const) {
    const client = await connect(async () => json({ data: [{ ...data, internal_debug: "strip" }], paging: cursorPagingFixture }));
    const result = await client.callTool({ name, arguments: {} });
    expect(result.isError, name).not.toBe(true);
    expect(result.structuredContent).toEqual({ data: [data], paging: cursorPagingFixture });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  }
});
