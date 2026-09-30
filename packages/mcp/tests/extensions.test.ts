import { uiContent } from '../src/resources/versioned-ui.js';
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, refreshServerIdentity } from "../src/server.js";
import { CONVERSATION_ID, PHONE_ID, CONTACT_ID, CUSTOMER_ID } from "./contract-fixtures.js";
import { fullAccessIdentity } from "./helpers/identity.js";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => "<!doctype html><title>BotoZap</title>") }));
const clients: Client[] = [];
const customers = { data: [], meta: { page: 1, per_page: 20, total_count: 0, total_pages: 0 } };
const conversation = {
  id: CONVERSATION_ID, phone_number_id: PHONE_ID,
  phone_number_meta_id: "1279498075235551", display_phone_number: "+55 11 99999-9999",
  contact_id: CONTACT_ID, contact: { name: "Contato", phone: "5511999999999", username: null },
  status: "active", window_expires_at: "2026-09-30T12:00:00Z", entry_point: null,
  referral: null, last_message_at: null, last_read_at: null, created_at: "2026-09-29T12:00:00Z",
};
async function connect(uiEnabled = false, identity = fullAccessIdentity, uiCapability: unknown = true) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith(`/conversations/${CONVERSATION_ID}`)) return Response.json({ data: conversation });
    if (path.endsWith(`/phone_numbers/${PHONE_ID}`)) return Response.json({ data: { id: PHONE_ID, customer_id: CUSTOMER_ID } });
    return Response.json(customers);
  });
  const server = await buildServer({ apiKey: "bz_live_secret", baseUrl: "https://api.test/v1", uiEnabled, fetch }, identity);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "extensions-test", version: "1" }, { capabilities: uiCapability !== false ? { extensions: { "io.modelcontextprotocol/ui": { mimeTypes:uiCapability === true ? ["text/html;profile=mcp-app"] : uiCapability } } } as any : {} });
  await Promise.all([server.connect(st), client.connect(ct)]);
  clients.push(client);
  return { client, server, fetch };
}
afterEach(async () => { vi.unstubAllEnvs(); await Promise.allSettled(clients.splice(0).map(c => c.close())); });

describe("optional review extensions", () => {
  it("keeps the catalogue unchanged by default", async () => {
    const { client } = await connect();
    const tools = (await client.listTools()).tools;
    expect(tools.some(t => t.name === "open_review_panel" || t.name === "stage_review_reply")).toBe(false);
    expect(tools.find(t => t.name === "send_message")?._meta).toBeUndefined();
    expect((await client.listResources()).resources.some(r => r.uri.startsWith("ui://"))).toBe(false);
  });
  it("requires negotiated MCP Apps capability, independently of flags", async () => {
    const legacy = await connect(false, fullAccessIdentity, false);
    const unsupported = await connect(true, fullAccessIdentity, false);
    expect((await unsupported.client.listTools()).tools).toEqual((await legacy.client.listTools()).tools);
    expect((await unsupported.client.listResources()).resources).toEqual((await legacy.client.listResources()).resources);
    expect((await unsupported.client.callTool({name:'stage_review_reply',arguments:{conversation_id:CONVERSATION_ID,text:'Oi'}})).isError).toBe(true);
    await expect(unsupported.client.readResource({uri:'ui://botozap/reply/v1.html'})).rejects.toThrow();
    const supported = await connect(true);
    expect((await supported.client.listTools()).tools.some(t=>t.name==='stage_review_reply')).toBe(true);
    expect((await supported.client.listResources()).resources.filter(r=>r.uri.startsWith('ui://'))).toHaveLength(8);
  });
  it.each([{mimeTypes:["text/html"]},{mimeTypes:"text/html;profile=mcp-app"},{mimeTypes:123}])("does not accept missing MIME or malformed capability %j",async ({mimeTypes})=>{
    const h=await connect(true,fullAccessIdentity,mimeTypes);
    expect((await h.client.listTools()).tools.some(t=>t.name==='stage_review_reply')).toBe(false);
    expect((await h.client.listResources()).resources.some(r=>r.uri.startsWith('ui://'))).toBe(false);
  });
  it("limits UI catalogue and resources to explicitly selected account identities", async () => {
    vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS', ` other-account, ${fullAccessIdentity.account_id} `);
    const allowed = await connect(true);
    expect((await allowed.client.listTools()).tools.some(t => t.name === 'stage_review_reply')).toBe(true);
    expect((await allowed.client.listResources()).resources.filter(r => r.uri.startsWith('ui://'))).toHaveLength(8);
    const denied = await connect(true, { ...fullAccessIdentity, account_id: 'not-selected' });
    const baseline = await connect(false, { ...fullAccessIdentity, account_id: 'not-selected' });
    expect((await denied.client.listTools()).tools).toEqual((await baseline.client.listTools()).tools);
    expect((await denied.client.listResources()).resources.some(r => r.uri.startsWith('ui://'))).toBe(false);
    const result = await denied.client.callTool({ name: 'stage_review_reply', arguments: { conversation_id: CONVERSATION_ID, text: 'Olá' } });
    expect(result.isError).toBe(true);
  });
  it("does not enable UI with the account list alone or an empty list", async () => {
    vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS', fullAccessIdentity.account_id);
    const off = await connect(false);
    expect((await off.client.listTools()).tools.some(t => t.name === 'open_review_panel')).toBe(false);
    vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS', ' ');
    const empty = await connect(true);
    expect((await empty.client.listTools()).tools.some(t => t.name === 'open_review_panel')).toBe(false);
    expect((await empty.client.listResources()).resources.some(r => r.uri.startsWith('ui://'))).toBe(false);
  });
  it("removes UI metadata and resources after identity moves out of the pilot", async () => {
    vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS', fullAccessIdentity.account_id);
    const h = await connect(true);
    refreshServerIdentity(h.server, { ...fullAccessIdentity, account_id: 'not-selected' });
    expect((await h.client.listTools()).tools.some(t => t.name === 'open_review_panel')).toBe(false);
    expect((await h.client.listTools()).tools.find(t => t.name === 'list_radar')?._meta).toBeUndefined();
    expect((await h.client.listResources()).resources.some(r => r.uri.startsWith('ui://'))).toBe(false);
  });
  it("advertises a standard app resource and thread entrypoint without credentials", async () => {
    const { client } = await connect(true);
    const tool = (await client.listTools()).tools.find(t => t.name === "open_review_panel");
    expect(tool?._meta).toMatchObject({ ui: { resourceUri: uiContent('review').uri, visibility: ["model", "app"] }, "openai/ui": { entrypoints: [{ type: "thread" }] } });
    const stage = (await client.listTools()).tools.find(t => t.name === "stage_review_reply");
    expect(stage?._meta).toMatchObject({ ui: { resourceUri: uiContent('reply').uri, visibility: ["model", "app"] } });
    expect(tool?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    const replyResource = await client.readResource({ uri: uiContent('reply').uri });
    expect(replyResource.contents[0]._meta).toMatchObject({ "openai/ui": { availableDisplayModes: ["inline", "fullscreen"], preferredDisplayMode: "inline" }, ui: { csp: { connectDomains: [], resourceDomains: [] } } });
    const resource = await client.readResource({ uri: uiContent('review').uri });
    expect(resource.contents[0]._meta).toMatchObject({ "openai/ui": { availableDisplayModes: ["inline", "fullscreen"], preferredDisplayMode: "fullscreen" } });
    expect(resource.contents[0]).toMatchObject({ mimeType: "text/html;profile=mcp-app", _meta: { ui: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [] } } } });
    expect(JSON.stringify(resource)).not.toContain("bz_live_secret");
  });
  it("returns useful structured bootstrap and enforces refreshed authority", async () => {
    const { client, server, fetch } = await connect(true);
    const result = await client.callTool({ name: "open_review_panel", arguments: {} });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    expect(result.structuredContent).toEqual({ account_id: fullAccessIdentity.account_id, environment: "live", customers });
    expect(JSON.stringify(result)).not.toContain("bz_live_secret");
    refreshServerIdentity(server, { ...fullAccessIdentity, scopes: [] });
    expect((await client.listTools()).tools.some(t => t.name === "open_review_panel")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("stages an owned conversation with its derived customer using only reads", async () => {
    const { client, fetch } = await connect(true);
    const result = await client.callTool({ name: "stage_review_reply", arguments: { conversation_id: CONVERSATION_ID, text: "Olá, posso ajudar?" } });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    expect(result.structuredContent).toEqual({ customer_id: CUSTOMER_ID, conversation, draft: { text: "Olá, posso ajudar?", idempotency_key: expect.any(String) } });
    expect(fetch.mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method ?? "GET"]))
      .toEqual([[`/v1/conversations/${CONVERSATION_ID}`, "GET"], [`/v1/phone_numbers/${PHONE_ID}`, "GET"]]);
  });
  it("denies staging when numbers read permission is missing", async () => {
    const { client, fetch } = await connect(true, { ...fullAccessIdentity, scopes: ["conversations:read"] });
    expect((await client.listTools()).tools.map(t => t.name)).not.toContain("stage_review_reply");
    const result = await client.callTool({ name: "stage_review_reply", arguments: { conversation_id: CONVERSATION_ID, text: "Olá" } });
    expect(result.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed for OAuth grants missing the customers route", async () => {
    const identity = { ...fullAccessIdentity, auth_type: "oauth" as const, user_id: "user", client_id: "client", grant_id: "grant", allowed_routes: ["GET /v1/conversations/:id", "GET /v1/phone_numbers/:id"] };
    const { client } = await connect(true, identity);
    const tools = (await client.listTools()).tools.map(t => t.name);
    expect(tools).not.toContain("open_review_panel");
    expect(tools).toContain("stage_review_reply");
    const denied = await connect(true, { ...identity, allowed_routes: ["GET /v1/conversations/:id"] });
    expect((await denied.client.listTools()).tools.map(t => t.name)).not.toContain("stage_review_reply");
  });
});
