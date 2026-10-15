import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { registerChannelAccounts } from "../src/commands/channel-accounts.js";
import { registerContacts } from "../src/commands/contacts.js";
import { registerConversations } from "../src/commands/conversations.js";
import { run } from "./helpers.js";
const fetch = vi.fn();
const base = ["--api-key", "bz_live_test", "--api-url", "https://api.test/v1", "-o", "json"];
const connection = { status: "active", health: "conectado", diagnostic: { next_step: "Mande um direct" } };
beforeEach(() => { fetch.mockReset().mockResolvedValue(Response.json({ data: connection })); vi.stubGlobal("fetch", fetch); });
afterEach(() => vi.unstubAllGlobals());
it.each([["get", "GET", ""], ["resubscribe", "POST", "/resubscribe"], ["disconnect", "DELETE", ""]])("connection %s chama a API e imprime diagnóstico", async (op, method, suffix) => {
  const result = await run(registerChannelAccounts, [...base, "channel-accounts", "connection", op!, "account"]);
  expect(result.error).toBeUndefined(); expect(JSON.parse(result.stdout)).toEqual(connection);
  expect(fetch).toHaveBeenCalledWith(`https://api.test/v1/channel_accounts/account/connection${suffix}`, expect.objectContaining({ method }));
});
it.each(["png", "svg"])("message-rules qr salva %s byte a byte", async format => {
  const dir = mkdtempSync(join(tmpdir(), "botozap-qr-")); const out = join(dir, `qr.${format}`);
  try {
    const bytes = Buffer.from(format === "png" ? [137, 80, 78, 71, 0, 255] : '<svg xmlns="http://www.w3.org/2000/svg"/>');
    fetch.mockResolvedValue(new Response(bytes, { headers: { "Content-Type": `image/${format === "svg" ? "svg+xml" : "png"}` } }));
    const result = await run(registerChannelAccounts, [...base, "channel-accounts", "message-rules", "qr", "account", "rule", "--format", format, "--out", out]);
    expect(result.error).toBeUndefined(); expect(readFileSync(out)).toEqual(bytes);
    expect(JSON.parse(result.stdout)).toEqual({ out, format, bytes: bytes.length });
    expect(fetch.mock.calls[0]![0]).toBe(`https://api.test/v1/channel_accounts/account/message-rules/rule/qr?format=${format}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it.each([{ flags: ["--format", "pdf", "--out", "file"] }, { flags: [] }])("QR exige arquivo e formato válido ($flags)", async ({ flags }) => {
  const result = await run(registerChannelAccounts, [...base, "channel-accounts", "message-rules", "qr", "account", "rule", ...flags]);
  expect(result.error).toBeDefined(); expect(fetch).not.toHaveBeenCalled();
});
it.each([true, false])("filtro de seguidores %s chega a contatos e conversas", async value => {
  fetch.mockImplementation(async () => Response.json({ data: [], paging: {} }));
  for (const [register, command] of [[registerContacts, "contacts"], [registerConversations, "conversations"]] as const) {
    const result = await run(register, [...base, command, "list", "--follows-business", String(value)]);
    expect(result.error).toBeUndefined();
  }
  for (const [url] of fetch.mock.calls) expect(new URL(url).searchParams.get("ig_follows_business")).toBe(String(value));
});
it.each(["create", "update"])("comment-rules %s preserva live e condição de seguidor", async op => {
  const args = ["channel-accounts", "comment-rules", op, "account", ...(op === "update" ? ["rule"] : []), "--live", "false", "--require-follow", "false", "--non-follower-text", "Siga a conta", "--dm-text", "Oi"];
  const result = await run(registerChannelAccounts, [...base, ...args]);
  expect(result.error).toBeUndefined();
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ live: false, require_follow: false, non_follower_text: "Siga a conta", dm_text: "Oi" });
});
it.each(["create", "update"])("message-rules %s combina flags de seguidor e JSON", async op => {
  const payload = op === "create" ? { name: "Campanha", trigger: "ref", actions: [{ type: "stage", stage_id: null }] } : {};
  const result = await run(registerChannelAccounts, [...base, "channel-accounts", "message-rules", op, "account", ...(op === "update" ? ["rule"] : []), "--json", JSON.stringify(payload), "--require-follow", "false", "--clear-non-follower-text"]);
  expect(result.error).toBeUndefined();
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ ...payload, require_follow: false, non_follower_text: null });
});
it("message-rules update aceita somente flags e rejeita campo duplicado no JSON", async () => {
  const args = [...base, "channel-accounts", "message-rules", "update", "account", "rule", "--require-follow", "false"];
  expect((await run(registerChannelAccounts, args)).error).toBeUndefined();
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ require_follow: false });
  const result = await run(registerChannelAccounts, [...args, "--json", '{"require_follow":true}']);
  expect(String(result.error)).toContain("informado no JSON e na flag"); expect(fetch).toHaveBeenCalledTimes(1);
});
it("booleans inválidos são recusados antes da requisição", async () => {
  for (const flag of ["live", "require-follow"]) {
    const result = await run(registerChannelAccounts, [...base, "channel-accounts", "comment-rules", "update", "account", "rule", `--${flag}`, "maybe"]);
    expect(result.error).toBeDefined();
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("message-rules update sem fonte nem campos falha antes do HTTP", async () => {
  const result = await run(registerChannelAccounts, [...base, "channel-accounts", "message-rules", "update", "account", "rule"]);
  expect(String(result.error)).toContain("Informe uma fonte"); expect(fetch).not.toHaveBeenCalled();
});
it("QR usa PNG por padrão e falha de API não cria o arquivo", async () => {
  const dir = mkdtempSync(join(tmpdir(), "botozap-qr-error-")); const out = join(dir, "qr.png");
  try {
    fetch.mockResolvedValue(Response.json({ error: { code: "not_found", message: "Sem link" } }, { status: 404 }));
    const result = await run(registerChannelAccounts, [...base, "channel-accounts", "message-rules", "qr", "account", "rule", "--out", out]);
    expect(result.error).toMatchObject({ code: "not_found", status: 404 });
    expect(fetch.mock.calls[0]![0]).toContain("?format=png"); expect(() => readFileSync(out)).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
