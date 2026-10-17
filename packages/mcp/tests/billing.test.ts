/**
 * Plano e slots adicionais no MCP: get_billing, create_business_slot e
 * cancel_business_slot ficam só no catálogo de chave de API, com as quatro
 * anotações explícitas, e nunca no perfil `assistant` (OAuth).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const SLOT_ID = "a1000000-0000-4000-8000-000000000001";
const BILLING_TOOLS = ["get_billing", "create_business_slot", "cancel_business_slot"];

const slot = {
  id: SLOT_ID,
  status: "open",
  customer_id: null,
  customer_name: null,
  amount_cents: 4700,
  paid: false,
  next_due_date: "2026-11-17",
  invoice_url: null,
  paused: false,
  created_at: "2026-10-17T12:00:00.000Z",
};
const billing = {
  plan: "paid",
  included_businesses: 1,
  legacy_extra_businesses: 0,
  slot_amount_cents: 4700,
  can_add_slot: true,
  slots: [slot],
};

const billingIdentity: ApiIdentity = fullAccessIdentity;
const withoutBilling = fullAccessIdentity.scopes.filter((scope) => !scope.startsWith("billing:"));

type Captured = { method: string; path: string; idempotencyKey: string | null; body: unknown };
const clients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  vi.unstubAllEnvs();
});

async function connect(identity: ApiIdentity = billingIdentity, captured: Captured[] = []) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    captured.push({
      method,
      path: url.pathname,
      idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
      body: init?.body,
    });
    if (url.pathname === "/v1/billing" && method === "GET") return Response.json({ data: billing });
    if (url.pathname === "/v1/billing/slots" && method === "POST") {
      return Response.json({ data: slot }, { status: 201 });
    }
    if (url.pathname === `/v1/billing/slots/${SLOT_ID}` && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return Response.json({ error: { code: "not_found", message: "não encontrado" } }, { status: 404 });
  });
  const server = await buildServer(
    { apiKey: "bz_live_billing_test", baseUrl: "https://api.test/v1", fetch },
    identity,
  );
  const client = new Client({ name: "billing-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, fetch, captured };
}

describe("catálogo", () => {
  it("chave de API lista as três tools com as quatro anotações explícitas", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect(byName.get("get_billing")?.annotations).toEqual({
      readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true,
    });
    expect(byName.get("create_business_slot")?.annotations).toEqual({
      readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false,
    });
    expect(byName.get("cancel_business_slot")?.annotations).toEqual({
      readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true,
    });
    for (const name of BILLING_TOOLS) {
      const tool = byName.get(name)!;
      expect(Object.keys(tool.outputSchema?.properties ?? {}), name).not.toHaveLength(0);
      expect(tool.description, name).not.toMatch(/vaga|espaço|capacidade cheia/i);
    }
    expect(byName.get("create_business_slot")?.description).toContain("R$ 47/mês");
    expect(byName.get("cancel_business_slot")?.description).toContain("reembolso");
  });

  it("rotas e scopes seguem o contrato", () => {
    expect(TOOL_ROUTES.get_billing).toEqual(["GET /v1/billing"]);
    expect(TOOL_ROUTES.create_business_slot).toEqual(["POST /v1/billing/slots"]);
    expect(TOOL_ROUTES.cancel_business_slot).toEqual(["DELETE /v1/billing/slots/:id"]);
    expect(MCP_TOOL_POLICIES.get_billing?.requiredScopes).toEqual(["billing:read"]);
    expect(MCP_TOOL_POLICIES.create_business_slot?.requiredScopes).toEqual(["billing:write"]);
    expect(MCP_TOOL_POLICIES.cancel_business_slot?.requiredScopes).toEqual(["billing:write"]);
    for (const name of BILLING_TOOLS) expect(MCP_TOOL_POLICIES[name]?.sandbox, name).toBe(false);
  });

  it("perfil assistant (OAuth) não inclui nenhuma delas", async () => {
    for (const name of BILLING_TOOLS) expect(ASSISTANT_TOOLS.has(name), name).toBe(false);
    const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
    const oauth: ApiIdentity = {
      ...billingIdentity,
      auth_type: "oauth",
      client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac",
      user_id: "operator",
      grant_id: "grant",
      allowed_routes: routes,
    };
    const { client, fetch } = await connect(oauth);
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const name of BILLING_TOOLS) expect(names, name).not.toContain(name);
    const denied = await client.callTool({ name: "get_billing", arguments: {} });
    expect(denied.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [["billing:read"], ["get_billing"]],
    [["billing:write"], ["create_business_slot", "cancel_business_slot"]],
    [[], []],
  ])("scopes %j liberam só %j", async (extra, expected) => {
    const { client, fetch } = await connect({
      ...fullAccessIdentity,
      scopes: [...withoutBilling, ...extra],
    });
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names.filter((name) => BILLING_TOOLS.includes(name))).toEqual(expected);
    if (!extra.includes("billing:read")) {
      const denied = await client.callTool({ name: "get_billing", arguments: {} });
      expect(denied.isError).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it("chave sandbox não vê as tools", async () => {
    const { client } = await connect({ ...billingIdentity, environment: "sandbox" });
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const name of BILLING_TOOLS) expect(names, name).not.toContain(name);
  });
});

describe("chamadas", () => {
  it("get_billing lê GET /v1/billing", async () => {
    const { client, captured } = await connect();
    const result = await client.callTool({ name: "get_billing", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(captured).toEqual([
      { method: "GET", path: "/v1/billing", idempotencyKey: null, body: undefined },
    ]);
    expect(result.structuredContent).toEqual({ data: billing });
  });

  it("create_business_slot manda Idempotency-Key e devolve o slot", async () => {
    const { client, captured } = await connect();
    const result = await client.callTool({
      name: "create_business_slot",
      arguments: { idempotency_key: "compra-slot-0001" },
    });
    expect(result.isError).toBeFalsy();
    expect(captured).toEqual([
      { method: "POST", path: "/v1/billing/slots", idempotencyKey: "compra-slot-0001", body: undefined },
    ]);
    expect(result.structuredContent).toEqual({ data: slot });
  });

  it("create_business_slot recusa chave inválida antes do HTTP", async () => {
    const { client, captured } = await connect();
    for (const key of ["curta", "tem espaço no meio"]) {
      const result = await client.callTool({
        name: "create_business_slot",
        arguments: { idempotency_key: key },
      });
      expect(result.isError, key).toBe(true);
    }
    expect(captured).toHaveLength(0);
  });

  it("cancel_business_slot faz DELETE e devolve success no 204", async () => {
    const { client, captured } = await connect();
    const result = await client.callTool({
      name: "cancel_business_slot",
      arguments: { slot_id: SLOT_ID },
    });
    expect(result.isError).toBeFalsy();
    expect(captured).toEqual([
      { method: "DELETE", path: `/v1/billing/slots/${SLOT_ID}`, idempotencyKey: null, body: undefined },
    ]);
    expect(result.structuredContent).toEqual({ success: true });
  });

  it("recusa da API vira erro estruturado com o code", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "cancel_business_slot",
      arguments: { slot_id: "a1000000-0000-4000-8000-000000000099" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: "not_found", status: 404 } });
  });
});
