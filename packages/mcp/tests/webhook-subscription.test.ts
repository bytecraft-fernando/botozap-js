/**
 * Mensagens que pararam de chegar com o token valendo (caso Savello,
 * 29/10/2026): phone_number_health mostra checks.webhook_subscription e
 * resubscribe_phone_number_webhooks inscreve o BotoZap de novo na Meta.
 */
import { describe, expect, it } from "vitest";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { connectWithFakeApi } from "./helpers/fake-api.js";

const PHONE = "a1000000-0000-4000-8000-0000000000f2";
const ROUTE = "POST /v1/phone_numbers/:id/webhook-subscription";

describe("resubscribe_phone_number_webhooks", () => {
  it("existe com anotações, scope e rota do contrato, fora do perfil assistant", async () => {
    const { client } = await connectWithFakeApi(() => Response.json({ data: { webhook_subscription: "subscribed" } }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    const tool = byName.get("resubscribe_phone_number_webhooks");
    expect(tool?.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true });
    expect(tool?.description).toContain("reconnect_required");
    expect(MCP_TOOL_POLICIES.resubscribe_phone_number_webhooks?.requiredScopes).toEqual(["numbers:write"]);
    expect(MCP_TOOL_POLICIES.resubscribe_phone_number_webhooks?.requiredRoutes).toEqual([ROUTE]);
    expect(TOOL_ROUTES.resubscribe_phone_number_webhooks).toEqual([ROUTE]);
    expect(ASSISTANT_TOOLS.has("resubscribe_phone_number_webhooks")).toBe(false);
    expect(byName.get("phone_number_health")?.description).toContain("webhook_subscription");
  });

  it("faz POST sem corpo e devolve a conferência", async () => {
    const { client, captured } = await connectWithFakeApi(() => Response.json({ data: { webhook_subscription: "subscribed" } }));
    const result = await client.callTool({ name: "resubscribe_phone_number_webhooks", arguments: { id: PHONE } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: { webhook_subscription: "subscribed" } });
    expect(captured).toEqual([{ method: "POST", path: `/v1/phone_numbers/${PHONE}/webhook-subscription`, body: undefined }]);
  });

  it("autorização recusada vira erro estruturado reconnect_required", async () => {
    const { client } = await connectWithFakeApi(() =>
      Response.json({ error: { code: "reconnect_required", message: "recusa" } }, { status: 409 }),
    );
    const result = await client.callTool({ name: "resubscribe_phone_number_webhooks", arguments: { id: PHONE } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: "reconnect_required", status: 409 } });
  });
});
