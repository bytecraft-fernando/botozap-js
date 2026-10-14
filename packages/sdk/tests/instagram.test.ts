import { describe, expect, it } from "vitest";
import { BotoZap, BotoZapError } from "../src/index.js";

const BASE_URL = "https://api.test/v1";
const IGSID = "17841400000000123";
const CHANNEL_ACCOUNT = "20000000-0000-4000-8000-000000000001";
const CONVERSATION = "30000000-0000-4000-8000-000000000001";
const RULE = "40000000-0000-4000-8000-000000000001";

type Call = { method: string; url: string; body: unknown };

function client(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const keys: Array<string | null> = [];
  const boto = new BotoZap({
    apiKey: "bz_live_instagram_sdk_test",
    baseUrl: BASE_URL,
    fetch: (async (input, init) => {
      keys.push(new Headers(init?.headers).get("Idempotency-Key"));
      calls.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      const next = responses.shift();
      if (!next) throw new Error("requisição inesperada");
      return new Response(JSON.stringify(next.body), {
        status: next.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });
  return { boto, calls, keys };
}

/** Recibo real de um direct do Instagram (messages/route.ts). */
const instagramReceipt = (type = "text") => ({
  id: "10000000-0000-4000-8000-000000000001",
  wamid: null,
  external_id: "aWdEZ...mlk",
  channel: "instagram",
  type,
  to: IGSID,
  sent_to: IGSID,
  status: "sent",
});

describe("SDK — Instagram", () => {
  it("send aceita o recibo do Instagram (wamid null + external_id) e repassa quick_replies", async () => {
    const { boto, calls } = client([{ status: 201, body: instagramReceipt() }]);
    const result = await boto.messages.send({
      to: IGSID,
      text: "Tenho estes horários:",
      quick_replies: [
        { title: "9h", payload: "sabado_09" },
        { content_type: "user_email" },
      ],
    });
    expect(result.wamid).toBeNull();
    expect(result.external_id).toBe("aWdEZ...mlk");
    expect(result.channel).toBe("instagram");
    expect(calls[0]!.body).toEqual({
      to: IGSID,
      type: "text",
      text: { body: "Tenho estes horários:" },
      quick_replies: [
        { title: "9h", payload: "sabado_09" },
        { content_type: "user_email" },
      ],
    });
  });

  it("send sem quick_replies não envia a chave", async () => {
    const { boto, calls } = client([{ status: 201, body: { id: null, wamid: "wamid.x", to: "5511", status: "sent" } }]);
    await boto.messages.send({ to: "5511", text: "oi" });
    expect(calls[0]!.body).not.toHaveProperty("quick_replies");
  });

  it("sendMedia e sendReaction aceitam o recibo do Instagram", async () => {
    const reaction = {
      id: null,
      wamid: null,
      external_id: "mid.alvo",
      channel: "instagram",
      to: IGSID,
      sent_to: IGSID,
      status: "sent",
      reaction: { message_id: "mid.alvo", emoji: "❤️", action: "react" },
    };
    const { boto } = client([
      { status: 201, body: instagramReceipt("image") },
      { status: 200, body: reaction },
    ]);
    const media = await boto.messages.sendMedia({ to: IGSID, type: "image", link: "https://cdn.test/a.jpg" });
    expect(media.type).toBe("image");
    const reacted = await boto.messages.sendReaction({ to: IGSID, message_id: "mid.alvo", emoji: "❤️" });
    expect(reacted.reaction).toEqual({ message_id: "mid.alvo", emoji: "❤️", action: "react" });
  });

  it("recibo sem wamid nem external_id continua malformed_response", async () => {
    const { boto } = client([
      { status: 201, body: { id: null, wamid: null, channel: "instagram", to: IGSID, status: "sent" } },
    ]);
    await expect(boto.messages.send({ to: IGSID, text: "oi" })).rejects.toMatchObject({
      code: "malformed_response",
    });
  });

  it("conversations.reply usa a Conta de canal como origem no Instagram", async () => {
    const { boto, calls } = client([
      {
        body: {
          data: {
            id: CONVERSATION,
            channel: "instagram",
            channel_account: { id: CHANNEL_ACCOUNT, channel: "instagram", display: "@loja" },
            phone_number_id: null,
            contact: { wa_id: IGSID, phone: null },
          },
        },
      },
      { status: 201, body: instagramReceipt() },
    ]);
    const result = await boto.conversations.reply(
      CONVERSATION,
      { text: "Olá!", quick_replies: [{ title: "Sim" }] },
      { idempotencyKey: "50000000-0000-4000-8000-000000000001" },
    );
    expect(result.external_id).toBe("aWdEZ...mlk");
    expect(calls[1]!.body).toEqual({
      to: IGSID,
      type: "text",
      text: { body: "Olá!" },
      from: CHANNEL_ACCOUNT,
      quick_replies: [{ title: "Sim" }],
    });
  });

  it("conversations.reply no Instagram sem Conta de canal falha antes do envio", async () => {
    const { boto, calls } = client([
      { body: { data: { id: CONVERSATION, channel: "instagram", channel_account: null, phone_number_id: null, contact: { wa_id: IGSID } } } },
    ]);
    const error = await boto.conversations.reply(CONVERSATION, { text: "Olá!" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).code).toBe("malformed_response");
    expect(calls).toHaveLength(1);
  });

  it("expõe o bloco instagram da Conta de canal e content.edited da Mensagem", async () => {
    const instagram = {
      instagram_account_id: "17841400000000001", username: "loja", name: "Loja", instagram_connection_id: null,
      connection_status: "active", token_status: "expired", token_expires_at: null, token_refreshed_at: null,
    };
    const { boto } = client([
      { body: { data: { id: CHANNEL_ACCOUNT, channel: "instagram", instagram } } },
      { body: { data: { id: "m1", channel: "instagram", external_id: "mid.1", content: { body: "novo", edited: { count: 2, at: "2026-10-06T12:00:00Z" } }, revoked_at: null } } },
    ]);
    const account = await boto.channelAccounts.get(CHANNEL_ACCOUNT);
    expect(account.instagram?.token_status).toBe("expired");
    const message = await boto.messages.get("m1");
    expect(message.content?.edited?.count).toBe(2);
  });

  it("conversations.list repassa os filtros channel e channel_account_id", async () => {
    const { boto, calls } = client([{ body: { data: [], paging: { next: null, previous: null } } }]);
    await boto.conversations.list({ channel: "instagram", channel_account_id: CHANNEL_ACCOUNT });
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/v1/conversations");
    expect(url.searchParams.get("channel")).toBe("instagram");
    expect(url.searchParams.get("channel_account_id")).toBe(CHANNEL_ACCOUNT);
  });

  it("channelAccounts: list, get e Regras de comentário usam as rotas /v1", async () => {
    const meta = { page: 1, per_page: 20, total_pages: 1, total_count: 0 };
    const rule = { id: RULE, channel_account_id: CHANNEL_ACCOUNT, dm_text: "Oi!" };
    const { boto, calls } = client([
      { body: { data: [], meta } },
      { body: { data: { id: CHANNEL_ACCOUNT, channel: "instagram" } } },
      { body: { data: [], meta } },
      { body: { data: rule } },
      { status: 201, body: { data: rule } },
      { body: { data: { ...rule, is_active: false } } },
    ]);
    await boto.channelAccounts.list({ channel: "instagram", customer_id: "c1", page: 2 });
    expect((await boto.channelAccounts.get(CHANNEL_ACCOUNT)).channel).toBe("instagram");
    await boto.channelAccounts.listCommentRules(CHANNEL_ACCOUNT, { per_page: 5 });
    await boto.channelAccounts.getCommentRule(CHANNEL_ACCOUNT, RULE);
    await boto.channelAccounts.createCommentRule(CHANNEL_ACCOUNT, { keyword: "preço", dm_text: "Oi!" });
    await boto.channelAccounts.updateCommentRule(CHANNEL_ACCOUNT, RULE, { is_active: false });
    expect(calls.map((c) => `${c.method} ${c.url.replace(BASE_URL, "")}`)).toEqual([
      "GET /channel_accounts?page=2&channel=instagram&customer_id=c1",
      `GET /channel_accounts/${CHANNEL_ACCOUNT}`,
      `GET /channel_accounts/${CHANNEL_ACCOUNT}/comment-rules?per_page=5`,
      `GET /channel_accounts/${CHANNEL_ACCOUNT}/comment-rules/${RULE}`,
      `POST /channel_accounts/${CHANNEL_ACCOUNT}/comment-rules`,
      `PATCH /channel_accounts/${CHANNEL_ACCOUNT}/comment-rules/${RULE}`,
    ]);
    expect(calls[4]!.body).toEqual({ keyword: "preço", dm_text: "Oi!" });
    expect(calls[5]!.body).toEqual({ is_active: false });
  });
});

const buttons = [
  { type: "web_url" as const, title: "Ver loja", url: "https://loja.test" },
  { type: "postback" as const, title: "Preço", payload: "preco" },
];
const card = { title: "Produto", subtitle: "Descrição", image_url: "https://loja.test/p.jpg",
  default_action: { type: "web_url" as const, url: "https://loja.test/p" }, buttons };
const interactiveCases = [
  { type: "button" as const, body: { text: "Escolha:" }, action: { buttons } },
  { type: "generic" as const, elements: [card] },
  { type: "generic" as const, elements: Array.from({ length: 10 }, (_, i) => ({ ...card, title: `Produto ${i}` })) },
];
const extendedRule = { id: RULE, channel_account_id: CHANNEL_ACCOUNT, dm_text: "Oi!",
  keywords: ["preço", "valor"], excluded_keywords: ["não quero"], reply_variations: ["Te chamei!", "Veja o direct!"],
  next_post: true, next_post_activated_at: "2026-10-14T12:00:00Z" };
const rulePatch = { keywords: extendedRule.keywords, excluded_keywords: extendedRule.excluded_keywords,
  reply_variations: extendedRule.reply_variations, next_post: true };
const profile = { channel_account_id: CHANNEL_ACCOUNT, config: { ice_breakers: [{ question: "Horários?", payload: "horarios" }],
  persistent_menu: buttons }, revision: 1, sync_status: "synced", synced_at: "2026-10-14T12:00:00Z",
  last_error_code: null, updated_at: "2026-10-14T12:00:00Z" };

describe("SDK — paridade Instagram onda 1", () => {
  it.each(interactiveCases)("sendInteractive conserva button/card/gallery e o recibo Instagram: $type", async (interactive) => {
    const { boto, calls, keys } = client([{ status: 201, body: instagramReceipt("interactive") }]);
    const receipt = await boto.messages.sendInteractive({ to: IGSID, from: CHANNEL_ACCOUNT, interactive, tag: "human_agent" },
      { idempotencyKey: "50000000-0000-4000-8000-000000000001" });
    expect(keys).toEqual(["50000000-0000-4000-8000-000000000001"]);
    expect(receipt).toMatchObject({ wamid: null, external_id: "aWdEZ...mlk", channel: "instagram", type: "interactive" });
    expect(calls[0]).toMatchObject({ method: "POST", url: `${BASE_URL}/messages`,
      body: { to: IGSID, from: CHANNEL_ACCOUNT, type: "interactive", interactive, tag: "human_agent" } });
  });

  it("list/get/create/update preservam os campos novos e delete retorna o comprovante", async () => {
    const { boto, calls } = client([
      { body: { data: [extendedRule], meta: { page: 1, per_page: 20, total_pages: 1, total_count: 1 } } },
      ...Array.from({ length: 3 }, () => ({ body: { data: extendedRule } })),
      { body: { data: { id: RULE, deleted: true } } },
    ]);
    expect((await boto.channelAccounts.listCommentRules(CHANNEL_ACCOUNT)).data[0]).toEqual(extendedRule);
    expect(await boto.channelAccounts.getCommentRule(CHANNEL_ACCOUNT, RULE)).toEqual(extendedRule);
    expect(await boto.channelAccounts.createCommentRule(CHANNEL_ACCOUNT, { dm_text: "Oi!", ...rulePatch })).toEqual(extendedRule);
    expect(await boto.channelAccounts.updateCommentRule(CHANNEL_ACCOUNT, RULE, rulePatch)).toEqual(extendedRule);
    expect(await boto.channelAccounts.deleteCommentRule(CHANNEL_ACCOUNT, RULE)).toEqual({ id: RULE, deleted: true });
    expect(calls[2]!.body).toEqual({ dm_text: "Oi!", ...rulePatch });
    expect(calls[3]!.body).toEqual(rulePatch);
    expect(calls[4]).toEqual({ method: "DELETE", url: `${BASE_URL}/channel_accounts/${CHANNEL_ACCOUNT}/comment-rules/${RULE}`, body: undefined });
  });

  it("os quatro métodos de perfil usam o envelope de item e PATCH preserva ausência/null/[]", async () => {
    const { boto, calls } = client(Array.from({ length: 5 }, () => ({ body: { data: profile } })));
    expect(await boto.channelAccounts.getMessengerProfile(CHANNEL_ACCOUNT)).toEqual(profile);
    expect(await boto.channelAccounts.updateMessengerProfile(CHANNEL_ACCOUNT, { ice_breakers: null })).toEqual(profile);
    await boto.channelAccounts.updateMessengerProfile(CHANNEL_ACCOUNT, { persistent_menu: [] });
    expect(await boto.channelAccounts.deleteMessengerProfile(CHANNEL_ACCOUNT)).toEqual(profile);
    expect(await boto.channelAccounts.syncMessengerProfile(CHANNEL_ACCOUNT)).toEqual(profile);
    const path = `${BASE_URL}/channel_accounts/${CHANNEL_ACCOUNT}/messenger-profile`;
    expect(calls).toEqual([
      { method: "GET", url: path, body: undefined },
      { method: "PATCH", url: path, body: { ice_breakers: null } },
      { method: "PATCH", url: path, body: { persistent_menu: [] } },
      { method: "DELETE", url: path, body: undefined },
      { method: "POST", url: `${path}/sync`, body: undefined },
    ]);
  });

  it("codifica IDs nos novos endpoints", async () => {
    const { boto, calls } = client([{ body: { data: profile } }, { body: { data: { id: RULE, deleted: true } } }]);
    await boto.channelAccounts.getMessengerProfile("canal/a");
    await boto.channelAccounts.deleteCommentRule("canal/a", "regra/b");
    expect(calls[0]!.url).toContain("/canal%2Fa/messenger-profile");
    expect(calls[1]!.url).toContain("/canal%2Fa/comment-rules/regra%2Fb");
  });

  const operations = [
    (b: BotoZap) => b.messages.sendInteractive({ to: IGSID, interactive: interactiveCases[0]! }),
    (b: BotoZap) => b.channelAccounts.listCommentRules(CHANNEL_ACCOUNT),
    (b: BotoZap) => b.channelAccounts.getCommentRule(CHANNEL_ACCOUNT, RULE),
    (b: BotoZap) => b.channelAccounts.createCommentRule(CHANNEL_ACCOUNT, { dm_text: "Oi", ...rulePatch }),
    (b: BotoZap) => b.channelAccounts.updateCommentRule(CHANNEL_ACCOUNT, RULE, rulePatch),
    (b: BotoZap) => b.channelAccounts.deleteCommentRule(CHANNEL_ACCOUNT, RULE),
    (b: BotoZap) => b.channelAccounts.getMessengerProfile(CHANNEL_ACCOUNT),
    (b: BotoZap) => b.channelAccounts.updateMessengerProfile(CHANNEL_ACCOUNT, { ice_breakers: null }),
    (b: BotoZap) => b.channelAccounts.deleteMessengerProfile(CHANNEL_ACCOUNT),
    (b: BotoZap) => b.channelAccounts.syncMessengerProfile(CHANNEL_ACCOUNT),
  ];
  it.each(operations.map((operation, index) => ({ operation, index })))("propaga erro HTTP 422 na operação $index", async ({ operation }) => {
    const { boto } = client([{ status: 422, body: { error: { code: "invalid_request", message: "Contrato inválido" } } }]);
    await expect(operation(boto)).rejects.toMatchObject({ code: "invalid_request", status: 422 });
  });
});

const whatsappInteractiveCases = [
  { type: "button" as const, body: { text: "Confirma?" }, action: { buttons: [{ type: "reply" as const, reply: { id: "sim", title: "Sim" } }] } },
  { type: "list" as const, body: { text: "Escolha" }, action: { button: "Opções", sections: [{ rows: [{ id: "1", title: "Primeira" }] }] } },
  { type: "cta_url" as const, body: { text: "Ver loja" }, action: { name: "cta_url" as const, parameters: { display_text: "Abrir", url: "https://loja.test" } } },
];
it.each(whatsappInteractiveCases)("sendInteractive mantém o contrato WhatsApp $type", async (interactive) => {
  const receipt = { id: null, wamid: "wamid.wa", to: "5511", status: "sent" };
  const { boto, calls, keys } = client([{ status: 201, body: receipt }]);
  expect(await boto.messages.sendInteractive({ to: "5511", interactive })).toEqual(receipt);
  expect(calls[0]!.body).toEqual({ to: "5511", type: "interactive", interactive });
  expect(keys).toEqual([null]);
});

it("leitura de Mensagem conserva generic e contexto do postback", async () => {
  const context = { quick_reply: { payload: "preco" }, postback: { title: "Preço", payload: "preco" } };
  const { boto } = client([{ body: { data: { id: "m1", channel: "instagram", external_id: "mid.1", content: interactiveCases[1], context } } }]);
  const message = await boto.messages.get("m1");
  expect(message.content).toEqual(interactiveCases[1]);
  expect(message.context).toEqual(context);
});

const waveTwoFields = { dm_button_title: "Receber link", delivery_text: "Aqui está o link",
  delivery_media: "https://cdn.test/image.jpg" };
const waveTwoMessageInput = { name: "Preço no direct", trigger: "keyword" as const, keywords: ["preço"],
  actions: [{ type: "message" as const, message: { type: "text" as const, text: "Qual produto?", quick_replies: [{ title: "Boto", payload: "boto" }] } },
    { type: "agent" as const, agent_id: "50000000-0000-4000-8000-000000000001" },
    { type: "stage" as const, stage_id: null }, { type: "tags" as const, add: ["interesse"], remove: [] },
    { type: "assign" as const, user_id: "60000000-0000-4000-8000-000000000001" }] };
const waveTwoMessageRule = { ...waveTwoMessageInput, id: RULE, account_id: "70000000-0000-4000-8000-000000000001",
  channel_account_id: CHANNEL_ACCOUNT, excluded_keywords: [], story_contains: null, ref: null, ad_id: null,
  priority: 100, is_active: true, created_at: "2026-10-14T12:00:00Z", updated_at: "2026-10-14T12:00:00Z" };
const waveTwoPeriod = { from: "2026-10-01T00:00:00-03:00", to: "2026-11-01T00:00:00-03:00" };
const waveTwoCounters = { comments_matched: 3, dms_delivered: 2, public_replies: 1, dm_touches: 3, conversations_opened: 2, touch_rate: 1.5 };
const waveTwoMetrics = { rule_id: RULE, channel_account_id: CHANNEL_ACCOUNT, ...waveTwoPeriod, totals: waveTwoCounters,
  posts: [{ media_id: null, ...waveTwoCounters }, { media_id: "123", ...waveTwoCounters, dms_delivered: 0, touch_rate: null }] };

describe("SDK — Instagram onda 2", () => {
  it("comment-rules create/get/list/update preservam botão, entrega e null", async () => {
    const rule = { ...extendedRule, ...waveTwoFields };
    const meta = { page: 1, per_page: 20, total_pages: 1, total_count: 1 };
    const { boto, calls } = client([{ body: { data: rule } }, { body: { data: rule } },
      { body: { data: [rule], meta } }, { body: { data: rule } }]);
    expect(await boto.channelAccounts.createCommentRule(CHANNEL_ACCOUNT, { dm_text: "Toque", ...waveTwoFields })).toEqual(rule);
    expect(await boto.channelAccounts.getCommentRule(CHANNEL_ACCOUNT, RULE)).toEqual(rule);
    expect((await boto.channelAccounts.listCommentRules(CHANNEL_ACCOUNT)).data).toEqual([rule]);
    await boto.channelAccounts.updateCommentRule(CHANNEL_ACCOUNT, RULE, { dm_button_title: null, delivery_text: null, delivery_media: null });
    expect(calls[0]!.body).toEqual({ dm_text: "Toque", ...waveTwoFields });
    expect(calls[3]!.body).toEqual({ dm_button_title: null, delivery_text: null, delivery_media: null });
  });
  it("cinco métodos de mensagem e métricas preservam envelopes e contrato", async () => {
    const meta = { page: 2, per_page: 5, total_pages: 2, total_count: 6 };
    const { boto, calls } = client([{ body: { data: [waveTwoMessageRule], meta } },
      { body: { data: waveTwoMessageRule } }, { status: 201, body: { data: waveTwoMessageRule } },
      { body: { data: waveTwoMessageRule } }, { body: { data: { id: RULE, deleted: true } } }, { body: { data: waveTwoMetrics } }]);
    expect(await boto.channelAccounts.listMessageRules("canal/a", { page: 2, per_page: 5 })).toEqual({ data: [waveTwoMessageRule], meta });
    expect(await boto.channelAccounts.getMessageRule("canal/a", "regra/b")).toEqual(waveTwoMessageRule);
    expect(await boto.channelAccounts.createMessageRule("canal/a", waveTwoMessageInput)).toEqual(waveTwoMessageRule);
    await boto.channelAccounts.updateMessageRule("canal/a", "regra/b", { is_active: false, ref: null, keywords: [] });
    expect(await boto.channelAccounts.deleteMessageRule("canal/a", "regra/b")).toEqual({ id: RULE, deleted: true });
    expect(await boto.channelAccounts.getCommentRuleMetrics("canal/a", "regra/b", waveTwoPeriod)).toEqual(waveTwoMetrics);
    const path = `${BASE_URL}/channel_accounts/canal%2Fa/message-rules`;
    expect(calls.slice(0, 5)).toEqual([
      { method: "GET", url: `${path}?page=2&per_page=5`, body: undefined },
      { method: "GET", url: `${path}/regra%2Fb`, body: undefined },
      { method: "POST", url: path, body: waveTwoMessageInput },
      { method: "PATCH", url: `${path}/regra%2Fb`, body: { is_active: false, ref: null, keywords: [] } },
      { method: "DELETE", url: `${path}/regra%2Fb`, body: undefined },
    ]);
    const metricsUrl = new URL(calls[5]!.url);
    expect(metricsUrl.pathname).toBe("/v1/channel_accounts/canal%2Fa/comment-rules/regra%2Fb/metrics");
    expect(Object.fromEntries(metricsUrl.searchParams)).toEqual(waveTwoPeriod);
  });
  const operations = [
    (b: BotoZap) => b.channelAccounts.listMessageRules(CHANNEL_ACCOUNT),
    (b: BotoZap) => b.channelAccounts.getMessageRule(CHANNEL_ACCOUNT, RULE),
    (b: BotoZap) => b.channelAccounts.createMessageRule(CHANNEL_ACCOUNT, waveTwoMessageInput),
    (b: BotoZap) => b.channelAccounts.updateMessageRule(CHANNEL_ACCOUNT, RULE, { is_active: false }),
    (b: BotoZap) => b.channelAccounts.deleteMessageRule(CHANNEL_ACCOUNT, RULE),
    (b: BotoZap) => b.channelAccounts.getCommentRuleMetrics(CHANNEL_ACCOUNT, RULE, waveTwoPeriod),
    (b: BotoZap) => b.channelAccounts.createCommentRule(CHANNEL_ACCOUNT, { dm_text: "Toque", ...waveTwoFields }),
    (b: BotoZap) => b.channelAccounts.updateCommentRule(CHANNEL_ACCOUNT, RULE, waveTwoFields),
    (b: BotoZap) => b.channelAccounts.getCommentRule(CHANNEL_ACCOUNT, RULE),
    (b: BotoZap) => b.channelAccounts.listCommentRules(CHANNEL_ACCOUNT),
  ];
  it.each(operations.flatMap((operation, index) => [422, 404].map(status => ({ operation, index, status }))))
    ("propaga HTTP $status na operação $index", async ({ operation, status }) => {
      const code = status === 422 ? "invalid_request" : "not_found";
      const { boto } = client([{ status, body: { error: { code, message: "Recusado" } } }]);
      await expect(operation(boto)).rejects.toMatchObject({ code, status });
    });
});
