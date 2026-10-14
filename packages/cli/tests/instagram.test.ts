import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const stdinFixture = vi.hoisted(() => ({ body: "" }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: (file: Parameters<typeof actual.readFileSync>[0], ...args: unknown[]) =>
    file === 0 ? stdinFixture.body : (actual.readFileSync as (...args: unknown[]) => unknown)(file, ...args) };
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
const extendedRule = { id: RULE, channel_account_id: ACCOUNT, dm_text: "Oi!", ...extendedFields };
const profile = { channel_account_id: ACCOUNT, config: { ice_breakers: [{ question: "Horários?", payload: "horarios" }],
  persistent_menu: igButtons }, revision: 1, sync_status: "synced", synced_at: null, last_error_code: null, updated_at: null };
const extensionFlags = ["--keywords", JSON.stringify(extendedFields.keywords), "--excluded-keywords",
  JSON.stringify(extendedFields.excluded_keywords), "--reply-variations", JSON.stringify(extendedFields.reply_variations), "--next-post", "true"];
const profileCases = [
  ["get", "GET", "", []],
  ["update", "PATCH", "", ["--json", '{"ice_breakers":null}']],
  ["delete", "DELETE", "", []],
  ["sync", "POST", "/sync", []],
] as const;

describe("CLI — paridade Instagram onda 1", () => {
  it.each(igInteractiveCases)("send-interactive --json conserva button/card/gallery: $type", async (interactive) => {
    fetch.mockImplementation(async () => Response.json({ ...igReceipt, type: "interactive" }, { status: 201 }));
    const result = await run(registerMessages, ["messages", "send-interactive", "--to", IGSID, "--from", ACCOUNT,
      "--json", JSON.stringify(interactive), "--tag", "human_agent", ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "POST", path: "/v1/messages",
      body: { to: IGSID, from: ACCOUNT, type: "interactive", interactive, tag: "human_agent" } });
    expect(JSON.parse(result.stdout)).toMatchObject({ wamid: null, external_id: "aWdEZ...mlk", channel: "instagram", type: "interactive" });
  });

  it.each(["input", "stdin"])("send-interactive --%s lê o objeto e mostra o recibo Instagram", async (source) => {
    fetch.mockImplementation(async () => Response.json({ ...igReceipt, type: "interactive" }, { status: 201 }));
    const dir = mkdtempSync(join(tmpdir(), "botozap-ig-"));
    const file = join(dir, "card.json");
    const raw = JSON.stringify(igInteractiveCases[1]);
    writeFileSync(file, raw);
    stdinFixture.body = raw;
    try {
      const result = await run(registerMessages, ["messages", "send-interactive", "--to", IGSID, "--from", ACCOUNT,
        ...(source === "input" ? ["--input", file] : ["--stdin"]), ...base]);
      expect(result.error).toBeUndefined();
      expect(request().body.interactive).toEqual(igInteractiveCases[1]);
      expect(result.stdout).toContain("aWdEZ...mlk");
      expect(result.stdout).toContain("instagram");
      expect(result.stdout).toContain("interactive");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("messages send --stdin aceita o envelope interactive completo", async () => {
    fetch.mockImplementation(async () => Response.json({ ...igReceipt, type: "interactive" }, { status: 201 }));
    const body = { to: IGSID, from: ACCOUNT, type: "interactive", interactive: igInteractiveCases[2], tag: "human_agent" };
    stdinFixture.body = JSON.stringify(body);
    const result = await run(registerMessages, ["messages", "send", "--stdin", ...json]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual(body);
  });

  it("comment-rules list/get/create/update/delete conservam os campos novos", async () => {
    fetch.mockImplementationOnce(async () => Response.json({ data: [extendedRule], meta }));
    fetch.mockImplementationOnce(async () => Response.json({ data: extendedRule }));
    fetch.mockImplementationOnce(async () => Response.json({ data: extendedRule }));
    fetch.mockImplementationOnce(async () => Response.json({ data: extendedRule }));
    fetch.mockImplementationOnce(async () => Response.json({ data: { id: RULE, deleted: true } }));
    const prefix = ["channel-accounts", "comment-rules"];
    const args = [["list", ACCOUNT], ["get", ACCOUNT, RULE], ["create", ACCOUNT, "--dm-text", "Oi!", ...extensionFlags],
      ["update", ACCOUNT, RULE, ...extensionFlags], ["delete", ACCOUNT, RULE]];
    for (const [i, argv] of args.entries()) {
      const result = await run(registerChannelAccounts, [...prefix, ...argv, ...json]);
      expect(result.error).toBeUndefined();
      expect(JSON.parse(result.stdout)).toEqual(i === 0 ? { data: [extendedRule], meta }
        : i === 4 ? { id: RULE, deleted: true } : extendedRule);
    }
    expect(request(2).body).toEqual({ dm_text: "Oi!", ...extendedFields });
    expect(request(3).body).toEqual(extendedFields);
    expect(request(4)).toMatchObject({ method: "DELETE", path: `/v1/channel_accounts/${ACCOUNT}/comment-rules/${RULE}`, body: undefined });
  });

  it("update de regra envia listas vazias e next_post false", async () => {
    fetch.mockImplementation(async () => Response.json({ data: extendedRule }));
    const result = await run(registerChannelAccounts, ["channel-accounts", "comment-rules", "update", ACCOUNT, RULE,
      "--keywords", "[]", "--excluded-keywords", "[]", "--reply-variations", "[]", "--next-post", "false", ...json]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual({ keywords: [], excluded_keywords: [], reply_variations: [], next_post: false });
  });

  it.each(profileCases)("messenger-profile %s usa a rota canônica", async (operation, method, suffix, flags) => {
    fetch.mockImplementation(async () => Response.json({ data: profile }));
    const result = await run(registerChannelAccounts, ["channel-accounts", "messenger-profile", operation,
      "--channel-account-id", ACCOUNT, ...flags, ...json]);
    expect(result.error).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual(profile);
    expect(request()).toMatchObject({ method, path: `/v1/channel_accounts/${ACCOUNT}/messenger-profile${suffix}`,
      body: operation === "update" ? { ice_breakers: null } : undefined });
  });

  it.each(["input", "stdin"])("messenger-profile update --%s conserva [] e menu", async (source) => {
    fetch.mockImplementation(async () => Response.json({ data: profile }));
    const patch = { ice_breakers: [], persistent_menu: igButtons };
    const dir = mkdtempSync(join(tmpdir(), "botozap-ig-profile-"));
    const file = join(dir, "patch.json");
    writeFileSync(file, JSON.stringify(patch));
    stdinFixture.body = JSON.stringify(patch);
    try {
      const result = await run(registerChannelAccounts, ["channel-accounts", "messenger-profile", "update",
        "--channel-account-id", ACCOUNT, ...(source === "input" ? ["--input", file] : ["--stdin"]), ...json]);
      expect(result.error).toBeUndefined();
      expect(request().body).toEqual(patch);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("listas inválidas, tag inválida e fontes conflitantes falham antes do HTTP", async () => {
    const list = await run(registerChannelAccounts, ["channel-accounts", "comment-rules", "update", ACCOUNT, RULE,
      "--keywords", "[1]", ...json]);
    expect(String(list.error)).toContain("lista JSON de textos");
    const tag = await run(registerMessages, ["messages", "send-interactive", "--to", IGSID, "--json", "{}", "--tag", "invalid", ...json]);
    expect(String(tag.error)).toContain("human_agent");
    const sources = await run(registerChannelAccounts, ["channel-accounts", "messenger-profile", "update", "--channel-account-id", ACCOUNT,
      "--json", "{}", "--stdin", ...json]);
    expect(String(sources.error)).toContain("uma fonte");
    expect(fetch).not.toHaveBeenCalled();
  });

  const errorCommands = [
    [registerMessages, ["messages", "send-interactive", "--to", IGSID, "--json", JSON.stringify(igInteractiveCases[0])]],
    ...[["list", ACCOUNT], ["get", ACCOUNT, RULE], ["create", ACCOUNT, "--dm-text", "Oi!", ...extensionFlags],
      ["update", ACCOUNT, RULE, ...extensionFlags], ["delete", ACCOUNT, RULE]]
      .map((args) => [registerChannelAccounts, ["channel-accounts", "comment-rules", ...args]] as const),
    ...profileCases.map(([operation, , , flags]) => [registerChannelAccounts,
      ["channel-accounts", "messenger-profile", operation, "--channel-account-id", ACCOUNT, ...flags]] as const),
  ] as const;
  it.each(errorCommands)("propaga o erro HTTP 422: %s %j", async (register, args) => {
    fetch.mockImplementation(async () => Response.json({ error: { code: "invalid_request", message: "Contrato inválido" } }, { status: 422 }));
    const result = await run(register, [...args, ...json]);
    expect(result.error).toMatchObject({ code: "invalid_request", status: 422 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
