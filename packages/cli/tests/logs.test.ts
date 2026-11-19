import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerLogs } from "../src/commands/logs.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const auth = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];

beforeEach(() => {
  fetch.mockReset().mockImplementation(async () =>
    Response.json({
      data: [
        {
          id: "b47fde27-97e1-4ff4-bf36-859e23f337e4",
          source: "api",
          method: "POST",
          path: "/v1/messages",
          status_code: 422,
          request_id: "abcd1-1763420000000-0123456789ab",
          created_at: "2026-11-18T12:00:00Z",
        },
      ],
      paging: { cursors: { before: null, after: null }, next: null, previous: null },
    }),
  );
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("logs list", () => {
  it("mostra o id da chamada (x-request-id) na tabela", async () => {
    const result = await run(registerLogs, ["logs", "list", ...auth]);
    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain("ID DA CHAMADA");
    const row = result.stdout.split("\n").find((line) => line.includes("/v1/messages"));
    expect(row).toContain("abcd1-1763420000000-0123456789ab");
  });

  it("repassa os filtros para /v1/api_logs", async () => {
    const result = await run(registerLogs, ["logs", "list", "--method", "post", "--status-code", "422", ...auth, "-o", "json"]);
    expect(result.error).toBeUndefined();
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v1/api_logs");
    expect(url.searchParams.get("method")).toBe("post");
    expect(url.searchParams.get("status_code")).toBe("422");
    expect(JSON.parse(result.stdout).data[0].request_id).toBe("abcd1-1763420000000-0123456789ab");
  });
});

describe("logs meta", () => {
  it("lê /v1/api_logs/meta_hourly com o canal e o período, e mostra a hora, os recebidos e as falhas", async () => {
    fetch.mockImplementation(async () =>
      Response.json({
        data: [{ hour: "2026-11-19T21:00:00+00:00", received: 8, failed: 1, channels: [{ channel_account_id: "ca_1", received: 8, failed: 1 }] }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      }),
    );
    const result = await run(registerLogs, ["logs", "meta", "--channel-account-id", "ca_1", "--since", "2026-11-19T00:00:00Z", "--limit", "24", ...auth]);
    expect(result.error).toBeUndefined();
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect([url.pathname, url.searchParams.get("channel_account_id"), url.searchParams.get("since"), url.searchParams.get("limit")]).toEqual([
      "/v1/api_logs/meta_hourly", "ca_1", "2026-11-19T00:00:00Z", "24",
    ]);
    expect(result.stdout).toContain("COM FALHA");
    const row = result.stdout.split("\n").find((line) => line.includes("2026-11-19T21:00:00+00:00"));
    expect(row).toMatch(/8\s+1\s+1/);
  });
});
