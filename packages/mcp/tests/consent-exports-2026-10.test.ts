/**
 * Paridade com a API de 16 a 20/10/2026 no MCP: pedido de consentimento, exclusão
 * de conversa, consentimentos do contato, botões de saída do template, regras de
 * recusa do Cliente, exportações, registro de atividades e garantia do plano.
 * Tudo só no catálogo completo (chave de API); o perfil assistant não muda.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { alertCopy } from "../src/agent-inbox.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const ID = "a1000000-0000-4000-8000-000000000001";
const CONV = "a1000000-0000-4000-8000-0000000000c1";
const CONTACT = "a1000000-0000-4000-8000-0000000000d1";
const NEW_TOOLS = [
  "request_consent",
  "delete_conversation",
  "list_contact_consents",
  "record_contact_consent",
  "update_template",
  "create_export",
  "list_exports",
  "get_export",
  "list_team_events",
];

const consent = {
  id: ID,
  channel: "whatsapp",
  purpose: "marketing",
  state: "revoked",
  origin: "template_button",
  recorded_by: null,
  evidence: "",
  created_at: "2026-10-20T12:00:00.000Z",
};
const exportRecord = {
  id: ID,
  status: "ready",
  format: "json",
  scope: { type: "account", customer_id: null, customer_name: null },
  requested_by: "API (chave x)",
  requested_via: "api",
  created_at: "2026-10-20T12:00:00.000Z",
  finished_at: "2026-10-20T12:05:00.000Z",
  expires_at: "2026-10-27T12:05:00.000Z",
  size_bytes: 1234,
  counts: { contacts: 10 },
  error: null,
  download: { url: "https://r2.example/e.zip?sig=1", expires_in: 300 },
};
const template = {
  id: ID,
  name: "promo",
  language: "pt_BR",
  category: "MARKETING",
  status: "APPROVED",
  meta_template_id: "m1",
  components: [],
  waba_connection_id: ID,
  created_at: "2026-10-20T12:00:00.000Z",
  last_synced_at: null,
  opt_out_buttons: ["Sair"],
};
const page = { cursors: { before: null, after: null }, next: null, previous: null };

type Captured = { method: string; path: string; query: Record<string, string>; body: unknown };
const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  vi.unstubAllEnvs();
});

async function connect(
  responder: (path: string, method: string) => Response,
  identity: ApiIdentity = fullAccessIdentity,
  captured: Captured[] = [],
) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    captured.push({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return responder(url.pathname, method);
  });
  const server = await buildServer({ apiKey: "bz_live_consent_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "consent-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, fetch, captured };
}

describe("catálogo", () => {
  it("as nove tools novas existem com as quatro anotações revisadas e rotas do contrato", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    const expected: Record<string, [boolean, boolean, boolean, boolean]> = {
      // [readOnly, destructive, idempotent, openWorld]
      request_consent: [false, true, false, true],
      delete_conversation: [false, true, true, false],
      list_contact_consents: [true, false, true, false],
      record_contact_consent: [false, true, false, false],
      update_template: [false, true, true, true],
      create_export: [false, false, false, false],
      list_exports: [true, false, true, false],
      get_export: [true, false, true, false],
      list_team_events: [true, false, true, false],
    };
    for (const name of NEW_TOOLS) {
      const [readOnlyHint, destructiveHint, idempotentHint, openWorldHint] = expected[name]!;
      expect(byName.get(name)?.annotations, name).toEqual({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint });
      expect(Object.keys(byName.get(name)?.outputSchema?.properties ?? {}), name).not.toHaveLength(0);
      expect(MCP_TOOL_POLICIES[name]?.requiredRoutes, name).toEqual(TOOL_ROUTES[name]);
      expect(ASSISTANT_TOOLS.has(name), name).toBe(false);
    }
    expect(MCP_TOOL_POLICIES.delete_conversation?.requiredScopes).toEqual(["conversations:write"]);
    expect(MCP_TOOL_POLICIES.request_consent?.requiredScopes).toEqual(["messages:send"]);
    expect(MCP_TOOL_POLICIES.create_export?.requiredScopes).toEqual(["exports:write"]);
    expect(MCP_TOOL_POLICIES.list_exports?.requiredScopes).toEqual(["exports:read"]);
    expect(MCP_TOOL_POLICIES.list_team_events?.requiredScopes).toEqual(["team:read"]);
  });

  it("delete_conversation avisa que é destrutiva; request_consent, que vale para os dois canais", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    expect(byName.get("delete_conversation")?.description).toMatch(/SEM VOLTA/);
    expect(byName.get("request_consent")?.description).toMatch(/WhatsApp e Instagram|os dois canais/);
    expect(byName.get("request_consent")?.description).not.toMatch(/só (no )?WhatsApp/i);
    expect(byName.get("request_consent")?.description).toContain("outside_window");
    expect(byName.get("request_consent")?.description).toContain("window_closed");
  });

  it("delete_contact descreve a recusa guardada como código cifrado e a mídia apagada", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const tool = (await client.listTools()).tools.find((t) => t.name === "delete_contact");
    expect(tool?.description).toMatch(/código cifrado \(hash\)/);
    expect(tool?.description).toMatch(/apaga a mídia/);
  });

  it("perfil assistant (OAuth) não ganha nenhuma delas nem os campos novos", async () => {
    const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
    const oauth: ApiIdentity = {
      ...fullAccessIdentity,
      auth_type: "oauth",
      client_id: "e948ea06-d925-41b6-980c-d7ea3538a4ac",
      user_id: "operator",
      grant_id: "grant",
      allowed_routes: routes,
    };
    const { client, fetch } = await connect(() => Response.json({ data: {} }), oauth);
    const tools = (await client.listTools()).tools;
    const names = tools.map((t) => t.name);
    for (const name of NEW_TOOLS) expect(names, name).not.toContain(name);
    for (const name of ["list_templates", "get_template", "create_template"]) {
      const output = tools.find((t) => t.name === name)?.outputSchema;
      expect(JSON.stringify(output), name).not.toContain("opt_out_buttons");
    }
    expect(JSON.stringify(tools.find((t) => t.name === "send_message")?.description)).not.toContain("consent_revoked");
    const denied = await client.callTool({ name: "delete_conversation", arguments: { id: CONV } });
    expect(denied.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("catálogo completo: send_message explica consent_revoked e templates trazem opt_out_buttons", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const tools = (await client.listTools()).tools;
    expect(tools.find((t) => t.name === "send_message")?.description).toContain("consent_revoked");
    expect(JSON.stringify(tools.find((t) => t.name === "get_template")?.outputSchema)).toContain("opt_out_buttons");
  });

  it("o enum de provedor de IA tem só openai e anthropic", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const tool = (await client.listTools()).tools.find((t) => t.name === "ai_credentials_create");
    const provider = (tool?.inputSchema.properties as Record<string, { enum?: string[] }>).provider;
    expect(provider?.enum).toEqual(["openai", "anthropic"]);
  });
});

describe("chamadas", () => {
  it("request_consent faz POST e devolve o canal", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(
      () => Response.json({ data: { id: ID, wamid: null, conversation_id: CONV, contact_id: CONTACT, channel: "instagram", type: "interactive", status: "sent", sent_to: "1784", purposes: ["marketing"], body: "Oi" } }, { status: 201 }),
      fullAccessIdentity,
      captured,
    );
    const result = await client.callTool({ name: "request_consent", arguments: { conversation_id: CONV, purposes: ["marketing"], body: "Oi" } });
    expect(result.isError).toBeFalsy();
    expect(captured).toEqual([{ method: "POST", path: `/v1/conversations/${CONV}/consent-request`, query: {}, body: { purposes: ["marketing"], body: "Oi" } }]);
    expect(result.structuredContent).toMatchObject({ data: { channel: "instagram" } });
  });

  it("request_consent com janela fechada vira erro estruturado outside_window", async () => {
    const { client } = await connect(() => Response.json({ error: { code: "outside_window", message: "fora da janela" } }, { status: 422 }));
    const result = await client.callTool({ name: "request_consent", arguments: { conversation_id: CONV } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: "outside_window", status: 422 } });
  });

  it("delete_conversation faz DELETE e devolve success no 204", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(() => new Response(null, { status: 204 }), fullAccessIdentity, captured);
    const result = await client.callTool({ name: "delete_conversation", arguments: { id: CONV } });
    expect(captured).toEqual([{ method: "DELETE", path: `/v1/conversations/${CONV}`, query: {}, body: undefined }]);
    expect(result.structuredContent).toEqual({ success: true });
  });

  it("list_contact_consents e record_contact_consent", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(
      (_p, method) => method === "GET" ? Response.json({ data: { current: [consent], history: [consent] } }) : Response.json({ data: { ...consent, origin: "api", state: "granted" } }, { status: 201 }),
      fullAccessIdentity,
      captured,
    );
    const listed = await client.callTool({ name: "list_contact_consents", arguments: { id: CONTACT } });
    expect(listed.structuredContent).toMatchObject({ data: { current: [{ origin: "template_button" }] } });
    const recorded = await client.callTool({ name: "record_contact_consent", arguments: { id: CONTACT, channel: "whatsapp", purpose: "marketing", state: "granted", evidence: "site" } });
    expect(recorded.isError).toBeFalsy();
    expect(captured[1]).toEqual({ method: "POST", path: `/v1/contacts/${CONTACT}/consents`, query: {}, body: { channel: "whatsapp", purpose: "marketing", state: "granted", evidence: "site" } });
  });

  it("aceite sobre recusa: consent_opted_out chega estruturado", async () => {
    const { client } = await connect(() => Response.json({ error: { code: "consent_opted_out", message: "recusou" } }, { status: 409 }));
    const result = await client.callTool({ name: "record_contact_consent", arguments: { id: CONTACT, channel: "whatsapp", purpose: "marketing", state: "granted" } });
    expect(result.structuredContent).toMatchObject({ error: { code: "consent_opted_out", status: 409 } });
  });

  it("create_contact devolve warnings do 201", async () => {
    const warning = { code: "consent_opted_out", message: "recusou", channel: "whatsapp", purpose: "marketing" };
    const contact = { id: CONTACT, wa_id: "5531988887777", profile_name: null, phone: null, user_id: null, username: null, parent_user_id: null, phone_number_id: null, last_seen_at: null, created_at: "2026-10-20T12:00:00.000Z", notes: null, metadata: null, stage: null, warnings: [warning] };
    const { client } = await connect(() => Response.json({ data: contact }, { status: 201 }));
    const result = await client.callTool({ name: "create_contact", arguments: { wa_id: "5531988887777" } });
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { data: { warnings: unknown[] } }).data.warnings).toEqual([warning]);
  });

  it("update_template manda opt_out_buttons e devolve o objeto completo", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(() => Response.json({ data: template }), fullAccessIdentity, captured);
    const result = await client.callTool({ name: "update_template", arguments: { id: ID, opt_out_buttons: ["Sair"] } });
    expect(captured).toEqual([{ method: "PATCH", path: `/v1/templates/${ID}`, query: {}, body: { opt_out_buttons: ["Sair"] } }]);
    expect(result.structuredContent).toMatchObject({ data: { opt_out_buttons: ["Sair"] } });
  });

  it("update_customer manda as palavras e os textos; get_customer devolve os campos", async () => {
    const customer = { id: ID, name: "A", external_customer_id: null, is_self: false, created_at: "x", updated_at: "x", opt_out_keywords: ["sair"], opt_in_keywords: ["voltar"], opt_out_confirmation: "ok", opt_in_confirmation: "oi" };
    const captured: Captured[] = [];
    const { client } = await connect(() => Response.json({ data: customer }), fullAccessIdentity, captured);
    const result = await client.callTool({ name: "update_customer", arguments: { id: ID, opt_out_keywords: ["sair"], opt_in_keywords: [], opt_out_confirmation: "ok" } });
    expect(captured[0]).toMatchObject({ method: "PATCH", body: { opt_out_keywords: ["sair"], opt_in_keywords: [], opt_out_confirmation: "ok" } });
    expect(result.structuredContent).toMatchObject({ data: { opt_out_keywords: ["sair"], opt_in_confirmation: "oi" } });
  });

  it("create_export, list_exports e get_export", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(
      (path, method) =>
        method === "POST" ? Response.json({ data: { ...exportRecord, status: "pending", download: null } }, { status: 202 })
        : path.endsWith("/exports") ? Response.json({ data: [{ ...exportRecord, download: null }] })
        : Response.json({ data: exportRecord }),
      fullAccessIdentity,
      captured,
    );
    const created = await client.callTool({ name: "create_export", arguments: { format: "csv" } });
    expect(created.isError).toBeFalsy();
    const listed = await client.callTool({ name: "list_exports", arguments: {} });
    expect((listed.structuredContent as { data: unknown[] }).data).toHaveLength(1);
    const got = await client.callTool({ name: "get_export", arguments: { id: ID } });
    expect(got.structuredContent).toMatchObject({ data: { download: { expires_in: 300 } } });
    expect(captured.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /v1/exports", "GET /v1/exports", `GET /v1/exports/${ID}`]);
    expect(captured[0]!.body).toEqual({ format: "csv" });
  });

  it("list_team_events manda os filtros", async () => {
    const captured: Captured[] = [];
    const event = { id: ID, created_at: "2026-10-20T12:00:00.000Z", actor: { type: "api_key", user_id: null, api_key_id: ID, label: "chave" }, action: "export.requested", action_label: "Pediu a exportação", target: { type: "export", type_label: "Exportação", id: ID, label: "Conta inteira" }, before: null, after: { via: "api" }, ip_address: "203.0.113.9" };
    const { client } = await connect(() => Response.json({ data: [event], paging: page }), fullAccessIdentity, captured);
    const result = await client.callTool({ name: "list_team_events", arguments: { action: "export.requested", target_type: "export", target_id: ID, since: "2026-10-01T00:00:00Z", limit: 5 } });
    expect(result.isError).toBeFalsy();
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/team_events", query: { action: "export.requested", target_type: "export", target_id: ID, since: "2026-10-01T00:00:00Z", limit: "5" } });
  });

  it("get_billing devolve a garantia de 7 dias", async () => {
    const billing = { plan: "paid", included_businesses: 1, legacy_extra_businesses: 0, slot_amount_cents: 4700, can_add_slot: true, slots: [], guarantee: { term: "monthly", amount_cents: 9700, deadline: "2026-10-27T12:00:00.000Z" } };
    const { client } = await connect(() => Response.json({ data: billing }));
    const result = await client.callTool({ name: "get_billing", arguments: {} });
    expect(result.structuredContent).toEqual({ data: billing });
  });
});

describe("agent-inbox", () => {
  it("o alerta data_use_ack_required não tem mais rótulo próprio (a confirmação foi removida)", () => {
    expect(alertCopy({ kind: "data_use_ack_required" }).title).toBe("Alerta aguardando revisão");
    expect(alertCopy({ kind: "plan_past_due" }).title).toBe("Atendimento bloqueado por pagamento pendente");
  });
});
