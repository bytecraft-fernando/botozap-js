/**
 * Contrato do SDK para webhooks por canal: `channel_account_ids` no body de
 * create/update (ausente = não enviado; null explícito = enviado) e os campos
 * `channel_account_ids`/`channels_health` na resposta.
 */
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BotoZap,
  BotoZapError,
  type CreateWebhookParams,
  type UpdateWebhookParams,
  type Webhook,
  type WebhookChannelHealth,
} from "../src/index.js";

const WEBHOOK_ID = "22222222-2222-4222-8222-222222222222";
const CHANNEL_A = "33333333-3333-4333-8333-333333333333";
const CHANNEL_B = "44444444-4444-4444-8444-444444444444";

const health: WebhookChannelHealth[] = [
  {
    channel_account_id: CHANNEL_A,
    health_status: "paused",
    failure_streak: 15,
    next_attempt_at: null,
    paused_at: "2026-10-15T10:00:00.000Z",
    last_success_at: "2026-10-14T10:00:00.000Z",
    last_failure_at: "2026-10-15T10:00:00.000Z",
    last_response_code: 500,
  },
  {
    channel_account_id: null,
    health_status: "degraded",
    failure_streak: 2,
    next_attempt_at: "2026-10-15T10:05:00.000Z",
    paused_at: null,
    last_success_at: null,
    last_failure_at: "2026-10-15T10:01:00.000Z",
    last_response_code: null,
  },
];

const webhook = {
  id: WEBHOOK_ID,
  url: "https://hooks.example.test/boto",
  events: ["messages"],
  active: true,
  channel_account_ids: [CHANNEL_A, CHANNEL_B],
  health_status: "degraded",
  failure_streak: 15,
  channels_health: health,
};

const fetchMock = vi.fn();
const boto = new BotoZap({
  apiKey: "bz_live_wh_channels",
  baseUrl: "https://example.test/v1",
  fetch: fetchMock as unknown as typeof fetch,
});

function lastBody(): unknown {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(String(init.body));
}

function lastRequest(): { method: string; url: string } {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { method: init.method, url: String(url) };
}

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => Response.json({ data: webhook }));
});

describe("SDK — webhooks por canal", () => {
  it("tipos expõem channel_account_ids e channels_health", () => {
    expectTypeOf<CreateWebhookParams["channel_account_ids"]>().toEqualTypeOf<
      string[] | null | undefined
    >();
    expectTypeOf<UpdateWebhookParams["channel_account_ids"]>().toEqualTypeOf<
      string[] | null | undefined
    >();
    expectTypeOf<Webhook["channels_health"]>().toEqualTypeOf<WebhookChannelHealth[] | undefined>();
  });

  it("create envia channel_account_ids e devolve a saúde por canal", async () => {
    const created = await boto.webhooks.create({
      url: webhook.url,
      events: ["messages"],
      channel_account_ids: [CHANNEL_A, CHANNEL_B],
    });
    expect(lastRequest()).toEqual({ method: "POST", url: "https://example.test/v1/webhooks" });
    expect(lastBody()).toEqual({
      url: webhook.url,
      events: ["messages"],
      channel_account_ids: [CHANNEL_A, CHANNEL_B],
    });
    expect(created.channel_account_ids).toEqual([CHANNEL_A, CHANNEL_B]);
    expect(created.channels_health).toEqual(health);
  });

  it("create sem channel_account_ids não envia o campo", async () => {
    await boto.webhooks.create({ url: webhook.url, events: ["messages"] });
    expect(lastBody()).not.toHaveProperty("channel_account_ids");
  });

  it("create com null explícito envia null (todos os canais)", async () => {
    await boto.webhooks.create({ url: webhook.url, events: ["messages"], channel_account_ids: null });
    expect(lastBody()).toEqual({ url: webhook.url, events: ["messages"], channel_account_ids: null });
  });

  it("update: array limita, null volta a todos, ausente não mexe", async () => {
    await boto.webhooks.update(WEBHOOK_ID, { channel_account_ids: [CHANNEL_A] });
    expect(lastRequest()).toEqual({
      method: "PATCH",
      url: `https://example.test/v1/webhooks/${WEBHOOK_ID}`,
    });
    expect(lastBody()).toEqual({ channel_account_ids: [CHANNEL_A] });

    await boto.webhooks.update(WEBHOOK_ID, { channel_account_ids: null });
    expect(lastBody()).toEqual({ channel_account_ids: null });

    await boto.webhooks.update(WEBHOOK_ID, { active: false });
    expect(lastBody()).toEqual({ active: false });
  });

  it("list e get preservam channel_account_ids null e channels_health vazio", async () => {
    const healthy = { ...webhook, channel_account_ids: null, channels_health: [] };
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith("/webhooks")
        ? Response.json({ data: [healthy], paging: { cursors: {} } })
        : Response.json({ data: healthy }),
    );
    const list = await boto.webhooks.list();
    expect(list.data[0]?.channel_account_ids).toBeNull();
    expect(list.data[0]?.channels_health).toEqual([]);
    const got = await boto.webhooks.get(WEBHOOK_ID);
    expect(got.channel_account_ids).toBeNull();
  });

  it.each([
    [422, "invalid_channel_account_ids"],
    [404, "channel_account_not_found"],
  ])("propaga %i %s como BotoZapError", async (status, code) => {
    fetchMock.mockImplementation(async () =>
      Response.json({ error: { code, message: "erro" } }, { status }),
    );
    const err = await boto.webhooks
      .update(WEBHOOK_ID, { channel_account_ids: ["x"] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).status).toBe(status);
    expect((err as BotoZapError).code).toBe(code);
  });
});
