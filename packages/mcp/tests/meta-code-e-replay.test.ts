/**
 * Código da Meta nas recusas (`meta_code`) e reenvio de entrega de webhook
 * (`replay_webhook_delivery`) no MCP. O código vai no texto para todos; no erro
 * estruturado, só no catálogo completo: o perfil assistant (app revisado do
 * ChatGPT) segue anunciando e devolvendo o erro revisado. A tool nova fica só
 * no catálogo completo.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { requestAuthContext } from "../src/auth-context.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const CONV = "a1000000-0000-4000-8000-0000000000c1";
const DELIVERY = "a1000000-0000-4000-8000-0000000000d7";

type Captured = { method: string; path: string; body: unknown };
const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
});

const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
const oauth: ApiIdentity = {
  ...fullAccessIdentity,
  auth_type: "oauth",
  client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac",
  user_id: "operator",
  grant_id: "grant",
  allowed_routes: routes,
};

async function connect(responder: () => Response, identity: ApiIdentity = fullAccessIdentity) {
  const captured: Captured[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    captured.push({ method: init?.method ?? "GET", path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return responder();
  });
  const server = await buildServer({ apiKey: "bz_live_meta_code_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "meta-code-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, captured };
}

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";

const metaRefusal = (status = 422) => () =>
  Response.json(
    { error: { code: "meta_error", message: "Meta recusou o envio.", outcome: "rejected", retry: "unknown", meta_code: 131026 } },
    { status },
  );

const SEND = { name: "send_message", arguments: { to: "5511999999999", type: "text", text: { body: "Oi" } } };
const errorProperties = (tool: { outputSchema?: { properties?: Record<string, any> } } | undefined) =>
  Object.keys(tool?.outputSchema?.properties?.error?.properties ?? {});
// get_profile é registrada direto no server, sem erro estruturado no schema.
const withError = (tools: Awaited<ReturnType<Client["listTools"]>>["tools"]) =>
  tools.filter((t) => t.outputSchema?.properties?.error);

describe("código da Meta no erro", () => {
  it("catálogo completo: texto e estruturado trazem o código em send_message", async () => {
    const { client } = await connect(metaRefusal());
    const result = await client.callTool(SEND);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Erro [meta_error]: Meta recusou o envio. Código da Meta: 131026. Resultado: rejected. Retentativa: unknown.",
    );
    expect(result.structuredContent).toEqual({
      error: { code: "meta_error", message: "Meta recusou o envio.", status: 422, outcome: "rejected", retry: "unknown", meta_code: 131026 },
    });
  });

  it("catálogo completo: request_consent também traz o código", async () => {
    const { client } = await connect(metaRefusal(502));
    const result = await client.callTool({ name: "request_consent", arguments: { conversation_id: CONV } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Código da Meta: 131026.");
    expect(result.structuredContent).toMatchObject({ error: { code: "meta_error", status: 502, meta_code: 131026 } });
  });

  it("catálogo completo anuncia meta_code no erro de todas as tools com saída", async () => {
    const { client } = await connect(metaRefusal());
    const tools = withError((await client.listTools()).tools);
    expect(tools.length).toBeGreaterThan(200);
    for (const tool of tools) expect(errorProperties(tool), tool.name).toContain("meta_code");
  });

  it("sem meta_code na resposta, texto e estruturado ficam como antes", async () => {
    const { client } = await connect(() => Response.json({ error: { code: "meta_error", message: "Meta indisponível." } }, { status: 502 }));
    const result = await client.callTool(SEND);
    expect(textOf(result)).toBe("Erro [meta_error]: Meta indisponível.");
    expect(result.structuredContent).toEqual({ error: { code: "meta_error", message: "Meta indisponível.", status: 502 } });
  });

  it("perfil assistant: código só no texto; erro anunciado e devolvido sem meta_code", async () => {
    const { client } = await connect(metaRefusal(), oauth);
    const tools = (await client.listTools()).tools;
    expect(tools.find((t) => t.name === "send_message")).toBeDefined();
    expect(withError(tools).length).toBeGreaterThan(30);
    for (const tool of withError(tools)) {
      expect(errorProperties(tool), tool.name).toEqual(["outcome", "retry", "code", "message", "status"]);
    }
    const result = await client.callTool(SEND);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Código da Meta: 131026.");
    expect(result.structuredContent).toEqual({
      error: { code: "meta_error", message: "Meta recusou o envio.", status: 422, outcome: "rejected", retry: "unknown" },
    });
  });

  it("identidade por requisição em perfil assistant também não devolve meta_code estruturado", async () => {
    const { client } = await connect(metaRefusal());
    const result = await requestAuthContext.run({ credential: "oauth-test", identity: oauth }, () => client.callTool(SEND));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Código da Meta: 131026.");
    expect(result.structuredContent).not.toHaveProperty("error.meta_code");
  });
});

describe("replay_webhook_delivery", () => {
  const replayed = { id: DELIVERY, status: "pending", replayed: true };

  it("anuncia anotações, scope, rota e fica fora do perfil assistant", async () => {
    const { client } = await connect(() => Response.json({ data: replayed }));
    const tool = (await client.listTools()).tools.find((t) => t.name === "replay_webhook_delivery");
    expect(tool?.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true });
    expect(tool?.inputSchema.required).toEqual(["id"]);
    expect(tool?.description).toContain("delivery_not_replayable");
    expect(tool?.description).toContain("forward_limit_reached");
    expect(tool?.description).toContain("replay_rate_limited");
    expect(Object.keys(tool?.outputSchema?.properties ?? {})).toEqual(["data", "error"]);
    const policy = MCP_TOOL_POLICIES.replay_webhook_delivery;
    expect(policy?.requiredScopes).toEqual(["webhooks:write"]);
    expect(policy?.requiredRoutes).toEqual(["POST /v1/webhook_deliveries/:id/replay"]);
    expect(TOOL_ROUTES.replay_webhook_delivery).toEqual(["POST /v1/webhook_deliveries/:id/replay"]);
    expect(policy?.sandbox).toBe(false);
    expect(ASSISTANT_TOOLS.has("replay_webhook_delivery")).toBe(false);

    const assistant = await connect(() => Response.json({ data: replayed }), oauth);
    expect((await assistant.client.listTools()).tools.map((t) => t.name)).not.toContain("replay_webhook_delivery");
  });

  it("faz POST sem corpo na rota de replay e devolve o item", async () => {
    const { client, captured } = await connect(() => Response.json({ data: replayed }));
    const result = await client.callTool({ name: "replay_webhook_delivery", arguments: { id: DELIVERY } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: replayed });
    expect(captured).toEqual([{ method: "POST", path: `/v1/webhook_deliveries/${DELIVERY}/replay`, body: undefined }]);
  });

  it("sem webhooks:write a tool some e não chama a API", async () => {
    const { client, captured } = await connect(() => Response.json({ data: replayed }), {
      ...fullAccessIdentity,
      scopes: fullAccessIdentity.scopes.filter((scope) => scope !== "webhooks:write"),
    });
    expect((await client.listTools()).tools.map((t) => t.name)).not.toContain("replay_webhook_delivery");
    const result = await client.callTool({ name: "replay_webhook_delivery", arguments: { id: DELIVERY } });
    expect(result.isError).toBe(true);
    expect(captured).toEqual([]);
  });

  it.each([
    [404, "not_found"],
    [409, "delivery_not_replayable"],
    [409, "forward_limit_reached"],
    [429, "replay_rate_limited"],
  ] as const)("recusa %i %s vira erro estruturado", async (status, code) => {
    const { client } = await connect(() => Response.json({ error: { code, message: "recusa" } }, { status }));
    const result = await client.callTool({ name: "replay_webhook_delivery", arguments: { id: DELIVERY } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(`Erro [${code}]: recusa`);
    expect(result.structuredContent).toEqual({ error: { code, message: "recusa", status } });
  });
});
