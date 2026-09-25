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
