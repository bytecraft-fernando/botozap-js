/**
 * Contrato protocolar das saídas estruturadas do MCP.
 *
 * O seam é público: um Client MCP real descobre as tools e as chama por um
 * transporte em memória. O fetch é o único adapter substituído e responde com
 * fixtures fiéis às rotas /v1 do core.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import {
  CONNECTION_ID,
  CONTACT_ID,
  CONVERSATION_ID,
  CUSTOMER_ID,
  MESSAGE_ID,
  PHONE_ID,
  TEMPLATE_ID,
  cursorPagingFixture,
  messageFixture,
  offsetMetaFixture,
} from "./contract-fixtures.js";

const API_KEY = "bz_live_integração_secreta_123";
const BASE_URL = "https://api.test/v1";

const phoneNumber = {
  id: PHONE_ID,
  phone_number_id: "1279498075235551",
  display_phone_number: "+55 11 99999-9999",
  verified_name: "BotoZap",
  quality_rating: "GREEN",
  type: "customer_owned",
  waba_connection_id: CONNECTION_ID,
  customer_id: CUSTOMER_ID,
  waba_id: "4207187232868022",
  connection_status: "active",
  token_status: "valid",
  created_at: "2026-08-25T12:00:00.000Z",
};

const template = {
  id: TEMPLATE_ID,
  name: "boas_vindas",
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  meta_template_id: "987654321",
  components: [{ type: "BODY", text: "Olá" }],
  waba_connection_id: CONNECTION_ID,
  created_at: "2026-08-25T12:00:00.000Z",
  last_synced_at: "2026-08-25T12:01:00.000Z",
};

const contact = {
  id: CONTACT_ID,
  wa_id: "5511999999999",
  profile_name: "Contato Teste",
  phone: "5511999999999",
  user_id: null,
  username: "contato.teste",
  parent_user_id: null,
  phone_number_id: PHONE_ID,
  last_seen_at: "2026-08-25T12:00:00.000Z",
  created_at: "2026-08-25T11:00:00.000Z",
  notes: null,
  metadata: { origem: "mcp" },
  stage: null,
};

const conversation = {
  id: CONVERSATION_ID,
  phone_number_id: PHONE_ID,
  phone_number_meta_id: "1279498075235551",
  display_phone_number: "+55 11 99999-9999",
  contact_id: CONTACT_ID,
  contact: {
    name: "Contato Teste",
    phone: "+55 11 99999-9999",
    username: "contato.teste",
  },
  status: "active",
  window_expires_at: "2026-08-26T12:00:00.000Z",
  last_message_at: "2026-08-25T12:00:00.000Z",
  last_read_at: null,
  created_at: "2026-08-25T11:00:00.000Z",
};

const customer = {
  id: CUSTOMER_ID,
  name: "Acme",
  external_customer_id: "acme-42",
  created_at: "2026-08-25T10:00:00.000Z",
  updated_at: "2026-08-25T11:00:00.000Z",
};

const SETUP_LINK_ID = "80000000-0000-4000-8000-000000000001";
const setupLink = {
  id: SETUP_LINK_ID,
  status: "active",
  whatsapp_setup_status: "pending",
  url: "https://botozap.com.br/whatsapp/setup/token-opaco",
  allowed_connection_types: ["dedicated"],
  provision_phone_number: false,
  language: "pt_BR",
  success_redirect_url: null,
  failure_redirect_url: null,
  theme_config: null,
  expires_at: "2026-09-25T10:00:00.000Z",
  created_at: "2026-08-25T10:00:00.000Z",
  updated_at: "2026-08-25T10:00:00.000Z",
};

const mediaUpload = {
  ingest_id: "90000000-0000-4000-8000-000000000001",
  target: { kind: "meta_media", media_id: "media-meta-1" },
  resource: {
    filename: "foto.png",
    mime_type: "image/png",
    size_bytes: 1024,
    sha256: "a".repeat(64),
    source_url: "https://cdn.example.test/foto.png",
  },
};

const apiLog = {
  id: "a0000000-0000-4000-8000-000000000001",
  source: "api",
  method: "GET",
  path: "/v1/messages",
  status_code: null,
  error_code: null,
  api_key_id: "b0000000-0000-4000-8000-000000000001",
  duration_ms: 42,
  created_at: "2026-08-25T12:00:00.000Z",
};

const user = {
  id: "c0000000-0000-4000-8000-000000000001",
  user_id: "c0000000-0000-4000-8000-000000000001",
  email: "membro@example.test",
  name: "Membro Teste",
  role: "member",
};

const WEBHOOK_ID = "d0000000-0000-4000-8000-000000000001";
const webhook = {
  id: WEBHOOK_ID,
  url: "https://agent.example.test/webhook",
  events: ["messages"],
  active: true,
  created_at: "2026-08-25T10:00:00.000Z",
  updated_at: "2026-08-25T11:00:00.000Z",
};

const webhookDelivery = {
  id: "e0000000-0000-4000-8000-000000000001",
  endpoint_id: WEBHOOK_ID,
  event_type: "messages",
  status: "success",
  response_code: 200,
  attempts: 1,
  last_attempt_at: "2026-08-25T12:00:00.000Z",
  next_retry_at: null,
  created_at: "2026-08-25T12:00:00.000Z",
};

const calls: Array<{ method: string; path: string }> = [];

const fetchStub = (async (input: unknown, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : String(input));
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname.replace(/^\/v1/, "");
  calls.push({ method, path });

  if (method === "GET" && path === "/templates/missing") {
    return jsonResponse(404, {
      error: {
        code: "not_found",
        message: `Template não encontrado. Credencial ${API_KEY}`,
      },
    });
  }
  if (method === "POST" && path === "/messages") {
    return jsonResponse(201, {
      id: MESSAGE_ID,
      wamid: messageFixture.wamid,
      to: "5511999999999",
      sent_to: "5511999999999",
      status: "sent",
    });
  }
  if (method === "GET" && path === "/messages") {
    return jsonResponse(200, {
      data: [messageFixture],
      paging: cursorPagingFixture,
    });
  }
  if (method === "GET" && path === `/messages/${MESSAGE_ID}`) {
    return jsonResponse(200, { data: messageFixture });
  }
  if (method === "GET" && path === "/phone_numbers") {
    return jsonResponse(200, { data: [phoneNumber], meta: offsetMetaFixture });
  }
  if (method === "GET" && path === `/phone_numbers/${PHONE_ID}/health`) {
    return jsonResponse(200, {
      data: {
        status: "healthy",
        timestamp: "2026-08-25T12:00:00.000Z",
        checks: { token_validity: "valid" },
      },
    });
  }
  if (method === "GET" && path === `/phone_numbers/${PHONE_ID}`) {
    return jsonResponse(200, { data: phoneNumber });
  }
  if (method === "GET" && path === "/templates") {
    return jsonResponse(200, { data: [template], meta: offsetMetaFixture });
  }
  if (method === "GET" && path === `/templates/${TEMPLATE_ID}`) {
    return jsonResponse(200, { data: template });
  }
  if (method === "POST" && path === "/templates") {
    return jsonResponse(201, { data: template });
  }
  if (method === "GET" && path === "/contacts") {
    return jsonResponse(200, { data: [contact], paging: cursorPagingFixture });
  }
  if (method === "POST" && path === "/contacts") {
    return jsonResponse(201, { data: contact });
  }
  if (method === "GET" && path === `/contacts/${CONTACT_ID}`) {
    return jsonResponse(200, { data: contact });
  }
  if (method === "PATCH" && path === `/contacts/${CONTACT_ID}`) {
    return jsonResponse(200, { data: contact });
  }
  if (method === "DELETE" && path === `/contacts/${CONTACT_ID}`) {
    return new Response(null, { status: 204 });
  }
  if (method === "GET" && path === "/conversations") {
    return jsonResponse(200, {
      data: [conversation],
      paging: cursorPagingFixture,
    });
  }
  if (method === "GET" && path === `/conversations/${CONVERSATION_ID}`) {
    return jsonResponse(200, { data: conversation });
  }
  if (method === "PATCH" && path === `/conversations/${CONVERSATION_ID}`) {
    return jsonResponse(200, { data: { ...conversation, status: "ended" } });
  }
  if (method === "GET" && path === "/customers") {
    return jsonResponse(200, { data: [customer], meta: offsetMetaFixture });
  }
  if (method === "POST" && path === "/customers") {
    return jsonResponse(201, { data: customer });
  }
  if (method === "GET" && path === `/customers/${CUSTOMER_ID}`) {
    return jsonResponse(200, { data: customer });
  }
  if (method === "PATCH" && path === `/customers/${CUSTOMER_ID}`) {
    return jsonResponse(200, { data: customer });
  }
  if (method === "DELETE" && path === `/customers/${CUSTOMER_ID}`) {
    return new Response(null, { status: 204 });
  }
  if (method === "GET" && path === `/customers/${CUSTOMER_ID}/setup_links`) {
    return jsonResponse(200, { data: [setupLink], meta: offsetMetaFixture });
  }
  if (method === "POST" && path === `/customers/${CUSTOMER_ID}/setup_links`) {
    return jsonResponse(201, { data: setupLink });
  }
  if (
    method === "PATCH" &&
    path === `/customers/${CUSTOMER_ID}/setup_links/${SETUP_LINK_ID}`
  ) {
    return jsonResponse(200, { data: { ...setupLink, status: "revoked" } });
  }
  if (method === "POST" && path === "/media") {
    return jsonResponse(201, { data: mediaUpload });
  }
  if (method === "GET" && path === "/api_logs") {
    return jsonResponse(200, { data: [apiLog], paging: cursorPagingFixture });
  }
  if (method === "GET" && path === "/users") {
    return jsonResponse(200, { data: [user], meta: offsetMetaFixture });
  }
  if (method === "GET" && path === "/webhooks") {
    return jsonResponse(200, { data: [webhook], paging: cursorPagingFixture });
  }
  if (method === "POST" && path === "/webhooks") {
    return jsonResponse(201, { data: { ...webhook, secret: "whsec_teste" } });
  }
  if (method === "GET" && path === `/webhooks/${WEBHOOK_ID}`) {
    return jsonResponse(200, { data: webhook });
  }
  if (method === "PATCH" && path === `/webhooks/${WEBHOOK_ID}`) {
    return jsonResponse(200, { data: webhook });
  }
  if (method === "DELETE" && path === `/webhooks/${WEBHOOK_ID}`) {
    return new Response(null, { status: 204 });
  }
  if (method === "POST" && path === `/webhooks/${WEBHOOK_ID}/test`) {
    return jsonResponse(200, { data: { success: true } });
  }
  if (method === "GET" && path === "/webhook_deliveries") {
    return jsonResponse(200, {
      data: [webhookDelivery],
      paging: cursorPagingFixture,
    });
  }

  return jsonResponse(500, {
    error: { code: "unexpected_test_request", message: `${method} ${path}` },
  });
}) as typeof fetch;

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function connect(fetchImpl: typeof fetch = fetchStub): Promise<Client> {
  const server = buildServer({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    fetch: fetchImpl,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "structured-output-test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.find((item) => item.type === "text")?.text ?? "";
}

type ToolCall = readonly [
  name: string,
  args: Readonly<Record<string, unknown>>,
];

async function expectStructuredTools(
  client: Client,
  toolCalls: readonly ToolCall[],
): Promise<void> {
  const discovery = await client.listTools();
  const names = toolCalls.map(([name]) => name);
  const tools = discovery.tools.filter((tool) => names.includes(tool.name));

  expect(tools).toHaveLength(toolCalls.length);
  for (const tool of tools) {
    expect(tool.outputSchema, `${tool.name} outputSchema`).toBeDefined();
    expect(Object.keys(tool.outputSchema?.properties ?? {}), tool.name).not.toHaveLength(0);
  }

  for (const [name, args] of toolCalls) {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, name).toBeFalsy();
    expect(result.structuredContent, `${name} structuredContent`).toBeDefined();
    const textFallback = textOf(result);
    expect(textFallback, `${name} fallback textual`).not.toBe("");
    const parsedFallback = JSON.parse(textFallback);
    if (parsedFallback === null) {
      expect(result.structuredContent, name).toEqual({ success: true });
    } else {
      expect(result.structuredContent, name).toEqual(parsedFallback);
    }
  }
}

function listItemProperties(tool: {
  outputSchema?: { properties?: Record<string, unknown> };
}): Record<string, { description?: string }> | undefined {
  const data = tool.outputSchema?.properties?.data as
    | { items?: { properties?: Record<string, { description?: string }> } }
    | undefined;
  return data?.items?.properties;
}

const callsByTool = [
  [
    "send_message",
    { to: "5511999999999", type: "text", text: { body: "olá" } },
  ],
  ["list_messages", { limit: 20 }],
  ["get_message", { id: MESSAGE_ID }],
  ["list_phone_numbers", { page: 1, per_page: 20 }],
  ["get_phone_number", { id: PHONE_ID }],
  ["phone_number_health", { id: PHONE_ID }],
  ["list_templates", { page: 1, per_page: 20 }],
  ["get_template", { id: TEMPLATE_ID }],
  [
    "create_template",
    {
      name: template.name,
      language: template.language,
      category: template.category,
      components: template.components,
      waba_connection_id: CONNECTION_ID,
    },
  ],
] as const;

const contactCalls = [
  ["list_contacts", { limit: 20 }],
  ["get_contact", { id: CONTACT_ID }],
  [
    "create_contact",
    { wa_id: contact.wa_id, phone_number_id: "1279498075235551" },
  ],
  ["update_contact", { id: CONTACT_ID, profile_name: contact.profile_name }],
  ["delete_contact", { id: CONTACT_ID }],
] as const;

const conversationCalls = [
  ["list_conversations", { limit: 20 }],
  ["get_conversation", { id: CONVERSATION_ID }],
  ["update_conversation", { id: CONVERSATION_ID, status: "ended" }],
] as const;

const customerCalls = [
  ["list_customers", { page: 1, per_page: 20 }],
  ["get_customer", { id: CUSTOMER_ID }],
  ["create_customer", { name: customer.name }],
  ["update_customer", { id: CUSTOMER_ID, name: customer.name }],
  ["delete_customer", { id: CUSTOMER_ID }],
  ["list_setup_links", { customer_id: CUSTOMER_ID, page: 1, per_page: 20 }],
  ["create_setup_link", { customer_id: CUSTOMER_ID }],
  [
    "update_setup_link",
    { customer_id: CUSTOMER_ID, link_id: SETUP_LINK_ID, status: "revoked" },
  ],
] as const;

const utilityCalls = [
  [
    "ingest_media",
    {
      phone_number_id: "1279498075235551",
      source: mediaUpload.resource.source_url,
    },
  ],
  ["list_api_logs", { limit: 20 }],
  ["list_users", { page: 1, per_page: 20 }],
] as const;

const webhookCalls = [
  ["list_webhooks", { limit: 20 }],
  ["get_webhook", { id: WEBHOOK_ID }],
  [
    "create_webhook",
    { url: webhook.url, events: webhook.events, active: true },
  ],
  ["update_webhook", { id: WEBHOOK_ID, active: true }],
  ["delete_webhook", { id: WEBHOOK_ID }],
  ["test_webhook", { id: WEBHOOK_ID }],
  ["list_webhook_deliveries", { webhook_id: WEBHOOK_ID, limit: 20 }],
] as const;

const completeCatalog = [
  "send_message",
  "list_messages",
  "get_message",
  "list_conversations",
  "get_conversation",
  "update_conversation",
  "list_contacts",
  "get_contact",
  "create_contact",
  "update_contact",
  "delete_contact",
  "ingest_media",
  "list_customers",
  "get_customer",
  "create_customer",
  "update_customer",
  "delete_customer",
  "list_setup_links",
  "create_setup_link",
  "update_setup_link",
  "list_phone_numbers",
  "get_phone_number",
  "phone_number_health",
  "list_templates",
  "get_template",
  "create_template",
  "list_webhooks",
  "get_webhook",
  "create_webhook",
  "update_webhook",
  "delete_webhook",
  "test_webhook",
  "list_webhook_deliveries",
  "list_api_logs",
  "list_users",
] as const;

const completeCatalogCalls = [
  ...callsByTool,
  ...conversationCalls,
  ...contactCalls,
  ...customerCalls,
  ...utilityCalls,
  ...webhookCalls,
] as const;

describe("MCP — output schemas e structured content", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("anuncia schemas não vazios para as nove tools centrais e distingue os IDs de Número", async () => {
    const client = await connect();
    const discovery = await client.listTools();
    const centralNames = callsByTool.map(([name]) => name);
    const centralTools = discovery.tools.filter((tool) => centralNames.includes(tool.name));

    expect(centralTools.map((tool) => tool.name)).toEqual(centralNames);
    for (const tool of centralTools) {
      expect(tool.inputSchema.properties, `${tool.name} inputSchema`).toBeDefined();
      expect(tool.outputSchema, `${tool.name} outputSchema`).toBeDefined();
      expect(tool.outputSchema?.properties, `${tool.name} outputSchema`).toBeDefined();
      expect(Object.keys(tool.outputSchema?.properties ?? {}), `${tool.name} outputSchema`).not.toHaveLength(0);
    }

    const numberList = centralTools.find((tool) => tool.name === "list_phone_numbers");
    const itemProperties = numberList ? listItemProperties(numberList) : undefined;
    expect(itemProperties?.id?.description).toContain("UUID interno");
    expect(itemProperties?.phone_number_id?.description).toContain("ID Meta");

    expect(
      Object.fromEntries(
        centralTools.map((tool) => [
          tool.name,
          { inputSchema: tool.inputSchema, outputSchema: tool.outputSchema },
        ]),
      ),
    ).toMatchSnapshot();
  });

  it("devolve structuredContent validado e mantém o JSON textual idêntico", async () => {
    const client = await connect();
    await client.listTools();

    for (const [name, args] of callsByTool) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBeFalsy();
      expect(result.structuredContent, name).toEqual(JSON.parse(textOf(result)));
    }
  });

  it("mantém isError e expõe code, message e status sem credencial", async () => {
    const client = await connect();
    await client.listTools();

    const result = await client.callTool({
      name: "get_template",
      arguments: { id: "missing" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Erro [not_found]: Template não encontrado. Credencial [credencial removida]",
    );
    expect(result.structuredContent).toEqual({
      error: {
        code: "not_found",
        message: "Template não encontrado. Credencial [credencial removida]",
        status: 404,
      },
    });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("converte uma resposta que viola o output schema em erro da tool", async () => {
    const malformedFetch = (async () =>
      jsonResponse(200, {
        data: [{ id: MESSAGE_ID }],
        paging: cursorPagingFixture,
      })) as typeof fetch;
    const client = await connect(malformedFetch);
    await client.listTools();

    const result = await client.callTool({
      name: "list_messages",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("output schema");
  });

  it("estrutura todas as operações de Contatos sem alterar o fallback textual do DELETE", async () => {
    const client = await connect();
    await expectStructuredTools(client, contactCalls);
  });

  it("estrutura listagem, leitura e gestão de Conversas", async () => {
    const client = await connect();
    await expectStructuredTools(client, conversationCalls);
  });

  it("estrutura gestão de Clientes e Setup Links sem alterar o fallback textual do DELETE", async () => {
    const client = await connect();
    await expectStructuredTools(client, customerCalls);
  });

  it("estrutura ingestão de mídia, logs e membros com paginação explícita", async () => {
    const client = await connect();
    await expectStructuredTools(client, utilityCalls);
  });

  it("estrutura gestão de Webhooks e Entregas sem alterar o fallback textual do DELETE", async () => {
    const client = await connect();
    await expectStructuredTools(client, webhookCalls);
  });

  it("enumera o catálogo completo e não deixa nenhuma tool somente textual", async () => {
    const client = await connect();
    const discovery = await client.listTools();

    expect(discovery.tools.map((tool) => tool.name)).toEqual(completeCatalog);
    for (const tool of discovery.tools) {
      expect(tool.outputSchema, `${tool.name} outputSchema`).toMatchObject({
        type: "object",
      });
      expect(Object.keys(tool.outputSchema?.properties ?? {}), tool.name).not.toHaveLength(0);
    }

    expect(completeCatalogCalls).toHaveLength(completeCatalog.length);
    await expectStructuredTools(client, completeCatalogCalls);
  });
});
