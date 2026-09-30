import { describe, expect, it } from "vitest";
import { BotoZap, BotoZapError, isPlanError, WEBHOOK_CATEGORIES } from "../src/index.js";

const BASE_URL = "https://api.test/v1";

function client(response: unknown, status = 201) {
  const requests: Array<{ url: string; method?: string; body: unknown }> = [];
  const boto = new BotoZap({
    apiKey: "bz_live_api_set",
    baseUrl: BASE_URL,
    fetch: (async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(JSON.stringify(response), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });
  return { boto, requests };
}

const SENT = { id: "10000000-0000-4000-8000-000000000001", wamid: "wamid.x", to: "5511999999999", status: "sent" };

describe("SDK — envios novos de 29/09", () => {
  it("sendInteractive envia o objeto da Cloud API", async () => {
    const { boto, requests } = client(SENT);
    const interactive = {
      type: "button" as const,
      body: { text: "Confirma?" },
      action: { buttons: [{ type: "reply" as const, reply: { id: "sim", title: "Sim" } }] },
    };
    await boto.messages.sendInteractive({ to: "+5511999999999", interactive });
    expect(requests[0]!.body).toEqual({ to: "+5511999999999", type: "interactive", interactive });
  });

  it("sendLocation omite name/address ausentes", async () => {
    const { boto, requests } = client(SENT);
    await boto.messages.sendLocation({ to: "+5511999999999", latitude: -3.1, longitude: -60.02, name: "Loja" });
    expect(requests[0]!.body).toEqual({
      to: "+5511999999999",
      type: "location",
      location: { latitude: -3.1, longitude: -60.02, name: "Loja" },
    });
  });

  it("sendReaction devolve o alvo e a ação", async () => {
    const { boto, requests } = client({
      ...SENT,
      type: "reaction",
      reaction: { message_id: "m1", wamid: "wamid.in", emoji: "", action: "unreact" },
    });
    const res = await boto.messages.sendReaction({ to: "+5511999999999", message_id: "wamid.in", emoji: "" });
    expect(requests[0]!.body).toEqual({
      to: "+5511999999999",
      type: "reaction",
      reaction: { message_id: "wamid.in", emoji: "" },
    });
    expect(res.reaction?.action).toBe("unreact");
  });

  it("list repassa sort", async () => {
    const { boto, requests } = client({ data: [], paging: { next: null, previous: null, has_more: false } }, 200);
    await boto.messages.list({ sort: "event_at", limit: 5 });
    expect(requests[0]!.url).toContain("sort=event_at");
  });

  it("isPlanError reconhece recusas de plano", async () => {
    const { boto } = client({ error: { code: "plan_restricted", message: "fora do plano" } }, 403);
    const err = await boto.messages.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect(isPlanError(err)).toBe(true);
    expect(isPlanError(new BotoZapError("invalid_request", "x", 422))).toBe(false);
  });

  it("expõe a categoria app_messages", () => {
    expect(WEBHOOK_CATEGORIES).toContain("app_messages");
  });
});
