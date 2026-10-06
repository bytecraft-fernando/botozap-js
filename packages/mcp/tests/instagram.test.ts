import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const BASE_URL = "https://api.test/v1";
const IGSID = "17841400000000123";
const ACCOUNT = "20000000-0000-4000-8000-000000000001";
const CONVERSATION = "30000000-0000-4000-8000-000000000001";
const RULE = "40000000-0000-4000-8000-000000000001";
const CUSTOMER = "50000000-0000-4000-8000-000000000001";
const NOW = "2026-10-06T12:00:00Z";
const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((c) => c.close()));
  vi.unstubAllEnvs();
});

type Call = { method: string; path: string; body: unknown };
async function connect(responses: unknown[], identity: ApiIdentity = fullAccessIdentity, ui = false) {
  const calls: Call[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ method: init?.method ?? "GET", path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift() as { status?: number; body: unknown } | undefined;
    if (!next) throw new Error(`requisição inesperada ${url}`);
    return Response.json(next.body, { status: next.status ?? 200 });
  }) as typeof globalThis.fetch;
  const server = await buildServer({ apiKey: "bz_live_instagram_mcp", baseUrl: BASE_URL, fetch, uiEnabled: ui }, identity);
  const client = new Client({ name: "instagram-test", version: "0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  clients.push(client);
  return { client, calls };
}

const igReceipt = (type = "text") => ({
  id: "10000000-0000-4000-8000-000000000001",
  wamid: null,
  external_id: "aWdEZ...mlk",
  channel: "instagram",
  type,
  to: IGSID,
  sent_to: IGSID,
  status: "sent",
});
const meta = { page: 1, per_page: 20, total_pages: 1, total_count: 1 };
const rule = {
  id: RULE, channel_account_id: ACCOUNT, keyword: "preço", dm_text: "Oi!", reply_text: null, media_id: null,
  is_active: true, status: "active", paused_by_plan: false, notice: null, created_at: NOW, updated_at: NOW,
};

describe("MCP — Instagram", () => {
  it("send_message aceita o recibo do Instagram sem violar o output schema", async () => {
    const { client } = await connect([{ status: 201, body: igReceipt() }]);
    const result = await client.callTool({ name: "send_message", arguments: { to: IGSID, type: "text", text: { body: "Oi" } } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ wamid: null, external_id: "aWdEZ...mlk", channel: "instagram", type: "text" });
  });

  it("send_message aceita a reação do Instagram (alvo é mid, sem wamid)", async () => {
    const { client } = await connect([{ body: {
      id: null, wamid: null, external_id: "mid.alvo", channel: "instagram", to: IGSID, sent_to: IGSID, status: "sent",
      reaction: { message_id: "mid.alvo", emoji: "❤️", action: "react" },
    } }]);
    const result = await client.callTool({ name: "send_message", arguments: { to: IGSID, type: "reaction", reaction: { message_id: "mid.alvo", emoji: "❤️" } } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ reaction: { message_id: "mid.alvo", action: "react" } });
  });

  it("send_media_message envia para IGSID e aceita o recibo", async () => {
    const { client, calls } = await connect([{ status: 201, body: igReceipt("image") }]);
    const result = await client.callTool({ name: "send_media_message", arguments: { to: IGSID, from: ACCOUNT, type: "image", link: "https://cdn.test/a.jpg" } });
    expect(result.isError).toBeFalsy();
    expect(calls[0]!.body).toEqual({ to: IGSID, from: ACCOUNT, type: "image", image: { link: "https://cdn.test/a.jpg" } });
  });

  it("reply_to_conversation responde pelo Instagram com a Conta de canal como origem", async () => {
    const { client, calls } = await connect([
      { body: { data: { id: CONVERSATION, channel: "instagram", channel_account: { id: ACCOUNT, channel: "instagram", display: "@loja" }, phone_number_id: null, contact: { wa_id: IGSID, phone: null } } } },
      { status: 201, body: igReceipt() },
    ]);
    const result = await client.callTool({ name: "reply_to_conversation", arguments: { conversation_id: CONVERSATION, text: { body: "Olá!" } } });
    expect(result.isError).toBeFalsy();
    expect(calls[1]!.body).toMatchObject({ to: IGSID, from: ACCOUNT, type: "text" });
    expect(result.structuredContent).toMatchObject({ external_id: "aWdEZ...mlk" });
  });

  it("recibo sem wamid nem external_id continua erro", async () => {
    const { client } = await connect([{ status: 201, body: { id: null, wamid: null, channel: "instagram", to: IGSID, status: "sent" } }]);
    const result = await client.callTool({ name: "send_message", arguments: { to: IGSID, type: "text", text: { body: "Oi" } } });
    expect(result.isError).toBe(true);
  });

  it("list_channel_accounts, get_channel_account e Regras de comentário usam as rotas /v1", async () => {
    const account = { id: ACCOUNT, channel: "instagram", customer_id: CUSTOMER, display: "@loja", status: "active", sandbox: false, external_id: "17841400000000999", created_at: NOW, updated_at: NOW,
      instagram: { instagram_account_id: "17841400000000999", username: "loja", name: "Loja", instagram_connection_id: CUSTOMER, connection_status: "active", token_status: "expiring", token_expires_at: NOW, token_refreshed_at: null } };
    const { client, calls } = await connect([
      { body: { data: [account], meta } },
      { body: { data: account } },
      { body: { data: [rule], meta } },
      { body: { data: rule } },
      { status: 201, body: { data: rule } },
      { body: { data: { ...rule, is_active: false, status: "inactive" } } },
    ]);
    const results = [
      await client.callTool({ name: "list_channel_accounts", arguments: { channel: "instagram" } }),
      await client.callTool({ name: "get_channel_account", arguments: { id: ACCOUNT } }),
      await client.callTool({ name: "list_comment_rules", arguments: { channel_account_id: ACCOUNT } }),
      await client.callTool({ name: "get_comment_rule", arguments: { channel_account_id: ACCOUNT, rule_id: RULE } }),
      await client.callTool({ name: "create_comment_rule", arguments: { channel_account_id: ACCOUNT, keyword: "preço", dm_text: "Oi!" } }),
      await client.callTool({ name: "update_comment_rule", arguments: { channel_account_id: ACCOUNT, rule_id: RULE, is_active: false } }),
    ];
    for (const r of results) expect(r.isError, JSON.stringify(r.content)).toBeFalsy();
    expect((results[0]!.structuredContent as any).data[0].instagram).toEqual(account.instagram);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /v1/channel_accounts?channel=instagram",
      `GET /v1/channel_accounts/${ACCOUNT}`,
      `GET /v1/channel_accounts/${ACCOUNT}/comment-rules`,
      `GET /v1/channel_accounts/${ACCOUNT}/comment-rules/${RULE}`,
      `POST /v1/channel_accounts/${ACCOUNT}/comment-rules`,
      `PATCH /v1/channel_accounts/${ACCOUNT}/comment-rules/${RULE}`,
    ]);
    expect(calls[4]!.body).toEqual({ keyword: "preço", dm_text: "Oi!" });
    expect(calls[5]!.body).toEqual({ is_active: false });
  });

  it("update_comment_rule sem campos falha antes do HTTP", async () => {
    const { client, calls } = await connect([]);
    const result = await client.callTool({ name: "update_comment_rule", arguments: { channel_account_id: ACCOUNT, rule_id: RULE } });
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("as tools novas ficam fora do perfil assistant e get_channel_account segue só com UI nele", async () => {
    for (const name of ["list_channel_accounts", "list_comment_rules", "get_comment_rule", "create_comment_rule", "update_comment_rule"]) {
      expect(ASSISTANT_TOOLS.has(name), name).toBe(false);
      expect(MCP_TOOL_POLICIES[name], name).toBeDefined();
    }
    const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
    const oauth: ApiIdentity = { ...fullAccessIdentity, auth_type: "oauth", client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac", user_id: "u", grant_id: "g", allowed_routes: routes };
    const { client } = await connect([], oauth, false);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("get_channel_account");
    expect(names).not.toContain("list_channel_accounts");
    expect(names.every((n) => ASSISTANT_TOOLS.has(n))).toBe(true);
    const full = await connect([], fullAccessIdentity, false);
    expect((await full.client.listTools()).tools.map((t) => t.name)).toContain("get_channel_account");
  });
});
