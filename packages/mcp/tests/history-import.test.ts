/**
 * Conversas antigas do app WhatsApp Business (coexistência) no MCP:
 * get_phone_number_history_import e set_phone_number_history_import. Só no
 * catálogo completo; o perfil assistant (app revisado do ChatGPT) não ganha.
 */
import { describe, expect, it } from "vitest";
import type { ApiIdentity } from "../src/server.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { fullAccessIdentity } from "./helpers/identity.js";
import { connectWithFakeApi } from "./helpers/fake-api.js";

const PHONE = "a1000000-0000-4000-8000-0000000000f1";
const item = {
  phone_id: PHONE,
  status: "awaiting_choice",
  window_days: null,
  window_source: null,
  window_set_at: null,
  can_choose: true,
  default_window_days: 30,
  default_at: "2026-10-25T08:00:00.000Z",
  deadline_at: "2026-10-25T12:00:00.000Z",
  onboarded_at: "2026-10-24T12:00:00.000Z",
};


const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
const oauth: ApiIdentity = {
  ...fullAccessIdentity,
  auth_type: "oauth",
  client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac",
  user_id: "operator",
  grant_id: "grant",
  allowed_routes: routes,
};

const connect = (responder: (method: string) => Response, identity: ApiIdentity = fullAccessIdentity) =>
  connectWithFakeApi(responder, identity);

const TOOLS: Record<string, [boolean, boolean, boolean, boolean, string, string]> = {
  // [readOnly, destructive, idempotent, openWorld, scope, rota]
  get_phone_number_history_import: [true, false, true, false, "numbers:read", "GET /v1/phone_numbers/:id/history-import"],
  set_phone_number_history_import: [false, true, true, true, "numbers:write", "PUT /v1/phone_numbers/:id/history-import"],
};

describe("catálogo", () => {
  it("as duas tools existem com anotações, scope e rota do contrato", async () => {
    const { client } = await connect(() => Response.json({ data: item }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    for (const [name, [readOnlyHint, destructiveHint, idempotentHint, openWorldHint, scope, route]] of Object.entries(TOOLS)) {
      const tool = byName.get(name);
      expect(tool?.annotations, name).toEqual({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint });
      expect(Object.keys(tool?.outputSchema?.properties ?? {}), name).not.toHaveLength(0);
      expect(MCP_TOOL_POLICIES[name]?.requiredScopes, name).toEqual([scope]);
      expect(MCP_TOOL_POLICIES[name]?.requiredRoutes, name).toEqual([route]);
      expect(TOOL_ROUTES[name], name).toEqual([route]);
      expect(MCP_TOOL_POLICIES[name]?.sandbox, name).toBe(false);
      expect(ASSISTANT_TOOLS.has(name), name).toBe(false);
    }
  });

  it("descrições falam com quem opera: escolha única, recusas e pedir antes de escolher", async () => {
    const { client } = await connect(() => Response.json({ data: item }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    const set = byName.get("set_phone_number_history_import")!;
    expect(set.description).toContain("uma vez por conexão");
    expect(set.description).toContain("history_import_locked");
    expect(set.description).toContain("history_import_not_available");
    expect(set.description).toMatch(/Pergunte a quem opera/);
    expect(set.inputSchema.required).toEqual(["id", "window_days"]);
    expect(JSON.stringify(set.inputSchema.properties?.window_days)).toMatch(/180/);
    expect(byName.get("get_phone_number_history_import")?.description).toContain("can_choose");
  });

  it("perfil assistant (OAuth) não ganha as tools", async () => {
    const { client } = await connect(() => Response.json({ data: item }), oauth);
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const name of Object.keys(TOOLS)) expect(names, name).not.toContain(name);
  });
});

describe("chamadas", () => {
  it("get faz GET e devolve o estado", async () => {
    const { client, captured } = await connect(() => Response.json({ data: item }));
    const result = await client.callTool({ name: "get_phone_number_history_import", arguments: { id: PHONE } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: item });
    expect(captured).toEqual([{ method: "GET", path: `/v1/phone_numbers/${PHONE}/history-import`, body: undefined }]);
  });

  it.each([0, 30, 180])("set window_days %i faz PUT com o número", async (days) => {
    const chosen = { ...item, status: days === 0 ? "skipped" : "queued", window_days: days, window_source: "customer", can_choose: false };
    const { client, captured } = await connect(() => Response.json({ data: chosen }));
    const result = await client.callTool({ name: "set_phone_number_history_import", arguments: { id: PHONE, window_days: days } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ data: { window_days: days, can_choose: false } });
    expect(captured).toEqual([{ method: "PUT", path: `/v1/phone_numbers/${PHONE}/history-import`, body: { window_days: days } }]);
  });

  it.each([7, "30", null])("set recusa window_days %j sem chamar a API", async (days) => {
    const { client, captured } = await connect(() => Response.json({ data: item }));
    const result = await client.callTool({ name: "set_phone_number_history_import", arguments: { id: PHONE, window_days: days } });
    expect(result.isError).toBe(true);
    expect(captured).toEqual([]);
  });

  it.each([
    [409, "history_import_locked"],
    [404, "history_import_not_available"],
  ] as const)("recusa %i %s vira erro estruturado", async (status, code) => {
    const { client } = await connect(() => Response.json({ error: { code, message: "recusa" } }, { status }));
    const result = await client.callTool({ name: "set_phone_number_history_import", arguments: { id: PHONE, window_days: 30 } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code, status } });
  });
});
