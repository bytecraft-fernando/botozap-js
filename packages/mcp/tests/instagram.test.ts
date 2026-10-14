import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { messageFixture, cursorPagingFixture } from "./contract-fixtures.js";
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
  const keys: Array<string | null> = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key"));
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
  return { client, calls, keys };
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

const igButtons = [
  { type: "web_url", title: "Ver loja", url: "https://loja.test" },
  { type: "postback", title: "Preço", payload: "preco" },
];
const igCard = { title: "Produto", subtitle: "Descrição", image_url: "https://loja.test/p.jpg",
  default_action: { type: "web_url", url: "https://loja.test/p" }, buttons: igButtons };
const igInteractiveCases = [
  { type: "button", body: { text: "Escolha:" }, action: { buttons: igButtons } },
  { type: "generic", elements: [igCard] },
  { type: "generic", elements: Array.from({ length: 10 }, (_, i) => ({ ...igCard, title: `Produto ${i}` })) },
];
const extendedFields = { keywords: ["preço", "valor"], excluded_keywords: ["não quero"],
  reply_variations: ["Te chamei!", "Veja o direct!"], next_post: true };
const extendedRule = { ...rule, ...extendedFields, next_post_activated_at: NOW };
const messengerProfile = { channel_account_id: ACCOUNT, config: { ice_breakers: [{ question: "Horários?", payload: "horarios" }],
  persistent_menu: igButtons }, revision: 1, sync_status: "synced", synced_at: NOW, last_error_code: null, updated_at: NOW };
const profileTools = [
  ["get_instagram_messenger_profile", "GET", "", {}],
  ["update_instagram_messenger_profile", "PATCH", "", { ice_breakers: null }],
  ["delete_instagram_messenger_profile", "DELETE", "", {}],
  ["sync_instagram_messenger_profile", "POST", "/sync", {}],
] as const;

describe("MCP — paridade Instagram onda 1", () => {
  it.each(igInteractiveCases)("send_message conserva button/card/gallery e o recibo: $type", async (interactive) => {
    const { client, calls, keys } = await connect([{ status: 201, body: igReceipt("interactive") }]);
    const result = await client.callTool({ name: "send_message", arguments: { to: IGSID, from: ACCOUNT, type: "interactive",
      interactive, tag: "human_agent", idempotency_key: CUSTOMER } });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(keys).toEqual([CUSTOMER]);
    expect(result.structuredContent).toMatchObject({ wamid: null, external_id: "aWdEZ...mlk", channel: "instagram", type: "interactive" });
    expect(calls[0]).toEqual({ method: "POST", path: "/v1/messages",
      body: { to: IGSID, from: ACCOUNT, type: "interactive", interactive, tag: "human_agent" } });
  });

  it("list/get/create/update retornam os campos novos e delete retorna {id,deleted}", async () => {
    const { client, calls } = await connect([
      { body: { data: [extendedRule], meta } },
      ...Array.from({ length: 3 }, () => ({ body: { data: extendedRule } })),
      { body: { data: { id: RULE, deleted: true } } },
    ]);
    const tools = [
      ["list_comment_rules", {}], ["get_comment_rule", { rule_id: RULE }],
      ["create_comment_rule", { dm_text: "Oi!", ...extendedFields }],
      ["update_comment_rule", { rule_id: RULE, ...extendedFields }],
      ["delete_comment_rule", { rule_id: RULE }],
    ] as const;
    for (const [name, args] of tools) {
      const result = await client.callTool({ name, arguments: { channel_account_id: ACCOUNT, ...args } });
      expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
      expect((result.structuredContent as any).data).toEqual(name === "list_comment_rules" ? [extendedRule]
        : name === "delete_comment_rule" ? { id: RULE, deleted: true } : extendedRule);
    }
    expect(calls[2]!.body).toEqual({ dm_text: "Oi!", ...extendedFields });
    expect(calls[3]!.body).toEqual(extendedFields);
    expect(calls[4]).toEqual({ method: "DELETE", path: `/v1/channel_accounts/${ACCOUNT}/comment-rules/${RULE}`, body: undefined });
  });

  it.each(profileTools)("%s usa a rota e o snapshot canônicos", async (name, method, suffix, patch) => {
    const { client, calls } = await connect([{ body: { data: messengerProfile } }]);
    const result = await client.callTool({ name, arguments: { channel_account_id: ACCOUNT, ...patch } });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: messengerProfile });
    expect(calls).toEqual([{ method, path: `/v1/channel_accounts/${ACCOUNT}/messenger-profile${suffix}`,
      body: method === "PATCH" ? patch : undefined }]);
  });

  it("update do perfil conserva [] e as duas formas de menu", async () => {
    const { client, calls } = await connect([{ body: { data: messengerProfile } }]);
    const patch = { ice_breakers: [], persistent_menu: igButtons };
    const result = await client.callTool({ name: "update_instagram_messenger_profile", arguments: { channel_account_id: ACCOUNT, ...patch } });
    expect(result.isError).toBeFalsy();
    expect(calls[0]!.body).toEqual(patch);
  });

  it("update vazio e tag inválida falham antes do HTTP", async () => {
    const { client, calls } = await connect([]);
    const result = await client.callTool({ name: "update_instagram_messenger_profile", arguments: { channel_account_id: ACCOUNT } });
    expect(result.isError).toBe(true);
    const tag = await client.callTool({ name: "send_message", arguments: { to: IGSID, type: "interactive", interactive: igInteractiveCases[0], tag: "invalid" } });
    expect(tag.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  const errorTools = [
    ["send_message", { to: IGSID, from: ACCOUNT, type: "interactive", interactive: igInteractiveCases[0] }],
    ["list_comment_rules", { channel_account_id: ACCOUNT }],
    ["get_comment_rule", { channel_account_id: ACCOUNT, rule_id: RULE }],
    ["create_comment_rule", { channel_account_id: ACCOUNT, dm_text: "Oi!", ...extendedFields }],
    ["update_comment_rule", { channel_account_id: ACCOUNT, rule_id: RULE, ...extendedFields }],
    ["delete_comment_rule", { channel_account_id: ACCOUNT, rule_id: RULE }],
    ...profileTools.map(([name, , , patch]) => [name, { channel_account_id: ACCOUNT, ...patch }] as const),
  ] as const;
  it.each(errorTools)("%s expõe erro 422 estruturado", async (name, args) => {
    const { client } = await connect([{ status: 422, body: { error: { code: "invalid_request", message: "Contrato inválido" } } }]);
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: "invalid_request", status: 422 } });
  });

  it("descoberta obedece scopes, sandbox e perfil assistant", async () => {
    const names = profileTools.map(([name]) => name);
    for (const name of names) expect(ASSISTANT_TOOLS.has(name)).toBe(false);
    const reader = await connect([], { ...fullAccessIdentity, scopes: ["messenger-profile:read"] });
    expect((await reader.client.listTools()).tools.map((t) => t.name)).toContain(names[0]);
    expect((await reader.client.listTools()).tools.map((t) => t.name)).not.toContain(names[1]);
    const writer = await connect([], { ...fullAccessIdentity, scopes: ["messenger-profile:write"] });
    const writerNames = (await writer.client.listTools()).tools.map((t) => t.name);
    expect(writerNames).not.toContain(names[0]);
    for (const name of names.slice(1)) expect(writerNames).toContain(name);
    const sandbox = await connect([], { ...fullAccessIdentity, environment: "sandbox" });
    const sandboxNames = (await sandbox.client.listTools()).tools.map((t) => t.name);
    for (const name of names) expect(sandboxNames).not.toContain(name);
    expect(sandboxNames).toContain("delete_comment_rule");
    for (const [name, method, suffix] of profileTools) {
      expect(MCP_TOOL_POLICIES[name]!.requiredRoutes).toEqual([`${method} /v1/channel_accounts/:id/messenger-profile${suffix}`]);
    }
  });

  it("tools/list anuncia o schema Instagram e tag em send_message", async () => {
    const { client } = await connect([]);
    const tool = (await client.listTools()).tools.find((t) => t.name === "send_message")!;
    const schema = JSON.stringify(tool.inputSchema);
    expect(schema).toContain("generic");
    expect(schema).toContain("default_action");
    expect(schema).toContain("human_agent");
    expect(schema).toContain("postback");
  });
});

const whatsappInteractiveCases = [
  { type: "button", body: { text: "Confirma?" }, action: { buttons: [{ type: "reply", reply: { id: "sim", title: "Sim" } }] } },
  { type: "list", body: { text: "Escolha" }, action: { button: "Opções", sections: [{ rows: [{ id: "1", title: "Primeira" }] }] } },
  { type: "cta_url", body: { text: "Ver loja" }, action: { name: "cta_url", parameters: { display_text: "Abrir", url: "https://loja.test" } } },
];
it.each(whatsappInteractiveCases)("send_message mantém interactive WhatsApp $type", async (interactive) => {
  const { client, calls } = await connect([{ status: 201, body: { id: null, wamid: "wamid.wa", to: "5511", status: "sent" } }]);
  const result = await client.callTool({ name: "send_message", arguments: { to: "5511", type: "interactive", interactive } });
  expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
  expect(calls[0]!.body).toEqual({ to: "5511", type: "interactive", interactive });
});

it("list_messages/get_message conservam cards e contexto do postback", async () => {
  const context = { quick_reply: { payload: "preco" }, postback: { title: "Preço", payload: "preco" } };
  const message = { ...messageFixture, channel: "instagram", external_id: "mid.1", wamid: null, phone_number_id: null,
    type: "interactive", content: igInteractiveCases[1], context };
  const { client } = await connect([{ body: { data: [message], paging: cursorPagingFixture } }, { body: { data: message } }]);
  const listed = await client.callTool({ name: "list_messages", arguments: {} });
  const found = await client.callTool({ name: "get_message", arguments: { id: message.id } });
  for (const result of [listed, found]) expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
  expect((listed.structuredContent as any).data[0]).toMatchObject({ content: igInteractiveCases[1], context });
  expect((found.structuredContent as any).data).toMatchObject({ content: igInteractiveCases[1], context });
});

it("perfil não configurado e erro numérico conservam o snapshot", async () => {
  const unconfigured = { ...messengerProfile, config: { ice_breakers: [], persistent_menu: [] }, revision: 0,
    sync_status: "unconfigured", synced_at: null, updated_at: null };
  const failed = { ...messengerProfile, sync_status: "error", last_error_code: 190 };
  const { client } = await connect([{ body: { data: unconfigured } }, { body: { data: failed } }]);
  for (const profile of [unconfigured, failed]) {
    const result = await client.callTool({ name: "get_instagram_messenger_profile", arguments: { channel_account_id: ACCOUNT } });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: profile });
  }
});

const waveTwoFields = { dm_button_title: "Receber link", delivery_text: "Aqui está o link",
  delivery_media: "https://cdn.test/image.jpg" };
const waveTwoMessageInput = { name: "Preço no direct", trigger: "keyword" as const, keywords: ["preço"],
  actions: [{ type: "message" as const, message: { type: "text" as const, text: "Qual produto?", quick_replies: [{ title: "Boto", payload: "boto" }] } },
    { type: "agent" as const, agent_id: "50000000-0000-4000-8000-000000000001" },
    { type: "stage" as const, stage_id: null }, { type: "tags" as const, add: ["interesse"], remove: [] },
    { type: "assign" as const, user_id: "60000000-0000-4000-8000-000000000001" }] };
const waveTwoMessageRule = { ...waveTwoMessageInput, id: RULE, account_id: "70000000-0000-4000-8000-000000000001",
  channel_account_id: ACCOUNT, excluded_keywords: [], story_contains: null, ref: null, ad_id: null,
  priority: 100, is_active: true, created_at: "2026-10-14T12:00:00Z", updated_at: "2026-10-14T12:00:00Z" };
const waveTwoPeriod = { from: "2026-10-01T00:00:00-03:00", to: "2026-11-01T00:00:00-03:00" };
const waveTwoCounters = { comments_matched: 3, dms_delivered: 2, public_replies: 1, dm_touches: 3, conversations_opened: 2, touch_rate: 1.5 };
const waveTwoMetrics = { rule_id: RULE, channel_account_id: ACCOUNT, ...waveTwoPeriod, totals: waveTwoCounters,
  posts: [{ media_id: null, ...waveTwoCounters }, { media_id: "123", ...waveTwoCounters, dms_delivered: 0, touch_rate: null }] };

const waveTwoTools = [
  ["list_message_rules", { channel_account_id: ACCOUNT, page: 2, per_page: 5 }],
  ["get_message_rule", { channel_account_id: ACCOUNT, rule_id: RULE }],
  ["create_message_rule", { channel_account_id: ACCOUNT, ...waveTwoMessageInput }],
  ["update_message_rule", { channel_account_id: ACCOUNT, rule_id: RULE, is_active: false, ref: null, keywords: [] }],
  ["delete_message_rule", { channel_account_id: ACCOUNT, rule_id: RULE }],
  ["get_comment_rule_metrics", { channel_account_id: ACCOUNT, rule_id: RULE, ...waveTwoPeriod }],
  ["create_comment_rule", { channel_account_id: ACCOUNT, dm_text: "Toque", ...waveTwoFields }],
  ["update_comment_rule", { channel_account_id: ACCOUNT, rule_id: RULE, ...waveTwoFields }],
  ["get_comment_rule", { channel_account_id: ACCOUNT, rule_id: RULE }],
  ["list_comment_rules", { channel_account_id: ACCOUNT }],
] as const;
describe("MCP — Instagram onda 2", () => {
  it("CRUD de mensagens, métricas e botão/entrega preservam outputs tipados", async () => {
    const comment = { ...rule, ...waveTwoFields };
    const outputs = [{ data: [waveTwoMessageRule], meta }, ...Array(3).fill({ data: waveTwoMessageRule }),
      { data: { id: RULE, deleted: true } }, { data: waveTwoMetrics }, ...Array(3).fill({ data: comment }), { data: [comment], meta }];
    const { client, calls } = await connect(outputs.map(body => ({ body })));
    const methods = ["GET", "GET", "POST", "PATCH", "DELETE", "GET", "POST", "PATCH", "GET", "GET"];
    for (const [i, [name, args]] of waveTwoTools.entries()) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
      expect(result.structuredContent).toEqual(outputs[i]);
      const sub = i < 5 ? "message-rules" : "comment-rules";
      const suffix = [1,3,4,5,7,8].includes(i) ? `/${RULE}${i === 5 ? "/metrics" : ""}` : "";
      expect(calls[i]!.method).toBe(methods[i]);
      expect(calls[i]!.path.split("?")[0]).toBe(`/v1/channel_accounts/${ACCOUNT}/${sub}${suffix}`);
    }
    expect(calls[0]!.path).toContain("?page=2&per_page=5");
    expect(calls[2]!.body).toEqual(waveTwoMessageInput);
    expect(calls[3]!.body).toEqual({ is_active: false, ref: null, keywords: [] });
    expect(Object.fromEntries(new URL(`https://api.test${calls[5]!.path}`).searchParams)).toEqual(waveTwoPeriod);
    expect(calls[6]!.body).toEqual({ dm_text: "Toque", ...waveTwoFields });
    expect(calls[7]!.body).toEqual(waveTwoFields);
  });
  it("PATCH de comentário envia null sem remover as chaves", async () => {
    const patch = { dm_button_title: null, delivery_text: null, delivery_media: null };
    const { client, calls } = await connect([{ body: { data: { ...rule, ...patch } } }]);
    const result = await client.callTool({ name: "update_comment_rule", arguments: { channel_account_id: ACCOUNT, rule_id: RULE, ...patch } });
    expect(result.isError).toBeFalsy(); expect(calls[0]!.body).toEqual(patch);
    expect(result.structuredContent).toEqual({ data: { ...rule, ...patch } });
  });
  it.each(waveTwoTools.flatMap(([name,args]) => [422,404].map(status => ({name,args,status}))))
    ("$name expõe HTTP $status estruturado", async ({name,args,status}) => {
      const code = status === 404 ? "not_found" : "invalid_request";
      const { client } = await connect([{ status, body: { error: { code, message: "Recusado" } } }]);
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true); expect(result.structuredContent).toMatchObject({ error: { code, status } });
    });
  it("tools/list anuncia seis gatilhos, cinco ações e campos de entrega", async () => {
    const { client } = await connect([]);
    const tools = (await client.listTools()).tools;
    for (const name of ["create_message_rule", "update_message_rule"]) {
      const schema = JSON.stringify(tools.find(t => t.name === name)!.inputSchema);
      for (const field of ["keyword", "story_reply", "story_mention", "share", "ref", "ad", "message", "agent", "stage", "tags", "assign", "router_id", "quick_replies", "interactive"]) expect(schema).toContain(field);
    }
    for (const name of ["create_comment_rule", "update_comment_rule"]) {
      const properties = tools.find(t => t.name === name)!.inputSchema.properties!;
      for (const key of Object.keys(waveTwoFields)) expect(properties).toHaveProperty(key);
    }
  });
  it("descoberta e rotas respeitam scopes/sandbox e preservam assistant", async () => {
    for (const [name] of waveTwoTools.slice(0, 6)) expect(ASSISTANT_TOOLS.has(name)).toBe(false);
    const reader = await connect([], { ...fullAccessIdentity, scopes: ["message-rules:read", "comment-rules:read"] });
    const reads = (await reader.client.listTools()).tools.map(t => t.name);
    expect(reads).toEqual(expect.arrayContaining(["list_message_rules", "get_message_rule", "get_comment_rule_metrics"]));
    expect(reads).not.toContain("create_message_rule");
    const writer = await connect([], { ...fullAccessIdentity, scopes: ["message-rules:write"] });
    const writes = (await writer.client.listTools()).tools.map(t => t.name);
    expect(writes).toEqual(expect.arrayContaining(["create_message_rule", "update_message_rule", "delete_message_rule"]));
    expect(writes).not.toContain("get_message_rule");
    const sandbox = await connect([], { ...fullAccessIdentity, environment: "sandbox" });
    expect((await sandbox.client.listTools()).tools.map(t => t.name)).toEqual(expect.arrayContaining(waveTwoTools.slice(0,6).map(([name]) => name)));
    for (const [i,[name]] of waveTwoTools.slice(0,6).entries()) {
      const method = ["GET", "GET", "POST", "PATCH", "DELETE", "GET"][i];
      const route = i === 5 ? "/v1/channel_accounts/:id/comment-rules/:ruleId/metrics"
        : `/v1/channel_accounts/:id/message-rules${[1,3,4].includes(i) ? "/:ruleId" : ""}`;
      expect(MCP_TOOL_POLICIES[name]!.requiredRoutes).toEqual([`${method} ${route}`]);
      expect(MCP_TOOL_POLICIES[name]!.readOnlyHint).toBe([0,1,5].includes(i));
    }
  });
});
