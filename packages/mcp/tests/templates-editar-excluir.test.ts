/**
 * Editar e excluir template pelo MCP, como no painel (29/10/2026: "tudo que se
 * faz no painel se faz na API"): update_template com components e delete_template.
 */
import { describe, expect, it } from "vitest";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { connectWithFakeApi } from "./helpers/fake-api.js";

const ID = "d1000000-0000-4000-8000-0000000000d1";
const BODY = [{ type: "BODY", text: "Oi!" }];
const TEMPLATE = {
  id: ID,
  name: "regua_2h",
  language: "pt_BR",
  category: "MARKETING",
  status: "PENDING",
  components: BODY,
  waba_connection_id: "e1000000-0000-4000-8000-0000000000e1",
  meta_template_id: "1",
  rejection_reason: null,
  opt_out_buttons: [],
  last_synced_at: null,
  created_at: "2026-10-30T00:00:00Z",
  updated_at: "2026-10-30T00:00:00Z",
};

describe("templates: editar e excluir", () => {
  it("update_template com components faz PATCH com os componentes e a categoria", async () => {
    const { client, captured } = await connectWithFakeApi(() => Response.json({ data: TEMPLATE }));
    const result = await client.callTool({ name: "update_template", arguments: { id: ID, components: BODY, category: "UTILITY" } });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(captured).toEqual([{ method: "PATCH", path: `/v1/templates/${ID}`, body: { components: BODY, category: "UTILITY" } }]);
  });

  it("delete_template faz DELETE e devolve { id, deleted }", async () => {
    const { client, captured } = await connectWithFakeApi(() => Response.json({ data: { id: ID, deleted: true } }));
    const result = await client.callTool({ name: "delete_template", arguments: { id: ID } });
    expect(result.structuredContent).toEqual({ data: { id: ID, deleted: true } });
    expect(captured).toEqual([{ method: "DELETE", path: `/v1/templates/${ID}`, body: undefined }]);
    const tool = (await client.listTools()).tools.find((t) => t.name === "delete_template");
    expect(tool?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true });
    expect(MCP_TOOL_POLICIES.delete_template?.requiredScopes).toEqual(["templates:write"]);
    expect(TOOL_ROUTES.delete_template).toEqual(["DELETE /v1/templates/:id"]);
    expect(ASSISTANT_TOOLS.has("delete_template")).toBe(false);
  });
});
