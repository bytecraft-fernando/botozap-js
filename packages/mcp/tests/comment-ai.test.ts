import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { fullAccessIdentity } from "./helpers/identity.js";
const CHANNEL = "20000000-0000-4000-8000-000000000001", AGENT = "30000000-0000-4000-8000-000000000001";
const summary = { enabled: false, agent_id: null, daily_limit: 50, status: "inactive", answered_today: 2, reserved_today: 3, timezone: "America/Sao_Paulo", gate_mode: "pre_go_live", readiness: ["Escolha um agente publicado."] };
const run = { id: AGENT, comment_id: "1789", comment_text: null, author_username: null, media_id: null, execution_id: null, status: "skipped", action: null, reason: "rule_won", reason_message: "Regra tem prioridade", reply_text: null, dm_status: "skipped", reply_status: "skipped", created_at: "2026-10-15T12:00:00Z", completed_at: null };
const names = ["get_instagram_comment_ai", "update_instagram_comment_ai", "list_instagram_comment_ai_runs"];
const clients: Client[] = [];
afterEach(async () => { await Promise.allSettled(clients.splice(0).map(c => c.close())); vi.unstubAllEnvs(); });
async function connect(responses: Response[] = [], identity: ApiIdentity = fullAccessIdentity) {
  const fetch = vi.fn(async () => { const response = responses.shift(); if (!response) throw Error("requisição inesperada"); return response; });
  const server = await buildServer({ apiKey: "bz_live_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "comment-ai-test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(st), client.connect(ct)]); clients.push(client);
  return { client, fetch };
}
it("catálogo completo anuncia schemas, rotas, escopos e efeito público; assistant permanece excluído", async () => {
  const { client } = await connect(); const tools = (await client.listTools()).tools.filter(t => names.includes(t.name));
  expect(tools).toHaveLength(3); expect(tools).toMatchSnapshot();
  for (const name of names) expect(ASSISTANT_TOOLS.has(name)).toBe(false);
  for (const name of [names[0]!, names[2]!]) expect(MCP_TOOL_POLICIES[name]).toMatchObject({ requiredScopes: ["agents:read"], sandbox: false, readOnlyHint: true, destructiveHint: false, openWorldHint: false });
  expect(MCP_TOOL_POLICIES.update_instagram_comment_ai).toMatchObject({ requiredScopes: ["agents:write"], sandbox: false, readOnlyHint: false, destructiveHint: true, openWorldHint: true, requiredRoutes: ["PATCH /v1/channel_accounts/:id/comment-ai"] });
  expect(TOOL_ROUTES.get_instagram_comment_ai).toEqual(["GET /v1/channel_accounts/:id/comment-ai"]);
  expect(TOOL_ROUTES.list_instagram_comment_ai_runs).toEqual(["GET /v1/channel_accounts/:id/comment-ai/runs"]);
});
it("get e runs preservam todos os campos públicos e removem campos privados", async () => {
  const meta = { page: 2, per_page: 30, total_count: 31, total_pages: 2 };
  const { client, fetch } = await connect([Response.json({ data: { ...summary, token: "secret" } }), Response.json({ data: [{ ...run, claim_token: "private", author_id: "igsid" }], meta })]);
  const got = await client.callTool({ name: names[0]!, arguments: { channel_account_id: CHANNEL } });
  expect(got.isError).toBeFalsy(); expect(got.structuredContent).toEqual({ data: summary });
  const listed = await client.callTool({ name: names[2]!, arguments: { channel_account_id: CHANNEL, page: 2, per_page: 30 } });
  expect(listed.isError).toBeFalsy(); expect(listed.structuredContent).toEqual({ data: [run], meta });
  expect(fetch).toHaveBeenNthCalledWith(1, `https://api.test/v1/channel_accounts/${CHANNEL}/comment-ai`, expect.objectContaining({ method: "GET" }));
  expect(fetch).toHaveBeenNthCalledWith(2, `https://api.test/v1/channel_accounts/${CHANNEL}/comment-ai/runs?page=2&per_page=30`, expect.objectContaining({ method: "GET" }));
});
it.each([{ enabled: false }, { agent_id: null }, { enabled: true, agent_id: AGENT, daily_limit: 200 }, { daily_limit: 1 }])("PATCH parcial: %j", async patch => {
  const { client, fetch } = await connect([Response.json({ data: summary })]);
  const result = await client.callTool({ name: names[1]!, arguments: { channel_account_id: CHANNEL, ...patch } });
  expect(result.isError).toBeFalsy(); expect(result.structuredContent).toEqual({ data: summary });
  expect(fetch).toHaveBeenCalledWith(`https://api.test/v1/channel_accounts/${CHANNEL}/comment-ai`, expect.objectContaining({ method: "PATCH", body: JSON.stringify(patch) }));
});
it.each([{}, { enabled: "true" }, { agent_id: "invalid" }, { daily_limit: 0 }, { daily_limit: 201 }, { daily_limit: 1.5 }])("rejeita patch vazio ou inválido antes do HTTP: %j", async patch => {
  const { client, fetch } = await connect();
  expect((await client.callTool({ name: names[1]!, arguments: { channel_account_id: CHANNEL, ...patch } })).isError).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["scopes", "sandbox", "assistant", "routes", "oauth-read-only"])("catálogo e chamadas respeitam limite de acesso: %s", async kind => {
  const clientId = "e948ea06-d925-41b6-980c-d7ea3538a4ac";
  const identity: ApiIdentity = kind === "scopes" ? { ...fullAccessIdentity, scopes: [] }
    : kind === "sandbox" ? { ...fullAccessIdentity, environment: "sandbox" }
    : { ...fullAccessIdentity, auth_type: "oauth", user_id: "operator", grant_id: "grant", client_id: clientId,
      allowed_routes: kind === "routes" ? [] : kind === "oauth-read-only" ? ["GET /v1/channel_accounts/:id/comment-ai", "GET /v1/channel_accounts/:id/comment-ai/runs"] : Object.values(TOOL_ROUTES).flat() };
  if (kind === "routes" || kind === "oauth-read-only") vi.stubEnv("BOTOZAP_MCP_OAUTH_CLIENT_PROFILES", `${clientId}:full`);
  const { client, fetch } = await connect([], identity); const listed = (await client.listTools()).tools.map(t => t.name);
  for (const name of kind === "oauth-read-only" ? [names[1]!] : names) {
    expect(listed).not.toContain(name);
    expect((await client.callTool({ name, arguments: { channel_account_id: CHANNEL, enabled: true } })).isError).toBe(true);
  }
  if (kind === "oauth-read-only") { expect(listed).toContain(names[0]); expect(listed).toContain(names[2]); }
  expect(fetch).not.toHaveBeenCalled();
});
it.each([[404, "not_found"], [422, "plan_restricted"], [422, "agent_unavailable"], [422, "credential_unavailable"], [403, "forbidden"]])("preserva erro estruturado %s %s", async (status, code) => {
  const { client } = await connect([Response.json({ error: { code, message: "Indisponível" } }, { status: Number(status) })]);
  const result = await client.callTool({ name: names[1]!, arguments: { channel_account_id: CHANNEL, enabled: true } });
  expect(result.isError).toBe(true); expect(result.structuredContent).toMatchObject({ error: { status, code } });
});
