import { describe, expect, it, vi } from "vitest";
import { BotoZap } from "../src/index.js";

describe("OAuth Bearer credentials", () => {
  it("uses the current access token for each request", async () => {
    let token = "oauth-first";
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
      return Response.json({ data: { account_id: "account", environment: "live", scopes: [], auth_type: "oauth", user_id: "user", client_id: "client", grant_id: "grant", allowed_routes: [] } });
    });
    const client = new BotoZap({ accessToken: async () => token, fetch });
    await client.me.get();
    token = "oauth-refreshed";
    expect((await client.me.get()).auth_type).toBe("oauth");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("also accepts a fixed OAuth token", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer oauth-token");
      return Response.json({ data: [] });
    });
    await new BotoZap({ accessToken: "oauth-token", fetch }).request("GET", "/events");
  });
  it("rejects missing or competing credentials", () => {
    expect(() => new BotoZap({})).toThrow();
    expect(() => new BotoZap({ apiKey: "key", accessToken: "token" })).toThrow();
  });
  it("does not send an invalid provider credential", async () => {
    const fetch = vi.fn();
    const client = new BotoZap({ accessToken: () => "bad token", fetch });
    await expect(client.me.get()).rejects.toMatchObject({ code: "invalid_credential", status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
