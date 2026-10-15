import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerWebhooks } from "../src/commands/webhooks.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const webhookId = "22222222-2222-4222-8222-222222222222";
const customerId = "11111111-1111-4111-8111-111111111111";
const flags = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1", "-o", "json"];

beforeEach(() => {
  fetch
    .mockReset()
    .mockImplementation(async () => Response.json({ data: { id: webhookId, url: "https://meu.app/hook" } }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = fetch.mock.calls.at(-1)!;
  return { url: String(url), method: init.method, body: JSON.parse(init.body) };
}

it("create sends customer_id when --customer-id is given", async () => {
  const result = await run(registerWebhooks, [
    "webhooks", "create", "--url", "https://meu.app/hook", "--events", "messages,crm",
    "--customer-id", customerId, ...flags,
  ]);
  expect(result.error).toBeUndefined();
  const call = lastCall();
  expect(call.method).toBe("POST");
  expect(call.url).toBe("https://example.test/v1/webhooks");
  expect(call.body).toEqual({ url: "https://meu.app/hook", events: ["messages", "crm"], customer_id: customerId });
});

it("create without --customer-id omits the field", async () => {
  await run(registerWebhooks, ["webhooks", "create", "--url", "https://meu.app/hook", "--events", "messages", ...flags]);
  expect(lastCall().body).not.toHaveProperty("customer_id");
});

it("update sets and clears customer_id", async () => {
  await run(registerWebhooks, ["webhooks", "update", webhookId, "--customer-id", customerId, ...flags]);
  let call = lastCall();
  expect(call.method).toBe("PATCH");
  expect(call.url).toBe(`https://example.test/v1/webhooks/${webhookId}`);
  expect(call.body).toEqual({ customer_id: customerId });

  await run(registerWebhooks, ["webhooks", "update", webhookId, "--clear-customer", ...flags]);
  call = lastCall();
  expect(call.body).toEqual({ customer_id: null });
});

it("update rejects --customer-id with --clear-customer before HTTP", async () => {
  const result = await run(registerWebhooks, [
    "webhooks", "update", webhookId, "--customer-id", customerId, "--clear-customer", ...flags,
  ]);
  expect(String(result.error)).toContain("não os dois");
  expect(fetch).not.toHaveBeenCalled();
});

it("update --secret sends secret at the top level of the PATCH body", async () => {
  const secret = "novo-segredo-com-16-ou-mais";
  const result = await run(registerWebhooks, ["webhooks", "update", webhookId, "--secret", secret, ...flags]);
  expect(result.error).toBeUndefined();
  const call = lastCall();
  expect(call.method).toBe("PATCH");
  expect(call.url).toBe(`https://example.test/v1/webhooks/${webhookId}`);
  expect(call.body).toEqual({ secret });
});

const channelA = "33333333-3333-4333-8333-333333333333";
const channelB = "44444444-4444-4444-8444-444444444444";
const humanFlags = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];

it("create sends channel_account_ids from repeated and comma-separated --channel-account-id", async () => {
  const result = await run(registerWebhooks, [
    "webhooks", "create", "--url", "https://meu.app/hook", "--events", "messages",
    "--channel-account-id", channelA, "--channel-account-id", ` ${channelB},`, ...flags,
  ]);
  expect(result.error).toBeUndefined();
  expect(lastCall().body).toEqual({
    url: "https://meu.app/hook",
    events: ["messages"],
    channel_account_ids: [channelA, channelB],
  });
});

it("create without --channel-account-id omits channel_account_ids", async () => {
  await run(registerWebhooks, ["webhooks", "create", "--url", "https://meu.app/hook", "--events", "messages", ...flags]);
  expect(lastCall().body).not.toHaveProperty("channel_account_ids");
});

it("update limits to channels and --all-channels sends null", async () => {
  await run(registerWebhooks, ["webhooks", "update", webhookId, "--channel-account-id", `${channelA},${channelB}`, ...flags]);
  expect(lastCall().body).toEqual({ channel_account_ids: [channelA, channelB] });

  await run(registerWebhooks, ["webhooks", "update", webhookId, "--all-channels", ...flags]);
  expect(lastCall().body).toEqual({ channel_account_ids: null });
});

it("update rejects --channel-account-id with --all-channels before HTTP", async () => {
  const result = await run(registerWebhooks, [
    "webhooks", "update", webhookId, "--channel-account-id", channelA, "--all-channels", ...flags,
  ]);
  expect(String(result.error)).toContain("não os dois");
  expect(fetch).not.toHaveBeenCalled();
});

it("get shows channels and a per-channel health table in human output", async () => {
  fetch.mockImplementation(async () => Response.json({
    data: {
      id: webhookId,
      url: "https://meu.app/hook",
      channel_account_ids: [channelA, channelB],
      health_status: "degraded",
      failure_streak: 15,
      channels_health: [
        {
          channel_account_id: channelA, health_status: "paused", failure_streak: 15,
          next_attempt_at: null, paused_at: "2026-10-15T10:00:00.000Z",
          last_success_at: null, last_failure_at: "2026-10-15T10:00:00.000Z", last_response_code: 500,
        },
        {
          channel_account_id: null, health_status: "degraded", failure_streak: 2,
          next_attempt_at: "2026-10-15T10:05:00.000Z", paused_at: null,
          last_success_at: null, last_failure_at: "2026-10-15T10:01:00.000Z", last_response_code: null,
        },
      ],
    },
  }));
  const result = await run(registerWebhooks, ["webhooks", "get", webhookId, ...humanFlags]);
  expect(result.error).toBeUndefined();
  expect(result.stdout).toContain(`${channelA}, ${channelB}`);
  expect(result.stdout).not.toContain("[object Object]");
  expect(result.stdout).toContain("Saúde por canal");
  expect(result.stdout).toContain("paused");
  expect(result.stdout).toContain("(eventos sem canal)");
  expect(result.stdout).toContain("2026-10-15T10:05:00.000Z");
});

it("get says all channels when channel_account_ids is null and health is empty", async () => {
  fetch.mockImplementation(async () => Response.json({
    data: { id: webhookId, url: "https://meu.app/hook", channel_account_ids: null, channels_health: [] },
  }));
  const result = await run(registerWebhooks, ["webhooks", "get", webhookId, ...humanFlags]);
  expect(result.stdout).toMatch(/channel_account_ids\s+todos/);
  expect(result.stdout).toContain("todos os canais saudáveis");
});

it("get explains an empty channel list", async () => {
  fetch.mockImplementation(async () => Response.json({
    data: { id: webhookId, url: "https://meu.app/hook", channel_account_ids: [], channels_health: [] },
  }));
  const result = await run(registerWebhooks, ["webhooks", "get", webhookId, ...humanFlags]);
  expect(result.stdout).toContain("não recebe eventos");
});

it("list shows channel scope and failing-channel count", async () => {
  fetch.mockImplementation(async () => Response.json({
    data: [
      {
        id: webhookId, url: "https://meu.app/hook", active: true, events: ["messages"],
        channel_account_ids: [channelA, channelB], health_status: "degraded",
        channels_health: [{ channel_account_id: channelA, health_status: "paused", failure_streak: 15 }],
      },
      {
        id: customerId, url: "https://outro.app/hook", active: true, events: ["messages"],
        channel_account_ids: null, health_status: "healthy", channels_health: [],
      },
    ],
    paging: { cursors: {} },
  }));
  const result = await run(registerWebhooks, ["webhooks", "list", ...humanFlags]);
  expect(result.error).toBeUndefined();
  expect(result.stdout).toContain("CANAIS");
  expect(result.stdout).toContain("2 canais");
  expect(result.stdout).toContain("degraded (1 canal com falha)");
  expect(result.stdout).toMatch(/todos\s+healthy/);
});
