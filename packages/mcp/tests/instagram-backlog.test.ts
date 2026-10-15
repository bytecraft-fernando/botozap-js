import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { fullAccessIdentity } from "./helpers/identity.js";
import { cursorPagingFixture } from "./contract-fixtures.js";

const ACCOUNT = "20000000-0000-4000-8000-000000000001";
const RULE = "40000000-0000-4000-8000-000000000001";
const NOW = "2026-10-15T12:00:00Z";
const connection = { status: "active", username: "loja", subscribed_at: NOW, token_expires_at: null, revoked_reason: null, health: "conectado", subscribed_fields: ["messages"],
  diagnostic: { code: "conectado", message: "Conectado", next_step: "Mande um direct", help_url: "/ajuda/comece-aqui/conectar-instagram" } };
const comment = { id: RULE, channel_account_id: ACCOUNT, keyword: null, dm_text: "Oi", reply_text: null, media_id: null, is_active: true, status: "active", paused_by_plan: false, notice: null, created_at: NOW, updated_at: NOW, live: true, require_follow: true, non_follower_text: "Siga e toque de novo" };
const message = { id: RULE, account_id: ACCOUNT, channel_account_id: ACCOUNT, name: "Campanha", trigger: "ref", keywords: [], excluded_keywords: [], story_contains: null, ref: "campanha", ref_link: "https://ig.me/m/loja?ref=campanha", ad_id: null, priority: 100, is_active: true, actions: [{ type: "stage", stage_id: null }], created_at: NOW, updated_at: NOW, require_follow: false, non_follower_text: null };
const followProfile = { ig_follows_business: false, ig_followed_by_business: null, ig_follower_count: 120, ig_verified: false, ig_follow_checked_at: NOW };
const contact = { id: RULE, wa_id: "1784000000001", profile_name: "Ana", phone: null, user_id: null, username: "ana", parent_user_id: null, phone_number_id: null, last_seen_at: null, created_at: NOW, notes: null, metadata: null, stage: null, ...followProfile };
const json = (data: unknown) => Response.json({ data });
const clients: Client[] = [];
afterEach(async () => { await Promise.allSettled(clients.splice(0).map(c => c.close())); vi.unstubAllEnvs(); });
async function connect(responses: Response[] = [], identity: ApiIdentity = fullAccessIdentity) {
  const fetch = vi.fn(async () => { const response = responses.shift(); if (!response) throw Error("requisição inesperada"); return response; });
  const server = await buildServer({ apiKey: "bz_live_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "backlog-test", version: "0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await Promise.all([server.connect(st), client.connect(ct)]); clients.push(client);
  return { client, fetch };
}
const tools = ["get_instagram_connection", "resubscribe_instagram_connection", "disconnect_instagram_connection", "get_message_rule_qr"];
it.each([
  [tools[0]!, "GET", "/connection"], [tools[1]!, "POST", "/connection/resubscribe"], [tools[2]!, "DELETE", "/connection"],
])("%s retorna estado confirmado sem campos privados", async (name, method, suffix) => {
  const { client, fetch } = await connect([json({ ...connection, token: "segredo" })]);
  const result = await client.callTool({ name, arguments: { channel_account_id: ACCOUNT } });
  expect(result.isError).toBeFalsy(); expect(result.structuredContent).toEqual({ data: connection });
  expect(fetch).toHaveBeenCalledWith(`https://api.test/v1/channel_accounts/${ACCOUNT}${suffix}`, expect.objectContaining({ method }));
});
it("get_message_rule_qr retorna link ig.me, imagem PNG e rotas registradas", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
  const { client, fetch } = await connect([json(message), new Response(bytes, { headers: { "Content-Type": "image/png" } })]);
  const result = await client.callTool({ name: "get_message_rule_qr", arguments: { channel_account_id: ACCOUNT, rule_id: RULE } });
  expect(result.isError).toBeFalsy(); expect(result.structuredContent).toEqual({ data: { ref_link: message.ref_link } });
  expect(result.content).toContainEqual({ type: "image", mimeType: "image/png", data: Buffer.from(bytes).toString("base64") });
  expect(fetch.mock.calls.map(call => (call as unknown as [string])[0])).toEqual([
    `https://api.test/v1/channel_accounts/${ACCOUNT}/message-rules/${RULE}`,
    `https://api.test/v1/channel_accounts/${ACCOUNT}/message-rules/${RULE}/qr?format=png`,
  ]);
  expect(TOOL_ROUTES.get_message_rule_qr).toEqual(["GET /v1/channel_accounts/:id/message-rules/:ruleId", "GET /v1/channel_accounts/:id/message-rules/:ruleId/qr"]);
});
it("QR sem ref_link conserva 404 e não devolve imagem", async () => {
  const { client } = await connect([json({ ...message, ref_link: null }), Response.json({ error: { code: "not_found", message: "Sem link" } }, { status: 404 })]);
  const result = await client.callTool({ name: "get_message_rule_qr", arguments: { channel_account_id: ACCOUNT, rule_id: RULE } });
  expect(result.isError).toBe(true); expect(result.structuredContent).toMatchObject({ error: { code: "not_found", status: 404 } });
  expect((result.content as { type: string }[]).some(c => c.type === "image")).toBe(false);
});
it("políticas declaram escopos, sandbox, efeito destrutivo e rotas", async () => {
  expect(MCP_TOOL_POLICIES.get_instagram_connection).toMatchObject({ requiredScopes: ["numbers:read"], sandbox: false, readOnlyHint: true, requiredRoutes: ["GET /v1/channel_accounts/:id/connection"] });
  expect(MCP_TOOL_POLICIES.resubscribe_instagram_connection).toMatchObject({ requiredScopes: ["numbers:write"], sandbox: false, readOnlyHint: false, requiredRoutes: ["POST /v1/channel_accounts/:id/connection/resubscribe"] });
  expect(MCP_TOOL_POLICIES.disconnect_instagram_connection).toMatchObject({ requiredScopes: ["numbers:write"], sandbox: false, destructiveHint: true, requiredRoutes: ["DELETE /v1/channel_accounts/:id/connection"] });
  expect(MCP_TOOL_POLICIES.get_message_rule_qr).toMatchObject({ requiredScopes: ["message-rules:read"], sandbox: true, readOnlyHint: true });
  const { client } = await connect(); const listed = (await client.listTools()).tools;
  expect(listed.find(t => t.name === "disconnect_instagram_connection")?.annotations?.destructiveHint).toBe(true);
  expect(listed.filter(t => tools.includes(t.name))).toMatchSnapshot();
});
it.each(["scopes", "sandbox", "assistant", "routes"])("catálogo e chamadas impedem acesso indevido: %s", async kind => {
  const identity: ApiIdentity = kind === "scopes" ? { ...fullAccessIdentity, scopes: [] }
    : kind === "sandbox" ? { ...fullAccessIdentity, environment: "sandbox" }
    : { ...fullAccessIdentity, auth_type: "oauth", user_id: "operator", grant_id: "grant", client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac", allowed_routes: kind === "routes" ? [] : Object.values(TOOL_ROUTES).flat() };
  if (kind === "routes") vi.stubEnv("BOTOZAP_MCP_OAUTH_CLIENT_PROFILES", "e948ea06-d925-41b6-980c-d7ea3538a4ac:full");
  const { client, fetch } = await connect([], identity); const listed = (await client.listTools()).tools.map(t => t.name);
  for (const name of kind === "sandbox" ? tools.slice(0, 3) : tools) {
    expect(listed).not.toContain(name);
    expect((await client.callTool({ name, arguments: { channel_account_id: ACCOUNT, rule_id: RULE } })).isError).toBe(true);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["comment", "message"])("CRUD %s preserva campos novos em POST/PATCH, GET e listagem", async kind => {
  const record = kind === "comment" ? comment : message;
  const patch = { require_follow: false, non_follower_text: null, ...(kind === "comment" ? { live: false } : {}) };
  const meta = { page: 1, per_page: 20, total_count: 1, total_pages: 1 };
  const { client, fetch } = await connect([json(record), json({ ...record, ...patch }), json(record), Response.json({ data: [record], meta })]);
  const createBody = kind === "comment" ? { dm_text: "Oi", live: true, require_follow: true, non_follower_text: comment.non_follower_text }
    : { name: message.name, trigger: message.trigger, actions: message.actions, require_follow: false, non_follower_text: null };
  for (const [op, fields, expected] of [["create", createBody, { data: record }], ["update", patch, { data: { ...record, ...patch } }], ["get", {}, { data: record }], ["list", {}, { data: [record], meta }]] as const) {
    const name = `${op}_${kind}_rule${op === "list" ? "s" : ""}`;
    const result = await client.callTool({ name, arguments: { channel_account_id: ACCOUNT, ...(["update", "get"].includes(op) ? { rule_id: RULE } : {}), ...fields } });
    expect(result.isError).toBeFalsy(); expect(result.structuredContent).toEqual(expected);
  }
  expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual(createBody);
  expect(JSON.parse((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual(patch);
});
it("métricas retêm posts.live e feature_unavailable é erro estruturado", async () => {
  const counters = { comments_matched: 1, dms_delivered: 0, public_replies: 0, dm_touches: 0, conversations_opened: 0, touch_rate: null };
  const metrics = { rule_id: RULE, channel_account_id: ACCOUNT, from: NOW, to: NOW, totals: counters, posts: [{ ...counters, media_id: null, live: true }] };
  const { client } = await connect([json(metrics), Response.json({ error: { code: "feature_unavailable", message: "Lives indisponíveis" } }, { status: 422 })]);
  expect((await client.callTool({ name: "get_comment_rule_metrics", arguments: { channel_account_id: ACCOUNT, rule_id: RULE, from: NOW, to: NOW } })).structuredContent).toEqual({ data: metrics });
  const failed = await client.callTool({ name: "create_comment_rule", arguments: { channel_account_id: ACCOUNT, dm_text: "Oi", live: true } });
  expect(failed.isError).toBe(true); expect(failed.structuredContent).toMatchObject({ error: { code: "feature_unavailable", status: 422 } });
});
it("contatos mantêm perfil de seguidor também no assistant; filtros preservam false", async () => {
  const identity: ApiIdentity = { ...fullAccessIdentity, auth_type: "oauth", user_id: "operator", grant_id: "grant", client_id: "assistant-client", allowed_routes: Object.values(TOOL_ROUTES).flat() };
  const { client, fetch } = await connect([json(contact), Response.json({ data: [contact], paging: cursorPagingFixture }), Response.json({ data: [], paging: cursorPagingFixture })], identity);
  const got = await client.callTool({ name: "get_contact", arguments: { id: RULE } });
  expect(got.isError).toBeFalsy(); expect(got.structuredContent).toEqual({ data: contact });
  const listed = await client.callTool({ name: "list_contacts", arguments: { ig_follows_business: false } });
  expect(listed.isError).toBeFalsy(); expect(listed.structuredContent).toEqual({ data: [contact], paging: cursorPagingFixture });
  expect((await client.callTool({ name: "list_conversations", arguments: { ig_follows_business: false } })).isError).toBeFalsy();
  for (const call of fetch.mock.calls.slice(1)) expect(new URL((call as unknown as [string])[0]).searchParams.get("ig_follows_business")).toBe("false");
});
