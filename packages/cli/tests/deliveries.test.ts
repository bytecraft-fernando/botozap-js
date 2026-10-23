import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerDeliveries } from "../src/commands/deliveries.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const channelId = "10b57232-bd10-475d-9a0f-4db5764923b9";
const auth = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];

beforeEach(() => {
  fetch.mockReset().mockImplementation(async () =>
    Response.json({
      data: [
        {
          id: "b47fde27-97e1-4ff4-bf36-859e23f337e4",
          event_type: "whatsapp.message.updated",
          status: "failed",
          response_code: 400,
          channel_account_id: channelId,
          created_at: "2026-10-22T17:17:05Z",
        },
      ],
      paging: { cursors: { before: null, after: null }, next: null, previous: null },
    }),
  );
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("deliveries list", () => {
  it("sends --channel-account-id as channel_account_id", async () => {
    const result = await run(registerDeliveries, [
      "deliveries", "list", "--status", "failed", "--channel-account-id", channelId, ...auth, "-o", "json",
    ]);
    expect(result.error).toBeUndefined();
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v1/webhook_deliveries");
    expect(url.searchParams.get("status")).toBe("failed");
    expect(url.searchParams.get("channel_account_id")).toBe(channelId);
  });

  it("shows the HTTP response code in the table", async () => {
    const result = await run(registerDeliveries, ["deliveries", "list", ...auth]);
    expect(result.error).toBeUndefined();
    const row = result.stdout.split("\n").find((line) => line.includes("whatsapp.message.updated"));
    expect(row).toContain("400");
  });
});
