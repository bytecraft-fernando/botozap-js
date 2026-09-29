import { afterEach, describe, expect, it, vi } from "vitest";
import { startStreamableHttpServer, type RunningStreamableHttpServer } from "../src/http.js";
import { parseIdentity, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES, getToolPolicy, isToolAllowed } from "../src/permissions.js";
import { requestAuthContext } from "../src/auth-context.js";
import { createClient } from "../src/client.js";

const resource = "https://mcp.example.test/mcp";
const issuer = "https://app.example.test";
const identity: ApiIdentity = {
  auth_type: "oauth", account_id: "account-a", environment: "live", scopes: ["contacts:read", "contacts:write", "customers:write", "messages:send"],
  user_id: "user-a", client_id: "client-a", grant_id: "grant-a",
  allowed_routes: ["GET /v1/me", "GET /v1/contacts", "POST /v1/contacts", "PATCH /v1/contacts/:id", "POST /v1/customers", "POST /v1/messages"],
};
const servers: RunningStreamableHttpServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => s.close())); });

async function remote(tokens: Map<string, ApiIdentity>, wait?: (token: string, path: string) => Promise<void>) {
  const calls: { token: string; path: string }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = new Headers(init?.headers).get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const path = new URL(String(input)).pathname;
    calls.push({ token, path });
    await wait?.(token, path);
    const principal = tokens.get(token);
    if (!principal) return Response.json({ error: { code: "unauthorized", message: "Revoked." } }, { status: 401 });
    if (path === "/v1/me") return Response.json({ data: principal });
    if (path === "/v1/contacts") return Response.json({ data: [], paging: { cursors: { before: null, after: null }, next: null, previous: null } });
    if (path === "/v1/messages") return Response.json({ id: "message", wamid: "wamid.test", to: "5511999999999", status: "accepted" });
    return Response.json({ data: {} });
  });
  const server = await startStreamableHttpServer({ baseUrl: "https://api.test/v1", fetch,
    eventSignal: { subscribe: () => () => {} }, oauthResourceUrl: resource, oauthIssuerUrl: issuer });
  servers.push(server);
  return { server, calls, fetch };
}
async function rpc(server: RunningStreamableHttpServer, token: string, method: string, params: unknown = {}, session?: string) {
  return fetch(server.url, { method: "POST", headers: {
    Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream",
    "Mcp-Protocol-Version": "2025-03-26", ...(session ? { "Mcp-Session-Id": session } : {}),
  }, body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 100000) + 1, method, params }) });
}
async function initialize(server: RunningStreamableHttpServer, token: string) {
  const response = await rpc(server, token, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "oauth-test", version: "1" } });
  expect(response.status).toBe(200);
  await response.text();
  const session = response.headers.get("mcp-session-id");
  expect(session).toBeTruthy();
  return session!;
}
async function result(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const line = text.split("\n").find((part) => part.startsWith("data: "));
    return JSON.parse(line!.slice(6));
  }
  return JSON.parse(text);
}

describe("MCP OAuth protected resources and credential binding", () => {
  it("advertises canonical RFC 9728 metadata and a 401 discovery challenge", async () => {
    const { server } = await remote(new Map());
    const response = await fetch(server.url, { method: "POST" });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(`Bearer resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource/mcp"`);
    const metadata = await fetch(new URL("/.well-known/oauth-protected-resource/mcp", server.url));
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({ resource, authorization_servers: [issuer], bearer_methods_supported: ["header"] });
    const root = await fetch(new URL("/.well-known/oauth-protected-resource", server.url));
    expect(root.status).toBe(200);
  });

  it("accepts a refreshed token on the same session and uses it for API requests", async () => {
    const tokens = new Map([["first", identity], ["refreshed", identity]]);
    const { server, calls } = await remote(tokens);
    const session = await initialize(server, "first");
    tokens.delete("first");
    const response = await rpc(server, "refreshed", "tools/call", { name: "list_contacts", arguments: {} }, session);
    expect(response.status).toBe(200);
    expect((await result(response)).result.isError).not.toBe(true);
    expect(calls.filter((call) => call.path === "/v1/contacts")).toEqual([{ token: "refreshed", path: "/v1/contacts" }]);
  });

  it.each(["grant_id", "user_id", "client_id", "account_id"] as const)("rejects refresh into a different %s", async (field) => {
    const { server, calls } = await remote(new Map([["first", identity], ["other", { ...identity, [field]: "other" }]]));
    const session = await initialize(server, "first");
    const response = await rpc(server, "other", "tools/list", {}, session);
    expect(response.status).toBe(404);
    expect(calls.some((call) => call.path === "/v1/contacts")).toBe(false);
  });

  it("revalidates revocation on existing session requests", async () => {
    const tokens = new Map([["first", identity]]);
    const { server } = await remote(tokens);
    const session = await initialize(server, "first");
    tokens.clear();
    const response = await rpc(server, "first", "tools/list", {}, session);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("filters actions by current allowed routes while preserving operational writes", async () => {
    const tokens = new Map([["first", identity]]);
    const { server } = await remote(tokens);
    const session = await initialize(server, "first");
    const tools = (await result(await rpc(server, "first", "tools/list", {}, session))).result.tools.map((t: { name: string }) => t.name);
    expect(tools).toContain("create_contact");
    expect(tools).toContain("create_customer");
    expect(tools).toContain("send_message");
    expect(tools).not.toContain("delete_contact");
    expect(tools).not.toContain("delete_customer");
    tokens.set("first", { ...identity, allowed_routes: ["GET /v1/me", "GET /v1/contacts"] });
    const downgraded = (await result(await rpc(server, "first", "tools/list", {}, session))).result.tools.map((t: { name: string }) => t.name);
    expect(downgraded).toContain("list_contacts");
    expect(downgraded).not.toContain("create_contact");
    expect(downgraded).not.toContain("send_message");
  });

  it("keeps key sessions bound to the original key fingerprint", async () => {
    const keyIdentity = { account_id: "account-a", environment: "live" as const, scopes: ["contacts:read"] };
    const { server } = await remote(new Map([["bz_live_first", keyIdentity], ["bz_live_other", keyIdentity]]));
    const session = await initialize(server, "bz_live_first");
    expect((await rpc(server, "bz_live_other", "tools/list", {}, session)).status).toBe(404);
    expect((await rpc(server, "bz_live_first", "tools/list", {}, session)).status).toBe(200);
  });

  it("never crosses credentials between concurrent requests in one OAuth session", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const seen = new Promise<void>((resolve) => { entered = resolve; });
    const { server, calls } = await remote(new Map([["first", identity], ["refresh-a", identity], ["refresh-b", identity]]), async (token, path) => {
      if (token === "refresh-a" && path === "/v1/contacts") { entered(); await blocked; }
    });
    const session = await initialize(server, "first");
    const first = rpc(server, "refresh-a", "tools/call", { name: "list_contacts", arguments: {} }, session);
    await seen;
    const second = await rpc(server, "refresh-b", "tools/call", { name: "list_contacts", arguments: {} }, session);
    release();
    expect((await first).status).toBe(200);
    expect(second.status).toBe(200);
    await result(second);
    expect(calls.filter((call) => call.path === "/v1/contacts").map((call) => call.token).sort()).toEqual(["refresh-a", "refresh-b"]);
  });

  it("fails closed on malformed OAuth identity responses", () => {
    expect(() => parseIdentity({ ...identity, grant_id: undefined })).toThrow();
    expect(() => parseIdentity({ ...identity, allowed_routes: undefined })).toThrow();
    expect(() => parseIdentity({ ...identity, environment: "sandbox" })).toThrow();
  });

  it("has concrete route contracts for every registered tool", () => {
    for (const [name, policy] of Object.entries(MCP_TOOL_POLICIES)) {
      expect(policy.requiredRoutes?.length, name).toBeGreaterThan(0);
    }
    expect(isToolAllowed(getToolPolicy("delete_contact"), identity)).toBe(false);
    expect(isToolAllowed(getToolPolicy("create_contact"), identity)).toBe(true);
  });

  it("enforces the current route authority even within composite SDK calls", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ data: {} }));
    const client = createClient({ apiKey: "initial-token", fetch, resolveRequestAuth: async () => requestAuthContext.getStore()! });
    await requestAuthContext.run({ credential: "refreshed", identity }, async () => {
      await client.request("POST", "/contacts", { body: {} });
      await expect(client.request("DELETE", "/contacts/id")).rejects.toThrow();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer refreshed");
  });
});
