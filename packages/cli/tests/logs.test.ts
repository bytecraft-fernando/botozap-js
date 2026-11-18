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
          request_id: "gru1::abc-123",
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
    expect(row).toContain("gru1::abc-123");
  });

  it("repassa os filtros para /v1/api_logs", async () => {
    const result = await run(registerLogs, ["logs", "list", "--method", "post", "--status-code", "422", ...auth, "-o", "json"]);
    expect(result.error).toBeUndefined();
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v1/api_logs");
    expect(url.searchParams.get("method")).toBe("post");
    expect(url.searchParams.get("status_code")).toBe("422");
    expect(JSON.parse(result.stdout).data[0].request_id).toBe("gru1::abc-123");
  });
});
