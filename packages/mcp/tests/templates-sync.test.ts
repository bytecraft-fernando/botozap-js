/**
 * sync_templates: o Sincronizar da tela de Templates pelo MCP (caso Savello,
 * 29/10/2026: avisos de status da Meta se perderam e os templates ficaram
 * PENDING aqui depois de aprovados).
 */
import { describe, expect, it } from "vitest";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { connectWithFakeApi } from "./helpers/fake-api.js";

const ROUTE = "POST /v1/templates/sync";
const RESULT = { connections: 1, synced: 6, removed: 0, skipped_without_token: 0, automations_outdated: false };
const CUSTOMER = "c1000000-0000-4000-8000-0000000000c1";

describe("sync_templates", () => {
  it("existe com anotações, scope e rota do contrato, fora do perfil assistant", async () => {
    const { client } = await connectWithFakeApi(() => Response.json({ data: RESULT }));
    const tool = (await client.listTools()).tools.find((t) => t.name === "sync_templates");
    expect(tool?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true });
    expect(tool?.description).toContain("reconnect_required");
    expect(MCP_TOOL_POLICIES.sync_templates?.requiredScopes).toEqual(["templates:write"]);
    expect(MCP_TOOL_POLICIES.sync_templates?.requiredRoutes).toEqual([ROUTE]);
    expect(TOOL_ROUTES.sync_templates).toEqual([ROUTE]);
    expect(ASSISTANT_TOOLS.has("sync_templates")).toBe(false);
  });

  it("sem argumento sincroniza a conta toda; com customer_id, só o Cliente", async () => {
    const { client, captured } = await connectWithFakeApi(() => Response.json({ data: RESULT }));
    const all = await client.callTool({ name: "sync_templates", arguments: {} });
    expect(all.structuredContent).toEqual({ data: RESULT });
    await client.callTool({ name: "sync_templates", arguments: { customer_id: CUSTOMER } });
    expect(captured).toEqual([
      { method: "POST", path: "/v1/templates/sync", body: {} },
      { method: "POST", path: "/v1/templates/sync", body: { customer_id: CUSTOMER } },
    ]);
  });

  it("customer_id que não é uuid é recusado sem chamar a API", async () => {
    const { client, captured } = await connectWithFakeApi(() => Response.json({ data: RESULT }));
    const result = await client.callTool({ name: "sync_templates", arguments: { customer_id: "x" } });
    expect(result.isError).toBe(true);
    expect(captured).toEqual([]);
  });
});
