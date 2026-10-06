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
  const boto = new BotoZap({
    apiKey: "bz_live_instagram_sdk_test",
    baseUrl: BASE_URL,
    fetch: (async (input, init) => {
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
  return { boto, calls };
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
