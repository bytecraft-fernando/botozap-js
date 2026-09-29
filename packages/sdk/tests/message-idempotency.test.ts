import { describe, expect, it } from "vitest";
import { BotoZap } from "../src/index.js";

describe("send idempotency transport", () => {
  it("forwards the optional header for every send and conversation replies, never in the body", async () => {
    const calls: { path: string; headers: Headers; body: any }[] = [];
    const sdk = new BotoZap({ apiKey: "bz_live_fixture", baseUrl: "https://api.test/v1", fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : null });
      return Response.json(path.includes("conversations") ? { data: { phone_number_id: "number", contact: { wa_id: "5511999999999" } } } : { id: null, wamid: "wamid.accepted", to: "5511999999999", status: "accepted" });
    } });
    const options = { idempotencyKey: "intent-fixed-123" };
    await sdk.messages.send({ to: "5511999999999", text: "oi" }, options);
    await sdk.messages.sendTemplate({ to: "5511999999999", template: { name: "welcome", language: { code: "pt_BR" } } }, options);
    await sdk.messages.sendMedia({ to: "5511999999999", type: "image", link: "https://example.test/image.png" }, options);
    await sdk.conversations.reply("conversation", { text: "oi" }, options);
    await sdk.messages.send({ to: "5511999999999", text: "legacy" });
    expect(calls.filter(c => c.path.endsWith("messages")).map(c => c.headers.get("Idempotency-Key"))).toEqual([options.idempotencyKey, options.idempotencyKey, options.idempotencyKey, options.idempotencyKey, null]);
    expect(calls.every(c => !c.body || (!('idempotency_key' in c.body) && !('idempotencyKey' in c.body)))).toBe(true);
    expect(calls.find(c => c.path.includes("conversations"))!.headers.has("Idempotency-Key")).toBe(false);
  });
});


it("preserves only validated send outcome and retry hints on SDK errors", async () => {
  for (const [details, expected] of [
    [{ outcome: "rejected", retry: "backoff" }, { outcome: "rejected", retry: "backoff" }],
    [{ outcome: "unknown", retry: "reconcile_first" }, { outcome: "unknown", retry: "reconcile_first" }],
    [{ outcome: "untrusted-string", retry: { private: "data" } }, { outcome: undefined, retry: undefined }],
  ]) {
    const sdk = new BotoZap({ apiKey: "bz_live_fixture", fetch: async () => Response.json({ error: { code: "dispatch_unavailable", message: "Retry later", ...details } }, { status: 503 }) });
    await expect(sdk.messages.send({ to: "5511999999999", text: "oi" }, { idempotencyKey: "same-key" })).rejects.toMatchObject({ code: "dispatch_unavailable", status: 503, ...expected });
  }
});
