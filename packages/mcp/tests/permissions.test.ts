import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { fullAccessIdentity } from "./helpers/identity.js";
import { buildServer } from "../src/server.js";
import { getToolPolicy, MCP_TOOL_POLICIES } from "../src/permissions.js";

const clients: Client[] = [];
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";

async function connect(
  scopes: string[],
  environment: "live" | "sandbox" = "live",
  uiEnabled = false,
) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/me")) {
      return Response.json({ data: { account_id: ACCOUNT_ID, environment, scopes } });
    }
    throw new Error(`Rota inesperada na descoberta: ${url.pathname}`);
  });
  const server = await buildServer({
    apiKey: "bz_live_permission_test",
    uiEnabled,
    baseUrl: "https://api.test/v1",
    fetch,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "permission-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, fetch };
}

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
});

describe("filtro de permissões MCP", () => {
  it("fecha a descoberta sem scopes e mantém apenas o profile", async () => {
    const { client } = await connect([]);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["get_profile"]);
    expect(tools[0]?._meta).toEqual({ "openai/profile": true });
    await expect(client.listResourceTemplates()).rejects.toThrow();
  });

  it("exige todos os scopes usados pelo reply e permite só rotas sandbox declaradas", async () => {
    const sendOnly = await connect(["messages:send"], "sandbox");
    const sendOnlyTools = (await sendOnly.client.listTools()).tools.map((tool) => tool.name);
    expect(sendOnlyTools).toContain("send_message");
    expect(sendOnlyTools).not.toContain("reply_to_conversation");

    const both = await connect(["messages:send", "conversations:read", "contacts:read"], "sandbox");
    const tools = (await both.client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toContain("reply_to_conversation");
    expect(tools).toContain("list_contacts");
    expect(tools).not.toContain("get_contact");
    expect(tools).not.toContain("list_customers");
  });

  it("anota cada ferramenta com três hints booleanos e expõe perfil estruturado estável", async () => {
    const { client, fetch } = await connect([
      "messages:send", "messages:read", "events:read", "templates:read",
    ]);
    const tools = (await client.listTools()).tools;
    for (const tool of tools) {
      expect(tool.annotations).toEqual(expect.objectContaining({
        readOnlyHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
      }));
    }
    const profileTool = tools.find((tool) => tool.name === "get_profile");
    expect(profileTool?.outputSchema).toMatchObject({
      type: "object",
      required: ["id"],
      additionalProperties: false,
    });
    const result = await client.callTool({ name: "get_profile", arguments: {} });
    expect(result.structuredContent).toEqual({
      id: `botozap:${ACCOUNT_ID}:live`,
      nickname: "Conta BotoZap — produção",
    });
    expect(JSON.parse(result.content[0]!.type === "text" ? result.content[0].text : "{}")).toEqual(result.structuredContent);
    expect(fetch).toHaveBeenCalledTimes(2); // boot and fresh profile read
  });

  it("usa account_name da Conta no nickname quando a API o devolve (#629)", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/me")) {
        return Response.json({
          data: { account_id: ACCOUNT_ID, account_name: "Padaria da Maria", environment: "live", scopes: [] },
        });
      }
      throw new Error(`Rota inesperada na descoberta: ${url.pathname}`);
    });
    const server = await buildServer({ apiKey: "bz_live_account_name_test", baseUrl: "https://api.test/v1", fetch });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "account-name-test", version: "1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    clients.push(client);

    const result = await client.callTool({ name: "get_profile", arguments: {} });
    expect(result.structuredContent).toEqual({
      id: `botozap:${ACCOUNT_ID}:live`,
      nickname: "Padaria da Maria — produção",
    });
  });

  it("returns a schema-compatible error after profile revocation without leaking upstream details", async () => {
    const { client, fetch } = await connect([]);
    await client.listTools();
    fetch.mockResolvedValueOnce(Response.json({ error: { code: "unauthorized", message: "Bearer bz_live_permission_test" } }, { status: 401 }));
    const result = await client.callTool({ name: "get_profile", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("bz_live_permission_test");
  });

  it("does not expose or execute writes with a read-only credential", async () => {
    const { client, fetch } = await connect(["conversations:read"]);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).not.toContain("reply_to_conversation");
    expect(names).not.toContain("send_message");
    const result = await client.callTool({ name: "send_message", arguments: {} });
    expect(result.isError).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("covers every registered tool with explicit annotations", async () => {
    const { client } = await connect(fullAccessIdentity.scopes, "live", true);
    const tools = (await client.listTools()).tools;
    expect(tools.map(t => t.name).sort()).toEqual([...Object.keys(MCP_TOOL_POLICIES), "get_profile"].sort());
    for (const tool of tools) {
      expect(tool.annotations).toEqual(expect.objectContaining({
        readOnlyHint: expect.any(Boolean), destructiveHint: expect.any(Boolean), openWorldHint: expect.any(Boolean),
      }));
    }
    expect(tools.find(tool => tool.name === "phone_number_health")?.annotations)
      .toMatchObject({ readOnlyHint: false, openWorldHint: true });
    expect(tools.find(tool => tool.name === "send_message")?.annotations)
      .toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
  });

  it("classifies failed introspection without leaking credentials", async () => {
    for (const status of [401, 403, 429, 500]) {
      await expect(buildServer({ apiKey: "bz_live_permission_test", fetch: async () => Response.json({ error: { code: "failure", message: "secret" } }, { status }) }))
        .rejects.toMatchObject({ httpStatus: status === 500 ? 503 : status });
    }
    await expect(buildServer({ apiKey: "bz_live_permission_test", fetch: async () => { throw new TypeError("secret"); } }))
      .rejects.toMatchObject({ httpStatus: 503 });
  });

  it("does not start when /me fails or returns malformed identity", async () => {
    for (const fetch of [
      (async () => { throw new Error("Bearer bz_live_permission_test leaked upstream"); }) as typeof globalThis.fetch,
      (async () => Response.json({ data: { account_id: ACCOUNT_ID, environment: "unknown", scopes: ["messages:send"] } })) as typeof globalThis.fetch,
    ]) {
      await expect(buildServer({
        apiKey: "bz_live_permission_test",
        baseUrl: "https://api.test/v1",
        fetch,
      })).rejects.toMatchObject({ name: "IntrospectionError" });
    }
  });

  it("requires an explicit policy for every operation added to the audited catalog", () => {
    expect(Object.keys(MCP_TOOL_POLICIES).length).toBeGreaterThan(70);
    expect(() => getToolPolicy("future_tool_without_policy")).toThrow(/sem política/);
    for (const policy of Object.values(MCP_TOOL_POLICIES)) {
      expect(policy.requiredScopes.length).toBeGreaterThan(0);
      expect(typeof policy.sandbox).toBe("boolean");
      expect(typeof policy.readOnlyHint).toBe("boolean");
      expect(typeof policy.destructiveHint).toBe("boolean");
      expect(typeof policy.openWorldHint).toBe("boolean");
    }
  });
});
