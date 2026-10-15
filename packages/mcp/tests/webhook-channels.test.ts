/**
 * Webhooks por canal no MCP: `channel_account_ids` nas tools de criar/atualizar
 * (ausente não vai no body; null explícito vai) e `channel_account_ids` /
 * `channels_health` preservados na saída estruturada. As tools de webhook
 * ficam fora do perfil `assistant`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { fullAccessIdentity } from "./helpers/identity.js";
import { cursorPagingFixture } from "./contract-fixtures.js";

const API_KEY = "bz_live_webhook_channels_test";
const BASE_URL = "https://api.test/v1";
const WEBHOOK_ID = "90000000-0000-4000-8000-000000000002";
const CHANNEL_A = "91000000-0000-4000-8000-000000000001";
const CHANNEL_B = "91000000-0000-4000-8000-000000000002";

const channelsHealth = [
  {
    channel_account_id: CHANNEL_A,
    health_status: "paused",
    failure_streak: 15,
    next_attempt_at: null,
    paused_at: "2026-10-15T10:00:00.000Z",
    last_success_at: "2026-10-14T10:00:00.000Z",
    last_failure_at: "2026-10-15T10:00:00.000Z",
    last_response_code: 500,
  },
  {
    channel_account_id: null,
    health_status: "degraded",
    failure_streak: 2,
    next_attempt_at: "2026-10-15T10:05:00.000Z",
    paused_at: null,
    last_success_at: null,
    last_failure_at: "2026-10-15T10:01:00.000Z",
    last_response_code: null,
  },
];

const webhook = {
  id: WEBHOOK_ID,
  customer_id: null,
  channel_account_ids: [CHANNEL_A, CHANNEL_B],
  url: "https://hooks.example.test/events",
  events: ["messages"],
  active: true,
  has_authorization: false,
  health_status: "degraded",
  failure_streak: 15,
  verified_at: "2026-10-01T12:00:00.000Z",
  last_success_at: "2026-10-14T10:00:00.000Z",
  last_failure_at: "2026-10-15T10:01:00.000Z",
  last_response_code: 500,
  next_attempt_at: "2026-10-15T10:05:00.000Z",
  paused_at: null,
  channels_health: channelsHealth,
  created_at: "2026-10-01T11:00:00.000Z",
  updated_at: "2026-10-15T10:01:00.000Z",
};

type Captured = { method: string; path: string; body: unknown };
const clients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
});

async function connect(captured: Captured[], data: Record<string, unknown> = webhook): Promise<Client> {
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    captured.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/v1/webhooks" && method === "GET") {
      return Response.json({ data: [data], paging: cursorPagingFixture });
    }
    if (url.pathname === "/v1/webhooks" && method === "POST") {
      return Response.json({ data: { ...data, secret: "whsec_once" } }, { status: 201 });
    }
    if (url.pathname === `/v1/webhooks/${WEBHOOK_ID}`) return Response.json({ data });
    throw new Error(`rota inesperada: ${method} ${url.pathname}`);
  };
  const server = await buildServer({ apiKey: API_KEY, baseUrl: BASE_URL, fetch }, fullAccessIdentity);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "webhook-channels-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

describe("MCP — webhooks por canal", () => {
  it("anuncia channel_account_ids opcional em create_webhook e update_webhook", async () => {
    const client = await connect([]);
    const { tools } = await client.listTools();
    for (const name of ["create_webhook", "update_webhook"]) {
      const tool = tools.find((t) => t.name === name)!;
      const prop = (tool.inputSchema.properties as Record<string, any>).channel_account_ids;
      expect(prop, name).toBeDefined();
      expect(tool.inputSchema.required ?? []).not.toContain("channel_account_ids");
      expect(tool.description).toContain("channel_account_ids");
    }
  });

  it("webhooks ficam fora do perfil assistant", () => {
    for (const name of ["list_webhooks", "get_webhook", "create_webhook", "update_webhook", "delete_webhook", "test_webhook", "list_webhook_deliveries"]) {
      expect(ASSISTANT_TOOLS.has(name), name).toBe(false);
    }
  });

  it("create envia channel_account_ids só quando informado", async () => {
    const captured: Captured[] = [];
    const client = await connect(captured);
    const created = await client.callTool({
      name: "create_webhook",
      arguments: { url: webhook.url, events: ["messages"], channel_account_ids: [CHANNEL_A, CHANNEL_B] },
    });
    expect(created.isError).not.toBe(true);
    expect(captured.at(-1)).toEqual({
      method: "POST",
      path: "/v1/webhooks",
      body: { url: webhook.url, events: ["messages"], channel_account_ids: [CHANNEL_A, CHANNEL_B] },
    });
    const data = (created.structuredContent as { data: Record<string, unknown> }).data;
    expect(data.secret).toBe("whsec_once");
    expect(data.channel_account_ids).toEqual([CHANNEL_A, CHANNEL_B]);

    await client.callTool({ name: "create_webhook", arguments: { url: webhook.url, events: ["messages"] } });
    expect(captured.at(-1)?.body).not.toHaveProperty("channel_account_ids");
  });

  it("update: array substitui, null volta a todos, omitido não envia", async () => {
    const captured: Captured[] = [];
    const client = await connect(captured);
    await client.callTool({ name: "update_webhook", arguments: { id: WEBHOOK_ID, channel_account_ids: [CHANNEL_A] } });
    expect(captured.at(-1)).toEqual({ method: "PATCH", path: `/v1/webhooks/${WEBHOOK_ID}`, body: { channel_account_ids: [CHANNEL_A] } });

    await client.callTool({ name: "update_webhook", arguments: { id: WEBHOOK_ID, channel_account_ids: null } });
    expect(captured.at(-1)?.body).toEqual({ channel_account_ids: null });

    await client.callTool({ name: "update_webhook", arguments: { id: WEBHOOK_ID, active: false } });
    expect(captured.at(-1)?.body).toEqual({ active: false });
  });

  it("rejeita lista vazia ou acima de 100 antes do HTTP", async () => {
    const captured: Captured[] = [];
    const client = await connect(captured);
    const empty = await client.callTool({ name: "update_webhook", arguments: { id: WEBHOOK_ID, channel_account_ids: [] } });
    const tooMany = await client.callTool({
      name: "create_webhook",
      arguments: { url: webhook.url, events: ["messages"], channel_account_ids: Array.from({ length: 101 }, (_, i) => `id-${i}`) },
    });
    expect(empty.isError).toBe(true);
    expect(tooMany.isError).toBe(true);
    expect(captured).toEqual([]);
  });

  it("list, get e update preservam channel_account_ids e channels_health na saída estruturada", async () => {
    const client = await connect([]);
    const list = await client.callTool({ name: "list_webhooks", arguments: {} });
    const get = await client.callTool({ name: "get_webhook", arguments: { id: WEBHOOK_ID } });
    const update = await client.callTool({ name: "update_webhook", arguments: { id: WEBHOOK_ID, active: true } });
    for (const [name, result] of [["list", list], ["get", get], ["update", update]] as const) {
      expect(result.isError, name).not.toBe(true);
      const structured = result.structuredContent as Record<string, any>;
      const endpoint = Array.isArray(structured.data) ? structured.data[0] : structured.data;
      expect(endpoint.channel_account_ids, name).toEqual([CHANNEL_A, CHANNEL_B]);
      expect(endpoint.channels_health, name).toEqual(channelsHealth);
      expect(endpoint).toMatchObject({ health_status: "degraded", failure_streak: 15 });
    }
  });

  it("aceita channel_account_ids null/vazio e webhook sem os campos novos (API anterior)", async () => {
    for (const data of [
      { ...webhook, channel_account_ids: null, channels_health: [] },
      { ...webhook, channel_account_ids: [], channels_health: [] },
      Object.fromEntries(Object.entries(webhook).filter(([k]) => k !== "channel_account_ids" && k !== "channels_health")),
    ]) {
      const client = await connect([], data);
      const get = await client.callTool({ name: "get_webhook", arguments: { id: WEBHOOK_ID } });
      expect(get.isError).not.toBe(true);
      const endpoint = (get.structuredContent as { data: Record<string, unknown> }).data;
      expect(endpoint.channel_account_ids).toEqual(data.channel_account_ids);
    }
  });
});
