/**
 * Código da Meta nas recusas (`error.meta_code` → `BotoZapError.metaCode`) e
 * reenvio de entrega de webhook (`POST /v1/webhook_deliveries/{id}/replay`).
 */
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BotoZap,
  BotoZapError,
  type BotoZapErrorCode,
  type SendFailureDetails,
  type WebhookDeliveryReplay,
} from "../src/index.js";

const DELIVERY = "d0000000-0000-4000-8000-0000000000d1";
const CONV = "c0000000-0000-4000-8000-0000000000c1";

function setup(response: () => Response) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  const client = new BotoZap({ apiKey: "bz_live_secret_for_test", baseUrl: "https://example.test/v1", fetch });
  const call = (i = 0) => {
    const init = fetch.mock.calls[i]?.[1] as RequestInit | undefined;
    return { url: fetch.mock.calls[i]?.[0] as string, method: init?.method, body: init?.body };
  };
  return { client, call };
}

const metaError = (extra: Record<string, unknown>) => () =>
  Response.json(
    { error: { code: "meta_error", message: "Meta recusou o envio.", outcome: "rejected", retry: "unknown", ...extra } },
    { status: 422 },
  );

describe("BotoZapError.metaCode", () => {
  it("lê error.meta_code inteiro no envio, junto de outcome e retry", async () => {
    const { client } = setup(metaError({ meta_code: 131026 }));
    const error = await client.messages.send({ to: "5511999999999", text: "oi" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect(error).toMatchObject({ code: "meta_error", status: 422, outcome: "rejected", retry: "unknown", metaCode: 131026 });
    expectTypeOf<BotoZapError["metaCode"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SendFailureDetails["metaCode"]>().toEqualTypeOf<number | undefined>();
  });

  it("lê error.meta_code no pedido de consentimento", async () => {
    const { client } = setup(metaError({ meta_code: 131047 }));
    const error = await client.conversations.requestConsent(CONV).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "meta_error", metaCode: 131047 });
  });

  it.each([
    ["ausente", {}],
    ["string", { meta_code: "131026" }],
    ["fracionário", { meta_code: 131026.5 }],
    ["fora do inteiro seguro", { meta_code: 2 ** 60 }],
    ["null", { meta_code: null }],
    ["objeto", { meta_code: { code: 131026 } }],
  ])("meta_code %s não vira metaCode", async (_label, extra) => {
    const { client } = setup(metaError(extra));
    const error = await client.messages.send({ to: "5511999999999", text: "oi" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).metaCode).toBeUndefined();
    expect(error).toMatchObject({ code: "meta_error", outcome: "rejected" });
  });

  it("aceita metaCode pelo construtor e o mantém ausente sem detalhes", () => {
    expect(new BotoZapError("meta_error", "x", 422, undefined, { metaCode: 470 }).metaCode).toBe(470);
    expect(new BotoZapError("not_found", "x", 404).metaCode).toBeUndefined();
  });
});

describe("webhookDeliveries.replay", () => {
  it("faz POST sem corpo em /webhook_deliveries/{id}/replay e devolve o item", async () => {
    const replayed: WebhookDeliveryReplay = { id: DELIVERY, status: "pending", replayed: true };
    const { client, call } = setup(() => Response.json({ data: replayed }));
    const result = await client.webhookDeliveries.replay(DELIVERY);
    expect(result).toEqual(replayed);
    expectTypeOf(result).toEqualTypeOf<WebhookDeliveryReplay>();
    expect(call()).toEqual({
      method: "POST",
      url: `https://example.test/v1/webhook_deliveries/${DELIVERY}/replay`,
      body: undefined,
    });
  });

  it("codifica o id no caminho", async () => {
    const { client, call } = setup(() => Response.json({ data: { id: "x", status: "pending", replayed: true } }));
    await client.webhookDeliveries.replay("a/b?c");
    expect(call().url).toBe("https://example.test/v1/webhook_deliveries/a%2Fb%3Fc/replay");
  });

  it.each([
    [404, "not_found"],
    [409, "delivery_not_replayable"],
    [409, "forward_limit_reached"],
  ] as const)("recusa %i vira BotoZapError %s", async (status, code) => {
    const { client } = setup(() => Response.json({ error: { code, message: "recusa" } }, { status }));
    const error = await client.webhookDeliveries.replay(DELIVERY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect(error).toMatchObject({ code, status, message: "recusa" });
    const typed: BotoZapErrorCode = code;
    expect(typed).toBe(code);
  });

  it("429 replay_rate_limited expõe os headers de rate limit", async () => {
    const { client } = setup(() =>
      Response.json(
        { error: { code: "replay_rate_limited", message: "Muitos reenvios." } },
        { status: 429, headers: { "Retry-After": "30", "X-RateLimit-Remaining": "0" } },
      ),
    );
    const error = await client.webhookDeliveries.replay(DELIVERY).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "replay_rate_limited", status: 429 });
    expect((error as BotoZapError).headers).toMatchObject({ "retry-after": "30", "x-ratelimit-remaining": "0" });
  });

  it("resposta sem envelope data é contrato violado", async () => {
    const { client } = setup(() => Response.json({ id: DELIVERY, status: "pending", replayed: true }));
    await expect(client.webhookDeliveries.replay(DELIVERY)).rejects.toMatchObject({ code: "malformed_response" });
  });
});
