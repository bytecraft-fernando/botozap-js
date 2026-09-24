import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  stamp = "2026-09-22T03:05:06.123456+00:00";
const clients: Client[] = [];
async function connect(payload: unknown = { data: { id } }, status = 200) {
  const fetch = vi.fn(
    async () => new Response(JSON.stringify(payload), { status }),
  );
  const server = buildServer({
    apiKey: "bz_live_PRIVATE",
    baseUrl: "https://api.test/v1",
    fetch,
  });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "attendance-test", version: "1" });
  await Promise.all([server.connect(s), client.connect(c)]);
  clients.push(client);
  return { client, fetch };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});
const cases: Array<[string, Record<string, unknown>, string, string, unknown]> =
  [
    [
      "update_saved_reply",
      { id, title: "Olá", expected_updated_at: stamp },
      "PATCH",
      `/saved-replies/${id}`,
      { title: "Olá", expected_updated_at: stamp },
    ],
    [
      "mutate_inbox_tools",
      {
        conversation_id: id,
        input: { operation: "note_create", body: "Privado" },
      },
      "PATCH",
      `/conversations/${id}/tools`,
      { operation: "note_create", body: "Privado" },
    ],
    [
      "create_opportunity",
      {
        customer_id: id,
        contact_id: other,
        title: "Venda",
        owner_user_id: null,
      },
      "POST",
      "/opportunities",
      {
        customer_id: id,
        contact_id: other,
        title: "Venda",
        owner_user_id: null,
      },
    ],
    [
      "update_demand",
      { id, expected_version: 2, status: "resolved", outcome: "converted" },
      "PATCH",
      `/demands/${id}`,
      { expected_version: 2, status: "resolved", outcome: "converted" },
    ],
    [
      "create_journey",
      {
        customer_id: id,
        name: "Agenda",
        trigger_kind: "appointment",
        steps: [{ template_id: other, delay_minutes: 0 }],
      },
      "POST",
      "/journeys",
      {
        customer_id: id,
        name: "Agenda",
        trigger_kind: "appointment",
        steps: [{ template_id: other, delay_minutes: 0 }],
      },
    ],
    [
      "enroll_journey",
      { id, contact_id: other, occurrence_key: "appointment:1" },
      "POST",
      `/journeys/${id}/runs`,
      { contact_id: other, occurrence_key: "appointment:1" },
    ],
    [
      "control_journey_run",
      { id, input: { action: "acknowledge", note: "Verificado" } },
      "POST",
      `/journey-runs/${id}/control`,
      { action: "acknowledge", note: "Verificado" },
    ],
    [
      "create_conversation_assignment",
      { conversation_id: id, user_id: other, notes: "Especialista" },
      "POST",
      `/conversations/${id}/assignments`,
      { user_id: other, notes: "Especialista" },
    ],
    [
      "update_conversation_assignment",
      { conversation_id: id, assignment_id: other, active: false, notes: null },
      "PATCH",
      `/conversations/${id}/assignments/${other}`,
      { active: false, notes: null },
    ],
    [
      "create_appointment",
      {
        contact_id: id,
        scheduled_at: stamp,
        time_zone: "America/Sao_Paulo",
        meeting_requested: true,
      },
      "POST",
      "/appointments",
      {
        contact_id: id,
        scheduled_at: stamp,
        time_zone: "America/Sao_Paulo",
        meeting_requested: true,
      },
    ],
    [
      "update_appointment",
      { id, expected_revision: 2, status: "cancelled" },
      "PATCH",
      `/appointments/${id}`,
      { expected_revision: 2, status: "cancelled" },
    ],
    [
      "create_appointment_schedule",
      {
        customer_id: id,
        owner_user_id: other,
        time_zone: "America/Sao_Paulo",
        windows: [{ dow: 1, start: "09:00", end: "18:00" }],
      },
      "POST",
      "/appointments/schedules",
      {
        customer_id: id,
        owner_user_id: other,
        time_zone: "America/Sao_Paulo",
        windows: [{ dow: 1, start: "09:00", end: "18:00" }],
      },
    ],
  ];
describe("MCP Atendimento: schemas, domínio e transporte real em memória", () => {
  it("busca de respostas respeita o limite de 100 caracteres da API após trim", async () => {
    const payload = {
      data: [],
      meta: { page: 1, per_page: 20, total_count: 0, total_pages: 0 },
    };
    const { client, fetch } = await connect(payload);
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === "list_saved_replies");
    expect(tool?.inputSchema.properties?.query).toMatchObject({ maxLength: 100 });

    const query = "á".repeat(100);
    const accepted = await client.callTool({
      name: "list_saved_replies",
      arguments: { query: `  ${query}  ` },
    });
    expect(accepted.isError).toBeFalsy();
    expect(accepted.structuredContent).toEqual(payload);
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1/saved-replies");
    expect(url.searchParams.get("query")).toBe(query);

    const rejected = await client.callTool({
      name: "list_saved_replies",
      arguments: { query: `${query}á` },
    });
    expect(rejected.isError).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(cases)("%s", async (name, args, method, path, body) => {
    const { client, fetch } = await connect();
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: { id } });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe(`/v1${path}`);
    expect(init.method).toBe(method);
    expect(JSON.parse(String(init.body))).toEqual(body);
  });
  it("catálogo completo anuncia schemas e não inventa tools de rascunho ou identidade OAuth", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toMatchSnapshot();
    for (const tool of tools)
      expect(
        Object.keys(tool.outputSchema?.properties ?? {}),
        tool.name,
      ).not.toHaveLength(0);
    expect(tools.some((t) => /(?:conversation|inbox).*draft|oauth_callback/.test(t.name))).toBe(false);
  });
  it.each([
    ["update_saved_reply", { id, body: "Sem versão" }],
    [
      "mutate_inbox_tools",
      {
        conversation_id: id,
        input: { operation: "draft_save", body: "Privado" },
      },
    ],
    [
      "mutate_inbox_tools",
      {
        conversation_id: id,
        input: { operation: "archive", expected_version: 0 },
      },
    ],
    [
      "mutate_inbox_tools",
      {
        conversation_id: id,
        input: {
          operation: "note_create",
          body: "Nota",
          author_user_id: other,
        },
      },
    ],
    ["update_demand", { id, status: "resolved" }],
    ["control_journey_run", { id, input: { action: "acknowledge" } }],
    [
      "update_appointment_service",
      { id, customer_id: other, name: "Sem revisão" },
    ],
  ])("%s recusa contrato inválido antes da API", async (name, args) => {
    const { client, fetch } = await connect();
    const result = await client.callTool({
      name: String(name),
      arguments: args as Record<string, unknown>,
    });
    expect(result.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [
      "select_calendar",
      { id, destination: true, include_busy: false, expected_revision: 2 },
      { data: { updated: true } },
      "PATCH",
      `/calendar/selections/${id}`,
      { destination: true, include_busy: false, expected_revision: 2 },
    ],
    [
      "retry_calendar_job",
      { id },
      { data: { queued: true } },
      "POST",
      `/calendar/jobs/${id}/retry`,
      undefined,
    ],
    [
      "resolve_calendar_conflict",
      { appointment_id: id, choice: "remote", expected_revision: 2 },
      { data: { id } },
      "POST",
      `/calendar/conflicts/${id}/resolve`,
      { choice: "remote", expected_revision: 2 },
    ],
    [
      "reorder_contact_stages",
      { customer_id: other, stage_ids: [id] },
      { data: [{ id, key: "new", label: "Nova", position: 1 }] },
      "PATCH",
      "/contact-stages/reorder",
      { customer_id: other, stage_ids: [id] },
    ],
  ] as const)(
    "%s preserva semântica de retorno",
    async (name, args, payload, method, path, body) => {
      const { client, fetch } = await connect(payload);
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual(payload);
      const [url, init] = fetch.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(new URL(url).pathname).toBe(`/v1${path}`);
      expect(init.method).toBe(method);
      expect(init.body ? JSON.parse(String(init.body)) : undefined).toEqual(
        body,
      );
    },
  );
  it("Agenda separa chave idempotente do body", async () => {
    const { client, fetch } = await connect();
    const result = await client.callTool({
      name: "create_appointment",
      arguments: {
        contact_id: id,
        scheduled_at: stamp,
        idempotency_key: "stable-appointment",
      },
    });
    expect(result.isError).toBeFalsy();
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      "Idempotency-Key": "stable-appointment",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      contact_id: id,
      scheduled_at: stamp,
    });
  });
  it("409 é estruturado, sem retry e sem chave no erro", async () => {
    const { client, fetch } = await connect(
      { error: { code: "conflict", message: "Atualize bz_live_PRIVATE" } },
      409,
    );
    const result = await client.callTool({
      name: "update_saved_reply",
      arguments: { id, expected_updated_at: stamp, title: "Nova" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("bz_live_PRIVATE");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it("Radar aceita compromisso e motivo de calendário sem perder filtros", async () => {
  const { client, fetch } = await connect({
    data: [],
    meta: {
      page: 1,
      per_page: 20,
      total_count: 0,
      total_pages: 0,
      counts: { critical: 0, at_risk: 0, scheduled: 0 },
    },
  });
  const result = await client.callTool({
    name: "list_radar",
    arguments: {
      customer_id: id,
      entity_type: "appointment",
      reason: "calendar_conflict",
    },
  });
  expect(result.isError, JSON.stringify(result)).toBeFalsy();
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.searchParams.get("entity_type")).toBe("appointment");
  expect(url.searchParams.get("reason")).toBe("calendar_conflict");
});
