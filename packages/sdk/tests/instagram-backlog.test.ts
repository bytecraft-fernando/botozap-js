import { describe, expect, it, vi } from "vitest";
import { BotoZap, type BotoZapEvent } from "../src/index.js";

const id = "conta/1", ruleId = "regra/1";
const path = "/channel_accounts/conta%2F1";
const connection = {
  status: "active", username: "loja", subscribed_at: "2026-10-15T12:00:00Z",
  token_expires_at: null, revoked_reason: null, health: "conectado", subscribed_fields: ["messages"],
  diagnostic: { code: "conectado", message: "Conectado", next_step: "Mande um direct", help_url: "/ajuda/comece-aqui/conectar-instagram" },
};
function setup(responses: Response[]) {
  const fetch = vi.fn(async () => { const response = responses.shift(); if (!response) throw Error("requisição inesperada"); return response; });
  return { fetch, api: new BotoZap({ accessToken: async () => "oauth-test", baseUrl: "https://api.test/v1", fetch }) };
}
const json = (data: unknown) => Response.json({ data });

describe("Instagram — backlog", () => {
  it.each([
    ["getConnection", "GET", "/connection"],
    ["resubscribeConnection", "POST", "/connection/resubscribe"],
    ["disconnect", "DELETE", "/connection"],
  ] as const)("%s retorna o estado confirmado com credencial e id codificado", async (method, verb, suffix) => {
    const { api, fetch } = setup([json(connection)]);
    expect(await api.channelAccounts[method](id)).toEqual(connection);
    expect(fetch).toHaveBeenCalledWith(`https://api.test/v1${path}${suffix}`, expect.objectContaining({ method: verb, body: undefined,
      headers: expect.objectContaining({ Authorization: "Bearer oauth-test" }) }));
  });

  it.each([undefined, "png", "svg"] as const)("getMessageRuleQr baixa bytes sem passar por JSON (%s)", async format => {
    const bytes = format === "svg" ? new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>') : new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
    const { api, fetch } = setup([new Response(bytes, { headers: { "Content-Type": format === "svg" ? "image/svg+xml" : "image/png" } })]);
    expect(new Uint8Array(await api.channelAccounts.getMessageRuleQr(id, ruleId, { format }))).toEqual(bytes);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/v1${path}/message-rules/regra%2F1/qr${format ? `?format=${format}` : ""}`);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer oauth-test");
  });

  it.each([404, 422, 429])( "QR preserva erro JSON e headers HTTP %s", async status => {
    const { api } = setup([Response.json({ error: { code: "not_found", message: "Sem link" } }, { status, headers: { "Retry-After": "5" } })]);
    await expect(api.channelAccounts.getMessageRuleQr(id, ruleId)).rejects.toMatchObject({ code: "not_found", status, headers: { "retry-after": "5" } });
  });
  it("QR rejeita envelopes de erro 2xx e respostas JSON sem arquivo", async () => {
    const { api } = setup([Response.json({ error: { code: "not_ready", message: "Aguarde" } }, { status: 202 }), json({})]);
    await expect(api.channelAccounts.getMessageRuleQr(id, ruleId)).rejects.toMatchObject({ code: "not_ready", status: 202 });
    await expect(api.channelAccounts.getMessageRuleQr(id, ruleId)).rejects.toMatchObject({ code: "malformed_response" });
  });
  it("QR normaliza falha de rede", async () => {
    const api = new BotoZap({ apiKey: "key", fetch: vi.fn().mockRejectedValue(new TypeError("offline")) });
    await expect(api.channelAccounts.getMessageRuleQr(id, ruleId)).rejects.toMatchObject({ code: "network_error", status: 0 });
  });
  it.each([true, false, undefined])("contatos e conversas preservam o filtro %s", async value => {
    const list = { data: [], paging: { cursors: { before: null, after: null }, next: null, previous: null } };
    const { api, fetch } = setup([Response.json(list), Response.json(list)]);
    await api.contacts.list({ ig_follows_business: value });
    await api.conversations.list({ ig_follows_business: value });
    for (const [url] of fetch.mock.calls as unknown as [string][]) {
      expect(new URL(url).searchParams.get("ig_follows_business")).toBe(value === undefined ? null : String(value));
    }
  });
  it("regras preservam live, condição de seguidor, ref_link e null no PATCH", async () => {
    const fields = { live: true, require_follow: true, non_follower_text: "Siga e toque de novo" };
    const linked = { ref_link: "https://ig.me/m/loja?ref=campanha", require_follow: true, non_follower_text: null };
    const { api, fetch } = setup([json(fields), json(fields), json(linked), json(linked), json(linked)]);
    expect(await api.channelAccounts.createCommentRule(id, { dm_text: "Olá", ...fields })).toEqual(fields);
    await api.channelAccounts.updateCommentRule(id, ruleId, { live: false, require_follow: false, non_follower_text: null });
    expect(await api.channelAccounts.createMessageRule(id, { name: "Campanha", trigger: "ref", actions: [{ type: "stage", stage_id: null }], require_follow: true, non_follower_text: null })).toEqual(linked);
    await api.channelAccounts.updateMessageRule(id, ruleId, { require_follow: false, non_follower_text: null });
    expect(await api.channelAccounts.getMessageRule(id, ruleId)).toEqual(linked);
    expect(JSON.parse((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual({ live: false, require_follow: false, non_follower_text: null });
    expect(JSON.parse((fetch.mock.calls[3] as unknown as [string, RequestInit])[1].body as string)).toEqual({ require_follow: false, non_follower_text: null });
  });
  it("live indisponível permanece BotoZapError feature_unavailable", async () => {
    const { api } = setup([Response.json({ error: { code: "feature_unavailable", message: "Lives indisponíveis" } }, { status: 422 })]);
    await expect(api.channelAccounts.createCommentRule(id, { dm_text: "Oi", live: true })).rejects.toMatchObject({ code: "feature_unavailable", status: 422 });
  });
  it("contato inclui dados somente leitura e evento de referral aceita message_id null", async () => {
    const profile = { id: "contact", ig_follows_business: false, ig_followed_by_business: null, ig_follower_count: 120, ig_verified: false, ig_follow_checked_at: null };
    const { api } = setup([json(profile)]);
    expect(await api.contacts.get("contact")).toEqual(profile);
    const event: Pick<BotoZapEvent, "message_id"> = { message_id: null };
    expect(event.message_id).toBeNull();
  });
});
