import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { assertToolHints, MCP_TOOL_POLICIES } from "../src/permissions.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { fullAccessIdentity } from "./helpers/identity.js";

vi.mock("node:fs/promises", async (original) => ({
  ...(await original<any>()),
  readFile: vi.fn(async () => '<main id="app"></main>'),
}));

const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const;
const clientId = "e948ea06-d925-41b6-980c-d7ea3538a4ac";
const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
const oauth: ApiIdentity = {
  ...fullAccessIdentity, auth_type: "oauth", client_id: clientId,
  user_id: "operator", grant_id: "grant", allowed_routes: routes,
};
const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((c) => c.close()));
  vi.unstubAllEnvs();
});

async function listTools(identity: ApiIdentity, ui: boolean) {
  const fetch = vi.fn(async () => Response.json({ data: [] }));
  const server = await buildServer({ apiKey: "bz_live_test", baseUrl: "https://api.test/v1", uiEnabled: ui, fetch }, identity);
  const client = new Client({ name: "annotations", version: "1" }, {
    capabilities: ui ? { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } as any : {},
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  clients.push(client);
  return (await client.listTools()).tools;
}

type Hints = [readOnly: 0 | 1, destructive: 0 | 1, idempotent: 0 | 1, openWorld: 0 | 1];
/**
 * Reviewed annotations of the OAuth "assistant" catalog (the ChatGPT app).
 * Changing a value here must come with an updated justification for the
 * OpenAI submission form; the test makes such changes deliberate.
 */
const ASSISTANT_EXPECTED: Record<string, Hints> = {
  get_profile: [1, 0, 1, 0],
  get_channel_account: [1, 0, 1, 0],
  open_botozap: [1, 0, 1, 0],
  list_radar: [1, 0, 1, 0],
  open_review_panel: [1, 0, 1, 0],
  stage_review_reply: [1, 0, 1, 0],
  stage_review_template: [1, 0, 1, 0],
  review_template_variables: [1, 0, 1, 0],
  open_agent_cases: [1, 0, 1, 0],
  stage_appointment_booking: [1, 0, 1, 0],
  open_live_conversation: [1, 0, 1, 0],
  list_customers: [1, 0, 1, 0],
  get_customer: [1, 0, 1, 0],
  list_conversations: [1, 0, 1, 0],
  get_conversation: [1, 0, 1, 0],
  list_messages: [1, 0, 1, 0],
  get_message: [1, 0, 1, 0],
  list_contacts: [1, 0, 1, 0],
  get_contact: [1, 0, 1, 0],
  list_templates: [1, 0, 1, 0],
  get_template: [1, 0, 1, 0],
  list_phone_numbers: [1, 0, 1, 0],
  get_phone_number: [1, 0, 1, 0],
  list_appointments: [1, 0, 1, 0],
  get_appointment: [1, 0, 1, 0],
  get_appointment_availability: [1, 0, 1, 0],
  list_appointment_services: [1, 0, 1, 0],
  get_opportunity: [1, 0, 1, 0],
  get_demand: [1, 0, 1, 0],
  list_opportunity_conversations: [1, 0, 1, 0],
  list_demand_conversations: [1, 0, 1, 0],
  ai_cases_list: [1, 0, 1, 0],
  ai_cases_get: [1, 0, 1, 0],
  ai_alerts_list: [1, 0, 1, 0],
  list_users: [1, 0, 1, 0],
  prepare_send_intent: [1, 0, 1, 0],
  send_message: [0, 1, 0, 1],
  reply_to_conversation: [0, 1, 0, 1],
  create_template: [0, 0, 1, 1],
  create_appointment: [0, 1, 0, 1],
  update_appointment: [0, 1, 0, 1],
  control_conversation_agent: [0, 1, 1, 1],
  ai_cases_update: [0, 1, 1, 1],
  ai_alerts_update: [0, 0, 1, 0],
};

function expectExplicitHints(tools: Awaited<ReturnType<typeof listTools>>) {
  expect(tools.length).toBeGreaterThan(0);
  for (const tool of tools) {
    const annotations = tool.annotations as Record<string, unknown> | undefined;
    for (const hint of HINTS) expect(typeof annotations?.[hint], `${tool.name}.${hint}`).toBe("boolean");
    if (annotations?.readOnlyHint) {
      expect(annotations.destructiveHint, `${tool.name}: leitura não destrói`).toBe(false);
      expect(annotations.idempotentHint, `${tool.name}: leitura é idempotente`).toBe(true);
    }
    if (annotations?.destructiveHint) expect(annotations.readOnlyHint, tool.name).toBe(false);
  }
}

describe("anotações MCP explícitas", () => {
  it("every policy declares four coherent boolean hints", () => {
    for (const [name, policy] of Object.entries(MCP_TOOL_POLICIES)) {
      expect(() => assertToolHints(name, policy), name).not.toThrow();
    }
  });

  it("rejects a missing, null or incoherent hint", () => {
    const ok = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
    expect(() => assertToolHints("x", { ...ok, idempotentHint: undefined as unknown as boolean })).toThrow(/idempotentHint/);
    expect(() => assertToolHints("x", { ...ok, openWorldHint: null as unknown as boolean })).toThrow(/openWorldHint/);
    expect(() => assertToolHints("x", { ...ok, readOnlyHint: true, destructiveHint: true, idempotentHint: true })).toThrow(/destructiveHint/);
    expect(() => assertToolHints("x", { ...ok, readOnlyHint: true })).toThrow(/idempotente/);
  });

  it.each([[true], [false]])("full catalog (API key, UI=%s) publishes the four hints on every tool", async (ui) => {
    const tools = await listTools(fullAccessIdentity, ui);
    expectExplicitHints(tools);
    expect(tools.length).toBeGreaterThan(200);
    for (const tool of tools) {
      if (tool.name === "get_profile") continue;
      const policy = MCP_TOOL_POLICIES[tool.name]!;
      expect(tool.annotations, tool.name).toEqual({
        readOnlyHint: policy.readOnlyHint, destructiveHint: policy.destructiveHint,
        idempotentHint: policy.idempotentHint, openWorldHint: policy.openWorldHint,
      });
    }
  });

  it("assistant catalog (OAuth/ChatGPT) publishes the reviewed hints", async () => {
    vi.stubEnv("BOTOZAP_MCP_OAUTH_CLIENT_PROFILES", `${clientId}:assistant`);
    const tools = await listTools(oauth, true);
    expectExplicitHints(tools);
    expect(new Set(tools.map((t) => t.name))).toEqual(ASSISTANT_TOOLS);
    expect(Object.keys(ASSISTANT_EXPECTED).sort()).toEqual([...ASSISTANT_TOOLS].sort());
    for (const tool of tools) {
      const [readOnlyHint, destructiveHint, idempotentHint, openWorldHint] = ASSISTANT_EXPECTED[tool.name]!.map(Boolean);
      expect(tool.annotations, tool.name).toEqual({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint });
    }
  });
});
