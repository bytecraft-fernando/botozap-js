import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerMessages } from "../src/commands/messages.js";
import { registerConversations } from "../src/commands/conversations.js";
import { registerChannelAccounts } from "../src/commands/channel-accounts.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...base, "-o", "json"];
const IGSID = "17841400000000123";
const ACCOUNT = "20000000-0000-4000-8000-000000000001";
const RULE = "40000000-0000-4000-8000-000000000001";
const igReceipt = {
  id: "10000000-0000-4000-8000-000000000001",
  wamid: null,
  external_id: "aWdEZ...mlk",
  channel: "instagram",
  type: "text",
  to: IGSID,
  sent_to: IGSID,
  status: "sent",
};
const meta = { page: 1, per_page: 20, total_pages: 1, total_count: 0 };

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    method: init?.method ?? "GET",
    path: parsed.pathname,
    query: Object.fromEntries(parsed.searchParams),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  fetch.mockReset().mockImplementation(async () => Response.json(igReceipt, { status: 201 }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("CLI — Instagram", () => {
  it("messages send aceita o recibo do Instagram e mostra external_id em vez de wamid", async () => {
    const r = await run(registerMessages, ["messages", "send", "--to", IGSID, "--text", "Oi", ...base]);
    expect(r.error).toBeUndefined();
    expect(r.stdout).toContain("aWdEZ...mlk");
    expect(r.stdout).toContain("instagram");
    expect(r.stdout).not.toContain("wamid");
  });

  it("messages send --quick-reply repetido monta quick_replies", async () => {
    const r = await run(registerMessages, [
      "messages", "send", "--to", IGSID, "--text", "Horários:",
      "--quick-reply", "9h=sabado_09", "--quick-reply", "Outro horário", ...json,
    ]);
    expect(r.error).toBeUndefined();
    expect(request().body).toEqual({
      to: IGSID,
      type: "text",
      text: { body: "Horários:" },
      quick_replies: [{ title: "9h", payload: "sabado_09" }, { title: "Outro horário" }],
    });
  });

  it("messages send --quick-replies-json aceita content_type e recusa combinação com --quick-reply", async () => {
    await run(registerMessages, [
      "messages", "send", "--to", IGSID, "--text", "Seu e-mail?",
      "--quick-replies-json", '[{"content_type":"user_email"}]', ...json,
    ]);
    expect(request().body.quick_replies).toEqual([{ content_type: "user_email" }]);
    const both = await run(registerMessages, [
      "messages", "send", "--to", IGSID, "--text", "x", "--quick-reply", "a",
      "--quick-replies-json", "[]", ...json,
    ]);
    expect(String(both.error)).toContain("--quick-reply");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("messages send-media envia mídia para um IGSID com a Conta de canal como origem", async () => {
    fetch.mockImplementation(async () => Response.json({ ...igReceipt, type: "image" }, { status: 201 }));
    const r = await run(registerMessages, [
      "messages", "send-media", "--to", IGSID, "--type", "image",
      "--link", "https://cdn.test/a.jpg", "--from", ACCOUNT, ...json,
    ]);
    expect(r.error).toBeUndefined();
    expect(request().body).toEqual({ to: IGSID, from: ACCOUNT, type: "image", image: { link: "https://cdn.test/a.jpg" } });
  });

  it("messages send-media valida tipo, caption e filename antes do HTTP", async () => {
    const bad = await run(registerMessages, ["messages", "send-media", "--to", IGSID, "--type", "sticker", "--link", "https://x.test/a", ...json]);
    expect(String(bad.error)).toContain("--type");
    const audio = await run(registerMessages, ["messages", "send-media", "--to", IGSID, "--type", "audio", "--link", "https://x.test/a", "--caption", "x", ...json]);
    expect(String(audio.error)).toContain("--caption");
    const file = await run(registerMessages, ["messages", "send-media", "--to", IGSID, "--type", "image", "--link", "https://x.test/a", "--filename", "a.jpg", ...json]);
    expect(String(file.error)).toContain("--filename");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("messages react no Instagram mostra o mid do alvo", async () => {
    fetch.mockImplementation(async () => Response.json({
      id: null, wamid: null, external_id: "mid.alvo", channel: "instagram", to: IGSID, sent_to: IGSID,
      status: "sent", reaction: { message_id: "mid.alvo", emoji: "❤️", action: "react" },
    }));
    const r = await run(registerMessages, ["messages", "react", "--to", IGSID, "--message-id", "mid.alvo", "--emoji", "❤️", ...base]);
    expect(r.error).toBeUndefined();
    expect(r.stdout).toContain("mid.alvo");
    expect(r.stdout).toContain("react");
  });

  it("conversations list repassa --channel e --channel-account-id", async () => {
    fetch.mockImplementation(async () => Response.json({ data: [], paging: { next: null, previous: null } }));
    await run(registerConversations, ["conversations", "list", "--channel", "instagram", "--channel-account-id", ACCOUNT, ...json]);
    expect(request().query).toMatchObject({ channel: "instagram", channel_account_id: ACCOUNT });
  });

  it("channel-accounts list mostra a saúde do token do Instagram e do WhatsApp", async () => {
    fetch.mockImplementationOnce(async () => Response.json({ data: [
      { id: ACCOUNT, channel: "instagram", display: "@loja", status: "active", instagram: { token_status: "expiring" } },
      { id: "wa", channel: "whatsapp", display: "+55", status: "active", whatsapp: { token_status: "valid" } },
    ], meta }));
    const r = await run(registerChannelAccounts, ["channel-accounts", "list", ...base]);
    expect(r.error).toBeUndefined();
    expect(r.stdout).toContain("TOKEN");
    expect(r.stdout).toContain("expiring");
    expect(r.stdout).toContain("valid");
  });

  it("channel-accounts list/get usam /v1/channel_accounts", async () => {
    fetch.mockImplementationOnce(async () => Response.json({ data: [], meta }));
    fetch.mockImplementationOnce(async () => Response.json({ data: { id: ACCOUNT, channel: "instagram" } }));
    await run(registerChannelAccounts, ["channel-accounts", "list", "--channel", "instagram", "--customer-id", "c1", ...json]);
    await run(registerChannelAccounts, ["channel-accounts", "get", ACCOUNT, ...json]);
    expect(request(0)).toMatchObject({ method: "GET", path: "/v1/channel_accounts", query: { channel: "instagram", customer_id: "c1" } });
    expect(request(1)).toMatchObject({ method: "GET", path: `/v1/channel_accounts/${ACCOUNT}` });
  });

  it("channel-accounts comment-rules: list, get, create e update", async () => {
    const rule = { id: RULE, channel_account_id: ACCOUNT, keyword: null, dm_text: "Oi", status: "active", notice: null };
    fetch.mockImplementationOnce(async () => Response.json({ data: [rule], meta }));
    fetch.mockImplementationOnce(async () => Response.json({ data: rule }));
    fetch.mockImplementationOnce(async () => Response.json({ data: rule }, { status: 201 }));
    fetch.mockImplementationOnce(async () => Response.json({ data: rule }));
    const prefix = ["channel-accounts", "comment-rules"];
    await run(registerChannelAccounts, [...prefix, "list", ACCOUNT, ...json]);
    await run(registerChannelAccounts, [...prefix, "get", ACCOUNT, RULE, ...json]);
    await run(registerChannelAccounts, [...prefix, "create", ACCOUNT, "--dm-text", "Oi", "--keyword", "preço", "--media-id", "123", ...json]);
    await run(registerChannelAccounts, [...prefix, "update", ACCOUNT, RULE, "--clear-keyword", "--active", "false", ...json]);
    const path = `/v1/channel_accounts/${ACCOUNT}/comment-rules`;
    expect(request(0)).toMatchObject({ method: "GET", path });
    expect(request(1)).toMatchObject({ method: "GET", path: `${path}/${RULE}` });
    expect(request(2)).toMatchObject({ method: "POST", path, body: { dm_text: "Oi", keyword: "preço", media_id: "123" } });
    expect(request(3)).toMatchObject({ method: "PATCH", path: `${path}/${RULE}`, body: { keyword: null, is_active: false } });
  });

  it("comment-rules update sem campos e --active inválido falham antes do HTTP", async () => {
    const empty = await run(registerChannelAccounts, ["channel-accounts", "comment-rules", "update", ACCOUNT, RULE, ...json]);
    expect(String(empty.error)).toContain("ao menos um campo");
    const bad = await run(registerChannelAccounts, ["channel-accounts", "comment-rules", "update", ACCOUNT, RULE, "--active", "sim", ...json]);
    expect(String(bad.error)).toContain("--active");
    expect(fetch).not.toHaveBeenCalled();
  });
});
