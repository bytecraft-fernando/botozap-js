import { expect, expectTypeOf, it, vi } from "vitest";
import { BotoZap, type Me } from "../src/index.js";

it("reads the authenticated account identity and unwraps the item envelope", async () => {
  const identity: Me = {
    account_id: "11111111-1111-4111-8111-111111111111",
    environment: "sandbox",
    scopes: ["customers:read", "messages:send"],
  };
  const fetch = vi.fn(async () => Response.json({ data: identity }));
  const client = new BotoZap({
    apiKey: "bz_sandbox_secret_for_test",
    baseUrl: "https://example.test/v1",
    fetch,
  });

  const result = await client.me.get();

  expect(result).toEqual(identity);
  expectTypeOf(result).toEqualTypeOf<Me>();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0]?.[0]).toBe("https://example.test/v1/me");
  expect(fetch.mock.calls[0]?.[1]?.method).toBe("GET");
  expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("authorization"))
    .toBe("Bearer bz_sandbox_secret_for_test");
  expect(JSON.stringify(result)).not.toContain("bz_sandbox_secret_for_test");
});
