/**
 * Tetos do Free (1 negócio e 1 número) no MCP: o catálogo completo publica
 * `plan_suspended` e explica as recusas; o perfil `assistant` (OAuth, app do
 * ChatGPT em revisão) segue com a mesma definição e a mesma saída de antes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, refreshServerIdentity, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const CUSTOMER_ID = "c1000000-0000-4000-8000-000000000002";
const PHONE_ID = "b1000000-0000-4000-8000-000000000002";
const CONNECTION_ID = "d1000000-0000-4000-8000-000000000002";

const customer = {
  id: CUSTOMER_ID,
  is_self: false,
  name: "Segundo negócio",
  external_customer_id: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
  business_slot: null,
  plan_suspended: true,
};
const phone = {
  id: PHONE_ID,
  phone_number_id: "1002",
  display_phone_number: "+55 11 90000-0002",
  verified_name: "Segundo",
  label: null,
  quality_rating: "GREEN",
  type: null,
  waba_connection_id: CONNECTION_ID,
  customer_id: CUSTOMER_ID,
  waba_id: "2002",
  connection_status: "active",
  token_status: "valid",
  plan_suspended: true,
  created_at: "2026-10-01T12:00:00.000Z",
};
const meta = { page: 1, per_page: 20, total_pages: 1, total_count: 1 };

const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
const oauth: ApiIdentity = {
  ...fullAccessIdentity,
  auth_type: "oauth",
  client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac",
  user_id: "operator",
  grant_id: "grant",
  allowed_routes: routes,
};

const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  vi.unstubAllEnvs();
});

async function connect(identity: ApiIdentity) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname === "/v1/customers" && method === "GET") return Response.json({ data: [customer], meta });
    if (url.pathname === "/v1/customers" && method === "POST") {
      return Response.json(
        { error: { code: "free_cap", message: "O plano Free permite 1 negócio. Assine o BotoZap para cadastrar outros negócios." } },
        { status: 402 },
      );
    }
    if (url.pathname === `/v1/customers/${CUSTOMER_ID}`) return Response.json({ data: customer });
    if (url.pathname === "/v1/phone_numbers") return Response.json({ data: [phone], meta });
    if (url.pathname === `/v1/phone_numbers/${PHONE_ID}`) return Response.json({ data: phone });
    if (url.pathname === "/v1/messages" && method === "POST") {
      return Response.json(
        { error: { code: "free_number_cap", message: "Este número está suspenso no plano Free, que permite 1 número." } },
        { status: 402 },
      );
    }
    return Response.json({ error: { code: "not_found", message: "não encontrado" } }, { status: 404 });
  });
  const server = await buildServer({ apiKey: "bz_live_free_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "free-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, server };
}

const READS = ["list_customers", "get_customer", "list_phone_numbers", "get_phone_number"];
const SENDS = ["send_message", "reply_to_conversation"];

async function toolMap(client: Client) {
  return new Map((await client.listTools()).tools.map((tool) => [tool.name, tool]));
}

function outputHasPlanSuspended(tool: { outputSchema?: unknown } | undefined): boolean {
  return JSON.stringify(tool?.outputSchema ?? {}).includes("plan_suspended");
}

describe("catálogo completo (chave de API)", () => {
  it("leituras publicam plan_suspended e as descrições explicam o Free", async () => {
    const { client } = await connect(fullAccessIdentity);
    const tools = await toolMap(client);
    for (const name of READS) {
      expect(outputHasPlanSuspended(tools.get(name)), name).toBe(true);
      expect(tools.get(name)?.description, name).toContain("plan_suspended");
    }
    for (const name of [...SENDS, "send_media_message"]) {
      expect(tools.get(name)?.description, name).toContain("free_number_cap");
      expect(tools.get(name)?.description, name).toContain("free_cap");
    }
    expect(tools.get("create_customer")?.description).toContain("402 free_cap");
    for (const name of ["create_message_rule", "update_message_rule", "update_instagram_messenger_profile", "sync_instagram_messenger_profile"]) {
      expect(tools.get(name)?.description, name).toContain("403 plan_restricted");
    }
  });

  it("list_customers e get_phone_number devolvem plan_suspended", async () => {
    const { client } = await connect(fullAccessIdentity);
    const customers = await client.callTool({ name: "list_customers", arguments: {} });
    expect(customers.isError).not.toBe(true);
    expect((customers.structuredContent as { data: Array<{ plan_suspended?: boolean }> }).data[0]?.plan_suspended).toBe(true);
    const number = await client.callTool({ name: "get_phone_number", arguments: { id: PHONE_ID } });
    expect((number.structuredContent as { data: { plan_suspended?: boolean } }).data.plan_suspended).toBe(true);
  });

  it("recusas free_cap e free_number_cap chegam com código e mensagem da API", async () => {
    const { client } = await connect(fullAccessIdentity);
    const created = await client.callTool({ name: "create_customer", arguments: { name: "Segundo" } });
    expect(created.isError).toBe(true);
    expect(created.structuredContent).toMatchObject({ error: { code: "free_cap", status: 402 } });
    const sent = await client.callTool({
      name: "send_message",
      arguments: { to: "5511999999999", type: "text", text: { body: "oi" } },
    });
    expect(sent.isError).toBe(true);
    expect(JSON.stringify(sent.content)).toContain("free_number_cap");
    expect(JSON.stringify(sent.content)).toContain("suspenso no plano Free");
  });
});

describe("perfil assistant (OAuth)", () => {
  it("definições e saída não mudam: sem plan_suspended e sem as notas do Free", async () => {
    const { client } = await connect(oauth);
    const tools = await toolMap(client);
    for (const name of [...READS, ...SENDS]) {
      expect(tools.has(name), name).toBe(true);
      expect(outputHasPlanSuspended(tools.get(name)), name).toBe(false);
      expect(tools.get(name)?.description, name).not.toContain("plan_suspended");
      expect(tools.get(name)?.description, name).not.toContain("free_number_cap");
    }
    const customers = await client.callTool({ name: "list_customers", arguments: {} });
    expect(customers.isError).not.toBe(true);
    expect((customers.structuredContent as { data: Array<Record<string, unknown>> }).data[0]).not.toHaveProperty("plan_suspended");
    expect(JSON.stringify(customers.content)).not.toContain("plan_suspended");
  });

  it("trocar a identidade troca descrição e saída junto com o perfil", async () => {
    const { client, server } = await connect(fullAccessIdentity);
    expect(outputHasPlanSuspended((await toolMap(client)).get("get_customer"))).toBe(true);
    refreshServerIdentity(server, oauth);
    const assistant = (await toolMap(client)).get("get_customer");
    expect(outputHasPlanSuspended(assistant)).toBe(false);
    expect(assistant?.description).not.toContain("plan_suspended");
    const result = await client.callTool({ name: "get_customer", arguments: { id: CUSTOMER_ID } });
    expect((result.structuredContent as { data: Record<string, unknown> }).data).not.toHaveProperty("plan_suspended");
    refreshServerIdentity(server, fullAccessIdentity);
    expect(outputHasPlanSuspended((await toolMap(client)).get("get_customer"))).toBe(true);
  });
});
