import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
const id = "11111111-1111-4111-8111-111111111111",
  clients: Client[] = [];
async function connect(payload: unknown = { data: { id } }, status = 200) {
  const fetch = vi.fn(async () =>
    status === 204
      ? new Response(null, { status })
      : Response.json(payload, { status }),
  );
  const server = buildServer({
    apiKey: "bz_live_fake",
    baseUrl: "https://example.test/v1",
    fetch,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "ai-parity", version: "1" });
  await Promise.all([server.connect(b), client.connect(a)]);
  clients.push(client);
  return { client, fetch };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});
const body = (fetch: ReturnType<typeof vi.fn>, n = 0) =>
  JSON.parse(String(fetch.mock.calls[n]![1]?.body));

it("announces #498 tools with the scope each route requires", async () => {
  const { client } = await connect();
  const tools = (await client.listTools()).tools;
  const find = (name: string) => tools.find((t) => t.name === name)!;
  for (const name of [
    "ai_commercial_proposals_decide",
    "ai_eligibility_save_channel",
    "ai_eligibility_revoke_authorization",
    "ai_inferences_list",
    "ai_operator_metrics",
    "ai_operator_promises",
    "ai_knowledge_sync_catalog",
    "ai_skills_decide_near_miss",
    "ai_providers_sync_catalog",
    "ai_alerts_resolve_bulk",
    "ai_cases_events",
    "ai_notices_effect",
  ])
    expect(find(name), name).toBeDefined();
  expect(find("ai_knowledge_coverage").description).toContain("agents:read");
  expect(find("ai_knowledge_search_diagnostics").description).toContain(
    "agents:read",
  );
  expect(find("ai_knowledge_search").description).toContain("agents:read");
  expect(find("ai_eligibility_save_channel").description).toContain(
    "confirm_open_to_all",
  );
  expect(
    find("ai_eligibility_save_channel").inputSchema.properties,
  ).toHaveProperty("confirm_open_to_all");
});

it.each([
  [
    "ai_commercial_proposals_decide",
    { customer_id: id, id, decision: "approve" },
  ],
  [
    "ai_commercial_proposals_request",
    { customer_id: id, opportunity_id: id, request_key: "has space" },
  ],
  ["ai_alerts_resolve_bulk", { customer_id: id, filters: { status: "resolved" } }],
  [
    "ai_eligibility_save_channel",
    {
      customer_id: id,
      id,
      expected_revision: "1",
      mode: "everyone",
      test_phone_numbers: [],
    },
  ],
  [
    "ai_skills_decide_near_miss",
    { customer_id: id, id, expected_revision: 3, decision: "accept" },
  ],
  [
    "ai_knowledge_sync_catalog",
    { customer_id: id, id, event_key: "e1", integration: "Loja Virtual" },
  ],
])("rejects incomplete or unsafe %s before HTTP", async (name, args) => {
  const { client, fetch } = await connect();
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});

it("forwards open-to-all confirmation only when the caller sends it", async () => {
  const { client, fetch } = await connect({ data: { mode: "open" } });
  const args = {
    customer_id: id,
    id,
    expected_revision: "7",
    mode: "open",
    test_phone_numbers: [],
  };
  await client.callTool({ name: "ai_eligibility_save_channel", arguments: args });
  expect(body(fetch)).not.toHaveProperty("confirm_open_to_all");
  await client.callTool({
    name: "ai_eligibility_save_channel",
    arguments: { ...args, confirm_open_to_all: true },
  });
  expect(body(fetch, 1)).toEqual({
    customer_id: id,
    expected_revision: "7",
    mode: "open",
    test_phone_numbers: [],
    confirm_open_to_all: true,
  });
});

it("returns structured success for bodyless revocation", async () => {
  const { client, fetch } = await connect(undefined, 204);
  const result = await client.callTool({
    name: "ai_eligibility_revoke_authorization",
    arguments: { customer_id: id, id },
  });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toEqual({ success: true });
  expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
});

it("keeps inference summary in structured offset output", async () => {
  const page = {
    data: [],
    meta: {
      page: 1,
      per_page: 20,
      total_count: 0,
      total_pages: 0,
      summary: { failures: [], points: [] },
    },
  };
  const { client } = await connect(page);
  const result = await client.callTool({
    name: "ai_inferences_list",
    arguments: { customer_id: id, purpose: "evaluator", outcome: "unknown" },
  });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toEqual(page);
});

it("accepts #498 agent configuration and granular binding purposes", async () => {
  const { client, fetch } = await connect({
    data: { agent_id: id, version_id: id, revision: "2" },
  });
  const config = {
    tool_ids: ["knowledge.search", "crm.search", "cases.close"],
    platform_skills: "all",
    data_access: { other_contacts: true },
    accountability: { enabled: true, classification: false },
    safety: {
      additional_rules: ["Nunca prometa prazo sem conferir a agenda."],
      disclosure_text: "Sou a assistente virtual.",
      commercial_limits: {
        min_price_brl: 100,
        max_discount_percent: 10,
        max_installments: null,
      },
      guard_sensitivity: "strict",
      semantic_evaluator: true,
    },
  };
  const saved = await client.callTool({
    name: "ai_agents_create",
    arguments: { customer_id: id, name: "Agente", config },
  });
  expect(saved.isError).not.toBe(true);
  expect(body(fetch).config).toEqual(config);
  const binding = await client.callTool({
    name: "ai_providers_save_binding",
    arguments: {
      customer_id: id,
      purpose: "vision",
      provider: "openai",
      model: "gpt-4.1-mini",
      credential_id: id,
    },
  });
  expect(binding.isError).not.toBe(true);
  expect(body(fetch, 1).purpose).toBe("vision");
  const owned = await client.callTool({
    name: "ai_providers_save_binding",
    arguments: {
      customer_id: id,
      purpose: "agent_turn",
      provider: "openai",
      model: "gpt-4.1-mini",
      credential_id: id,
    },
  });
  expect(owned.isError).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});
