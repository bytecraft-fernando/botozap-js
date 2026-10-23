/**
 * Paridade com a API de 23/10/2026 no MCP: "digitando…" e marcar como lida,
 * modelos prontos de Régua, diagnóstico do agente, pedido de localização,
 * responder citando, mensagem de voz e configurações do número do WhatsApp.
 * Tudo novo fica só no catálogo completo; o perfil assistant (app revisado do
 * ChatGPT) não ganha tools, campos de entrada nem campos de saída.
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
const CUSTOMER = "a1000000-0000-4000-8000-0000000000b1";
const AGENT = "a1000000-0000-4000-8000-0000000000a1";
const CONTACT = "a1000000-0000-4000-8000-0000000000d1";
const MSG = "a1000000-0000-4000-8000-0000000000e1";

const NEW_TOOLS: Record<string, [boolean, boolean, boolean, boolean, string]> = {
  // [readOnly, destructive, idempotent, openWorld, scope]
  conversation_typing: [false, false, true, true, "messages:send"],
  mark_conversation_read: [false, false, true, true, "conversations:write"],
  list_journey_models: [true, false, true, false, "journeys:read"],
  enable_journey_model: [false, true, true, true, "journeys:write"],
  ai_agents_diagnostic: [true, false, true, false, "agents:read"],
  get_phone_number_profile: [true, false, true, false, "numbers:read"],
  update_phone_number_profile: [false, true, true, true, "numbers:write"],
  get_conversational_automation: [true, false, true, false, "numbers:read"],
  update_conversational_automation: [false, true, true, true, "numbers:write"],
  clear_conversational_automation: [false, true, true, true, "numbers:write"],
  list_qr_codes: [true, false, true, false, "numbers:read"],
  create_qr_code: [false, false, false, true, "numbers:write"],
  get_qr_code: [true, false, true, false, "numbers:read"],
  update_qr_code: [false, true, true, true, "numbers:write"],
  delete_qr_code: [false, true, true, true, "numbers:write"],
  list_blocked_users: [true, false, true, false, "numbers:read"],
  block_contact: [false, true, true, true, "numbers:write"],
  unblock_contact: [false, true, true, true, "numbers:write"],
};

type Captured = { method: string; path: string; query: Record<string, string>; body: unknown };
const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  vi.unstubAllEnvs();
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

async function connect(
  responder: (path: string, method: string) => Response,
  identity: ApiIdentity = fullAccessIdentity,
  captured: Captured[] = [],
) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const raw = init?.body;
    captured.push({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: raw ? JSON.parse(String(raw)) : undefined,
    });
    return responder(url.pathname, method);
  });
  const server = await buildServer({ apiKey: "bz_live_paridade_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "paridade-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, fetch, captured };
}

const sent = { id: MSG, wamid: "wamid.2", to: "5511999999999", status: "sent", reply_to: { message_id: MSG, external_id: "wamid.1" } };

describe("catálogo", () => {
  it("as tools novas existem com as anotações revisadas, o scope e a rota do contrato", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    for (const [name, [readOnlyHint, destructiveHint, idempotentHint, openWorldHint, scope]] of Object.entries(NEW_TOOLS)) {
      expect(byName.get(name)?.annotations, name).toEqual({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint });
      expect(Object.keys(byName.get(name)?.outputSchema?.properties ?? {}), name).not.toHaveLength(0);
      expect(MCP_TOOL_POLICIES[name]?.requiredScopes, name).toEqual([scope]);
      expect(MCP_TOOL_POLICIES[name]?.requiredRoutes?.length, name).toBe(1);
      if (!name.startsWith("ai_")) expect(MCP_TOOL_POLICIES[name]?.requiredRoutes, name).toEqual(TOOL_ROUTES[name]);
      expect(ASSISTANT_TOOLS.has(name), name).toBe(false);
    }
    expect(MCP_TOOL_POLICIES.ai_agents_diagnostic?.requiredRoutes).toEqual(["GET /v1/ai/agents/:id/diagnostic"]);
    expect(MCP_TOOL_POLICIES.mark_conversation_read?.sandbox).toBe(true);
    expect(MCP_TOOL_POLICIES.conversation_typing?.sandbox).toBe(false);
  });

  it("descrições: perfil por OAuth recebe 403, QR apagado é sem volta, bloqueio só em 24 h", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t.description ?? ""]));
    expect(byName.get("update_phone_number_profile")).toMatch(/OAuth.*403/);
    expect(byName.get("update_phone_number_profile")).toContain("coexistence_not_supported");
    expect(byName.get("delete_qr_code")).toMatch(/SEM VOLTA/);
    expect(byName.get("create_qr_code")).toContain("meta_unconfirmed");
    expect(byName.get("block_contact")).toContain("block_window_closed");
    expect(byName.get("conversation_typing")).toContain("no_inbound_message");
    expect(byName.get("enable_journey_model")).toMatch(/mensagens automáticas/);
  });

  it("catálogo completo: send_message explica reply_to e location_request_message; envio e leitura anunciam os campos novos", async () => {
    const { client } = await connect(() => Response.json({ data: {} }));
    const tools = (await client.listTools()).tools;
    const send = tools.find((t) => t.name === "send_message")!;
    expect(send.description).toContain("reply_target_not_found");
    expect(send.description).toContain("location_request_message");
    expect(Object.keys(send.inputSchema.properties ?? {})).toContain("reply_to");
    expect(JSON.stringify(send.outputSchema)).toContain("reply_to");
    const media = tools.find((t) => t.name === "send_media_message")!;
    expect(Object.keys(media.inputSchema.properties ?? {})).toEqual(expect.arrayContaining(["voice", "reply_to"]));
    const get = JSON.stringify(tools.find((t) => t.name === "get_message")?.outputSchema);
    for (const field of ["reply_to", "played_at", "transcription"]) expect(get).toContain(field);
    const agent = tools.find((t) => t.name === "ai_agents_create");
    expect(JSON.stringify(agent?.inputSchema)).toContain("conversations.reply_options");
  });

  it("perfil assistant (OAuth) fica idêntico: sem tools novas, sem reply_to na entrada nem na saída", async () => {
    const { client } = await connect(() => Response.json({ data: {} }), oauth);
    const tools = (await client.listTools()).tools;
    const names = tools.map((t) => t.name);
    for (const name of Object.keys(NEW_TOOLS)) expect(names, name).not.toContain(name);
    const send = tools.find((t) => t.name === "send_message")!;
    expect(Object.keys(send.inputSchema.properties ?? {})).not.toContain("reply_to");
    expect(JSON.stringify(send.outputSchema)).not.toContain("reply_to");
    expect(send.description).not.toContain("reply_target_not_found");
    expect(send.description).not.toContain("location_request_message");
    const reply = tools.find((t) => t.name === "reply_to_conversation")!;
    expect(Object.keys(reply.inputSchema.properties ?? {})).toEqual(["idempotency_key", "conversation_id", "text"]);
    for (const name of ["list_messages", "get_message"]) {
      const output = JSON.stringify(tools.find((t) => t.name === name)?.outputSchema);
      for (const field of ["reply_to", "played_at", "transcription"]) expect(output, `${name}.${field}`).not.toContain(field);
    }
  });

  it("perfil assistant não repassa reply_to mesmo se o cliente mandar", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(() => Response.json(sent, { status: 201 }), oauth, captured);
    const result = await client.callTool({
      name: "send_message",
      arguments: { to: "5511999999999", type: "text", text: { body: "Oi" }, reply_to: { message_id: "wamid.1" } },
    });
    expect(result.isError).toBeFalsy();
    expect(captured[0]?.body).not.toHaveProperty("reply_to");
    expect(result.structuredContent).not.toHaveProperty("reply_to");
  });

  it("identidade por requisição em perfil assistant também não repassa reply_to", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(() => Response.json(sent, { status: 201 }), fullAccessIdentity, captured);
    await requestAuthContext.run({ credential: "oauth-test", identity: oauth }, () =>
      client.callTool({
        name: "send_message",
        arguments: { to: "5511999999999", type: "text", text: { body: "Oi" }, reply_to: { message_id: "wamid.1" } },
      }),
    );
    expect(captured[0]?.body).not.toHaveProperty("reply_to");
  });
});

describe("chamadas", () => {
  it("conversation_typing e mark_conversation_read", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(
      (path) =>
        path.endsWith("/typing")
          ? Response.json({ data: { conversation_id: CONV, channel: "whatsapp", typing: true, repeated: false } })
          : Response.json({ data: { conversation_id: CONV, last_read_at: "2026-10-23T12:00:00.000Z" } }),
      fullAccessIdentity,
      captured,
    );
    const typing = await client.callTool({ name: "conversation_typing", arguments: { conversation_id: CONV } });
    const read = await client.callTool({ name: "mark_conversation_read", arguments: { conversation_id: CONV } });
    expect(typing.structuredContent).toMatchObject({ data: { typing: true, repeated: false } });
    expect(read.structuredContent).toMatchObject({ data: { last_read_at: "2026-10-23T12:00:00.000Z" } });
    expect(captured.map((c) => `${c.method} ${c.path}`)).toEqual([
      `POST /v1/conversations/${CONV}/typing`,
      `POST /v1/conversations/${CONV}/read`,
    ]);
  });

  it("conversation_typing sem mensagem recebida vira erro estruturado", async () => {
    const { client } = await connect(() => Response.json({ error: { code: "no_inbound_message", message: "sem mensagem" } }, { status: 409 }));
    const result = await client.callTool({ name: "conversation_typing", arguments: { conversation_id: CONV } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: "no_inbound_message", status: 409 } });
  });

  it("list_journey_models e enable_journey_model", async () => {
    const captured: Captured[] = [];
    const model = {
      key: "boas_vindas", name: "Boas-vindas", description: "d", segments: ["geral"],
      trigger: { kind: "stage_entered", stageKey: "novo", waitDays: 0 }, category: "UTILITY",
      template_name: "bz_boas_vindas", template_language: "pt_BR", body: "Oi {{1}}",
      variable_map: { "1": "contact.name" }, examples: { "1": "Maria" },
    };
    const { client } = await connect(
      (_path, method) =>
        method === "GET"
          ? Response.json({ data: [model] })
          : Response.json({ data: { journey_id: "j1", created: true, template_submitted: true, resubmitted: false, active: false } }, { status: 201 }),
      fullAccessIdentity,
      captured,
    );
    const list = await client.callTool({ name: "list_journey_models", arguments: {} });
    expect(list.structuredContent).toMatchObject({ data: [{ key: "boas_vindas", trigger: { kind: "stage_entered", stageKey: "novo" } }] });
    const enabled = await client.callTool({ name: "enable_journey_model", arguments: { key: "boas_vindas", customer_id: CUSTOMER, phone_number_id: "123456" } });
    expect(enabled.structuredContent).toMatchObject({ data: { journey_id: "j1", created: true } });
    expect(captured[1]).toEqual({
      method: "POST",
      path: "/v1/journeys/catalog/boas_vindas/enable",
      query: {},
      body: { customer_id: CUSTOMER, phone_number_id: "123456" },
    });
  });

  it("ai_agents_diagnostic lê o diagnóstico com customer_id", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(() => Response.json({ data: { agent_id: AGENT, ready: true, checks: [] } }), fullAccessIdentity, captured);
    const result = await client.callTool({ name: "ai_agents_diagnostic", arguments: { customer_id: CUSTOMER, id: AGENT } });
    expect(result.isError).toBeFalsy();
    expect(captured[0]).toMatchObject({ method: "GET", path: `/v1/ai/agents/${AGENT}/diagnostic`, query: { customer_id: CUSTOMER } });
  });

  it("send_message com reply_to e location_request_message", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(() => Response.json(sent, { status: 201 }), fullAccessIdentity, captured);
    const interactive = { type: "location_request_message", body: { text: "Onde?" }, action: { name: "send_location" } };
    const result = await client.callTool({
      name: "send_message",
      arguments: { to: "5511999999999", type: "interactive", interactive, reply_to: { message_id: "wamid.1" } },
    });
    expect(result.isError).toBeFalsy();
    expect(captured[0]?.body).toMatchObject({ type: "interactive", interactive, reply_to: { message_id: "wamid.1" } });
    expect(result.structuredContent).toMatchObject({ reply_to: { message_id: MSG, external_id: "wamid.1" } });
  });

  it("send_message recusa reply_to em reaction antes da API", async () => {
    const { client, fetch } = await connect(() => Response.json(sent, { status: 201 }));
    const result = await client.callTool({
      name: "send_message",
      arguments: { to: "5511999999999", type: "reaction", reaction: { message_id: "wamid.1", emoji: "👍" }, reply_to: { message_id: "wamid.1" } },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("reply_to não vale para reaction");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("send_media_message: voice só em audio e reply_to repassado", async () => {
    const captured: Captured[] = [];
    const { client, fetch } = await connect(() => Response.json(sent, { status: 201 }), fullAccessIdentity, captured);
    const refused = await client.callTool({
      name: "send_media_message",
      arguments: { to: "5511999999999", type: "image", link: "https://x.test/a.png", voice: true },
    });
    expect(refused.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    const ok = await client.callTool({
      name: "send_media_message",
      arguments: { to: "5511999999999", type: "audio", link: "https://x.test/v.ogg", voice: true, reply_to: { message_id: MSG } },
    });
    expect(ok.isError).toBeFalsy();
    expect(captured[0]?.body).toEqual({ to: "5511999999999", type: "audio", audio: { link: "https://x.test/v.ogg", voice: true }, reply_to: { message_id: MSG } });
  });

  it("reply_to_conversation cita a mensagem pedida", async () => {
    const captured: Captured[] = [];
    const { client } = await connect(
      (path) =>
        path.includes("/conversations/")
          ? Response.json({ data: { id: CONV, channel: "whatsapp", phone_number_id: "p1", contact: { wa_id: "5511999999999" } } })
          : Response.json(sent, { status: 201 }),
      fullAccessIdentity,
      captured,
    );
    const result = await client.callTool({
      name: "reply_to_conversation",
      arguments: { conversation_id: CONV, text: { body: "Sim" }, reply_to_message_id: "wamid.1" },
    });
    expect(result.isError).toBeFalsy();
    expect(captured[1]?.body).toMatchObject({ text: { body: "Sim" }, reply_to: { message_id: "wamid.1" } });
  });

  it("get_message devolve reply_to, played_at e transcription no catálogo completo", async () => {
    const message = {
      id: MSG, wamid: "wamid.2", conversation_id: CONV, phone_number_id: null, contact_id: CONTACT,
      direction: "inbound", type: "audio", status: "received", source: "app", content: {}, context: null, error: null,
      has_media: true, revoked_at: null, event_at: null, wa_timestamp: null, created_at: "2026-10-23T12:00:00.000Z",
      reply_to: { message_id: null, external_id: "wamid.0" }, played_at: null, transcription: "quero agendar",
    };
    const { client } = await connect(() => Response.json({ data: message }));
    const result = await client.callTool({ name: "get_message", arguments: { id: MSG } });
    expect(result.structuredContent).toMatchObject({ data: { reply_to: { message_id: null }, transcription: "quero agendar" } });
  });

  it("configurações do número: perfil, perguntas, QR e bloqueio", async () => {
    const captured: Captured[] = [];
    const profile = { about: "Oi", address: null, description: null, email: null, websites: [], vertical: "RETAIL", profile_picture_url: null, editable: true };
    const qr = { code: "4O4YGZEG3RIVE1", prefilled_message: "Oi", deep_link_url: "https://wa.me/message/4O4YGZEG3RIVE1" };
    const { client } = await connect(
      (path, method) => {
        if (path.endsWith("/profile")) return Response.json({ data: profile });
        if (path.endsWith("/conversational-automation")) return Response.json({ data: { prompts: [], commands: [] } });
        if (path.endsWith("/qr-codes")) return Response.json({ data: method === "GET" ? [qr] : qr }, { status: method === "POST" ? 201 : 200 });
        if (path.includes("/qr-codes/")) return method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ data: qr });
        if (path.endsWith("/blocked-users") && method === "GET") {
          return Response.json({ data: [{ wa_id: "5511999999999", contact_id: null, name: null }], paging: { cursors: { before: null, after: "QVFI" }, next: null, previous: null } });
        }
        return Response.json({ data: { blocked: method === "POST", wa_id: "5511999999999", contact_id: CONTACT } });
      },
      fullAccessIdentity,
      captured,
    );
    const calls: [string, Record<string, unknown>][] = [
      ["get_phone_number_profile", { id: "p1" }],
      ["update_phone_number_profile", { id: "p1", about: "Novo", websites: [] }],
      ["get_conversational_automation", { id: "p1" }],
      ["update_conversational_automation", { id: "p1", prompts: ["Ver horários"] }],
      ["clear_conversational_automation", { id: "p1" }],
      ["list_qr_codes", { id: "p1" }],
      ["create_qr_code", { id: "p1", prefilled_message: "Oi", image_format: "SVG" }],
      ["get_qr_code", { id: "p1", code: qr.code, image_format: "PNG" }],
      ["update_qr_code", { id: "p1", code: qr.code, prefilled_message: "Olá" }],
      ["delete_qr_code", { id: "p1", code: qr.code }],
      ["list_blocked_users", { id: "p1", after: "QVFH" }],
      ["block_contact", { id: "p1", contact_id: CONTACT }],
      ["unblock_contact", { id: "p1", user: "5511999999999" }],
    ];
    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, `${name}: ${JSON.stringify(result.content)}`).toBeFalsy();
    }
    const base = "/v1/phone_numbers/p1";
    expect(captured.map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET ${base}/profile`,
      `PATCH ${base}/profile`,
      `GET ${base}/conversational-automation`,
      `PATCH ${base}/conversational-automation`,
      `DELETE ${base}/conversational-automation`,
      `GET ${base}/qr-codes`,
      `POST ${base}/qr-codes`,
      `GET ${base}/qr-codes/${qr.code}`,
      `PATCH ${base}/qr-codes/${qr.code}`,
      `DELETE ${base}/qr-codes/${qr.code}`,
      `GET ${base}/blocked-users`,
      `POST ${base}/blocked-users`,
      `DELETE ${base}/blocked-users/5511999999999`,
    ]);
    expect(captured[1]?.body).toEqual({ about: "Novo", websites: [] });
    expect(captured[3]?.body).toEqual({ prompts: ["Ver horários"] });
    expect(captured[6]?.body).toEqual({ prefilled_message: "Oi", image_format: "SVG" });
    expect(captured[7]?.query).toEqual({ image_format: "PNG" });
    expect(captured[10]?.query).toEqual({ after: "QVFH" });
    expect(captured[11]?.body).toEqual({ contact_id: CONTACT });
  });

  it("block_contact exige um só alvo e update_conversational_automation exige um campo, antes da API", async () => {
    const { client, fetch } = await connect(() => Response.json({ data: {} }));
    const both = await client.callTool({ name: "block_contact", arguments: { id: "p1", contact_id: CONTACT, user: "+5511999999999" } });
    const none = await client.callTool({ name: "update_conversational_automation", arguments: { id: "p1" } });
    expect(both.isError).toBe(true);
    expect(none.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("perfil em coexistência e plano sem automação viram erros estruturados", async () => {
    const { client } = await connect((path) =>
      path.endsWith("/profile")
        ? Response.json({ error: { code: "coexistence_not_supported", message: "coexistência" } }, { status: 409 })
        : Response.json({ error: { code: "plan_restricted", message: "plano" } }, { status: 403 }),
    );
    const profile = await client.callTool({ name: "update_phone_number_profile", arguments: { id: "p1", about: "x" } });
    const prompts = await client.callTool({ name: "update_conversational_automation", arguments: { id: "p1", prompts: ["x"] } });
    expect(profile.structuredContent).toMatchObject({ error: { code: "coexistence_not_supported", status: 409 } });
    expect(prompts.structuredContent).toMatchObject({ error: { code: "plan_restricted", status: 403 } });
  });
});
