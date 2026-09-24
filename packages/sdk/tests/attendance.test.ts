import { describe, expect, it, vi } from "vitest";
import { BotoZap, BotoZapError, type JourneyConfig } from "../src/index.js";
const id = "a/b",
  customer = "business",
  stamp = "2026-09-22T03:05:06.123456+00:00";
const journey: JourneyConfig = {
  customer_id: customer,
  name: "Retorno",
  trigger_kind: "appointment",
  steps: [
    {
      template_id: "template",
      delay_minutes: 0,
      variable_map: { "1": "nome" },
    },
  ],
};
const meta = { page: 1, per_page: 20, total_count: 1, total_pages: 1 },
  paging = {
    cursors: { before: null, after: null },
    next: null,
    previous: null,
  };
type Case = [
  string,
  (c: BotoZap) => Promise<unknown>,
  string,
  string,
  unknown?,
  Record<string, string>?,
];
const cases: Case[] = [
  [
    "calendar connections",
    (c) => c.calendar.connections({ page: 2 }),
    "GET",
    "/calendar/connections",
    undefined,
    { page: "2" },
  ],
  [
    "calendar catalogue",
    (c) => c.calendar.calendars(id),
    "GET",
    "/calendar/connections/a%2Fb/calendars",
  ],
  [
    "calendar refresh",
    (c) => c.calendar.refresh(id),
    "POST",
    "/calendar/connections/a%2Fb/refresh",
  ],
  [
    "calendar selection",
    (c) =>
      c.calendar.select(id, {
        destination: true,
        include_busy: false,
        expected_revision: 4,
      }),
    "PATCH",
    "/calendar/selections/a%2Fb",
    { destination: true, include_busy: false, expected_revision: 4 },
  ],
  [
    "calendar jobs",
    (c) => c.calendar.jobs({ connection_id: id, page: 2 }),
    "GET",
    "/calendar/jobs",
    undefined,
    { connection_id: id, page: "2" },
  ],
  [
    "calendar retry",
    (c) => c.calendar.retryJob(id),
    "POST",
    "/calendar/jobs/a%2Fb/retry",
  ],
  [
    "calendar resolve",
    (c) =>
      c.calendar.resolveConflict(id, {
        choice: "remote",
        expected_revision: 4,
      }),
    "POST",
    "/calendar/conflicts/a%2Fb/resolve",
    { choice: "remote", expected_revision: 4 },
  ],
  [
    "calendar disconnect",
    (c) => c.calendar.disconnect(id),
    "DELETE",
    "/calendar/connections/a%2Fb",
  ],
  [
    "stages list",
    (c) => c.contactStages.list({ customer_id: customer }),
    "GET",
    "/contact-stages",
    undefined,
    { customer_id: customer },
  ],
  [
    "stages create",
    (c) =>
      c.contactStages.create({
        customer_id: customer,
        label: "Proposta",
        color: "pink",
      }),
    "POST",
    "/contact-stages",
    { customer_id: customer, label: "Proposta", color: "pink" },
  ],
  [
    "stages update",
    (c) => c.contactStages.update(id, { customer_id: customer, label: "Nova" }),
    "PATCH",
    "/contact-stages/a%2Fb",
    { customer_id: customer, label: "Nova" },
  ],
  [
    "stages reorder",
    (c) => c.contactStages.reorder({ customer_id: customer, stage_ids: [id] }),
    "PATCH",
    "/contact-stages/reorder",
    { customer_id: customer, stage_ids: [id] },
  ],
  [
    "stages delete",
    (c) => c.contactStages.delete(id, { customer_id: customer }),
    "DELETE",
    "/contact-stages/a%2Fb",
    undefined,
    { customer_id: customer },
  ],
  ["fields list", (c) => c.contactFields.list(), "GET", "/contact-fields"],
  [
    "fields create date",
    (c) =>
      c.contactFields.create({
        label: "Aniversário",
        type: "date",
        key: "birthday",
      }),
    "POST",
    "/contact-fields",
    { label: "Aniversário", type: "date", key: "birthday" },
  ],
  [
    "fields update",
    (c) => c.contactFields.update(id, { position: 2 }),
    "PATCH",
    "/contact-fields/a%2Fb",
    { position: 2 },
  ],
  [
    "fields delete",
    (c) => c.contactFields.delete(id),
    "DELETE",
    "/contact-fields/a%2Fb",
  ],
  [
    "saved list",
    (c) =>
      c.savedReplies.list({
        customer_id: "account",
        include_account: false,
        query: "Olá /cliente",
        page: 2,
      }),
    "GET",
    "/saved-replies",
    undefined,
    {
      customer_id: "account",
      include_account: "false",
      query: "Olá /cliente",
      page: "2",
    },
  ],
  ["saved get", (c) => c.savedReplies.get(id), "GET", "/saved-replies/a%2Fb"],
  [
    "saved create",
    (c) =>
      c.savedReplies.create({
        title: "Olá",
        body: "Olá {{nome}}",
        customer_id: null,
      }),
    "POST",
    "/saved-replies",
    { title: "Olá", body: "Olá {{nome}}", customer_id: null },
  ],
  [
    "saved CAS",
    (c) =>
      c.savedReplies.update(id, { expected_updated_at: stamp, shortcut: null }),
    "PATCH",
    "/saved-replies/a%2Fb",
    { expected_updated_at: stamp, shortcut: null },
  ],
  [
    "saved delete",
    (c) => c.savedReplies.delete(id, { expected_updated_at: stamp }),
    "DELETE",
    "/saved-replies/a%2Fb",
    { expected_updated_at: stamp },
  ],
  [
    "inbox pagination",
    (c) => c.inbox.get(id, { page: 3, per_page: 10 }),
    "GET",
    "/conversations/a%2Fb/tools",
    undefined,
    { page: "3", per_page: "10" },
  ],
  [
    "inbox archive CAS",
    (c) => c.inbox.mutate(id, { operation: "archive", expected_version: 2 }),
    "PATCH",
    "/conversations/a%2Fb/tools",
    { operation: "archive", expected_version: 2 },
  ],
  [
    "inbox note identity",
    (c) => c.inbox.mutate(id, { operation: "note_create", body: "Só interno" }),
    "PATCH",
    "/conversations/a%2Fb/tools",
    { operation: "note_create", body: "Só interno" },
  ],
  [
    "inbox reminder null owner",
    (c) =>
      c.inbox.mutate(id, {
        operation: "reminder_create",
        body: "Retorno",
        due_at: stamp,
        assigned_user_id: null,
      }),
    "PATCH",
    "/conversations/a%2Fb/tools",
    {
      operation: "reminder_create",
      body: "Retorno",
      due_at: stamp,
      assigned_user_id: null,
    },
  ],
  [
    "CRM list",
    (c) =>
      c.opportunities.list({
        customer_id: customer,
        owner_user_id: "unassigned",
        stage_id: "none",
        q: "a&b",
      }),
    "GET",
    "/opportunities",
    undefined,
    {
      customer_id: customer,
      owner_user_id: "unassigned",
      stage_id: "none",
      q: "a&b",
    },
  ],
  ["CRM get", (c) => c.demands.get(id), "GET", "/demands/a%2Fb"],
  [
    "CRM create",
    (c) =>
      c.opportunities.create({
        customer_id: customer,
        contact_id: "contact",
        title: "Venda",
        value_cents: 1200,
      }),
    "POST",
    "/opportunities",
    {
      customer_id: customer,
      contact_id: "contact",
      title: "Venda",
      value_cents: 1200,
    },
  ],
  [
    "CRM CAS",
    (c) =>
      c.demands.update(id, {
        expected_version: 4,
        status: "resolved",
        outcome: "converted",
      }),
    "PATCH",
    "/demands/a%2Fb",
    { expected_version: 4, status: "resolved", outcome: "converted" },
  ],
  [
    "CRM history",
    (c) => c.opportunities.activities(id, { page: 2 }),
    "GET",
    "/opportunities/a%2Fb/activities",
    undefined,
    { page: "2" },
  ],
  [
    "CRM links",
    (c) => c.demands.conversations(id, { page: 2 }),
    "GET",
    "/demands/a%2Fb/conversations",
    undefined,
    { page: "2" },
  ],
  [
    "CRM link",
    (c) => c.opportunities.linkConversation(id, "conv"),
    "POST",
    "/opportunities/a%2Fb/conversations",
    { conversation_id: "conv" },
  ],
  [
    "CRM unlink JSON",
    (c) => c.demands.unlinkConversation(id, "conv"),
    "DELETE",
    "/demands/a%2Fb/conversations",
    { conversation_id: "conv" },
  ],
  [
    "radar filters",
    (c) =>
      c.radar.list({
        customer_id: customer,
        reason: "automation_failed",
        bucket: "critical",
      }),
    "GET",
    "/radar",
    undefined,
    { customer_id: customer, reason: "automation_failed", bucket: "critical" },
  ],
  [
    "radar rules",
    (c) => c.radar.stageRules(customer),
    "GET",
    "/radar/stage-rules",
    undefined,
    { customer_id: customer },
  ],
  [
    "radar create CAS0",
    (c) =>
      c.radar.configureStageRule(id, {
        customer_id: customer,
        expected_version: 0,
        cold_hours: 24,
        critical_hours: 48,
        require_owner: true,
        require_next_step: false,
      }),
    "PUT",
    "/radar/stage-rules/a%2Fb",
    {
      customer_id: customer,
      expected_version: 0,
      cold_hours: 24,
      critical_hours: 48,
      require_owner: true,
      require_next_step: false,
    },
  ],
  [
    "journey list",
    (c) => c.journeys.list({ customer_id: customer, after: "x", limit: 10 }),
    "GET",
    "/journeys",
    undefined,
    { customer_id: customer, after: "x", limit: "10" },
  ],
  [
    "journey get",
    (c) => c.journeys.get(id, { customer_id: customer }),
    "GET",
    "/journeys/a%2Fb",
    undefined,
    { customer_id: customer },
  ],
  [
    "journey create",
    (c) => c.journeys.create(journey),
    "POST",
    "/journeys",
    journey,
  ],
  [
    "journey replace PUT",
    (c) => c.journeys.update(id, { ...journey, version: 7 }),
    "PUT",
    "/journeys/a%2Fb",
    { ...journey, version: 7 },
  ],
  [
    "journey archive query CAS",
    (c) => c.journeys.delete(id, 7),
    "DELETE",
    "/journeys/a%2Fb",
    undefined,
    { version: "7" },
  ],
  [
    "journey control",
    (c) => c.journeys.control(id, { action: "pause", version: 7 }),
    "POST",
    "/journeys/a%2Fb/control",
    { action: "pause", version: 7 },
  ],
  [
    "journey runs",
    (c) => c.journeys.runs(id, { limit: 2 }),
    "GET",
    "/journeys/a%2Fb/runs",
    undefined,
    { limit: "2" },
  ],
  [
    "journey enroll unique occurrence",
    (c) =>
      c.journeys.enroll(id, {
        contact_id: "contact",
        occurrence_key: "booking:1",
        due_at: stamp,
      }),
    "POST",
    "/journeys/a%2Fb/runs",
    { contact_id: "contact", occurrence_key: "booking:1", due_at: stamp },
  ],
  ["journey run", (c) => c.journeys.getRun(id), "GET", "/journey-runs/a%2Fb"],
  [
    "journey acknowledgement",
    (c) =>
      c.journeys.controlRun(id, { action: "acknowledge", note: "Conferido" }),
    "POST",
    "/journey-runs/a%2Fb/control",
    { action: "acknowledge", note: "Conferido" },
  ],
  [
    "agenda list",
    (c) =>
      c.appointments.list({ owner_user_id: "unassigned", date: "2026-09-22" }),
    "GET",
    "/appointments",
    undefined,
    { owner_user_id: "unassigned", date: "2026-09-22" },
  ],
  ["agenda get", (c) => c.appointments.get(id), "GET", "/appointments/a%2Fb"],
  [
    "agenda create",
    (c) =>
      c.appointments.create({
        contact_id: "contact",
        scheduled_at: stamp,
        time_zone: "America/Sao_Paulo",
        meeting_requested: true,
      }),
    "POST",
    "/appointments",
    {
      contact_id: "contact",
      scheduled_at: stamp,
      time_zone: "America/Sao_Paulo",
      meeting_requested: true,
    },
  ],
  [
    "agenda CAS",
    (c) =>
      c.appointments.update(id, {
        expected_revision: 3,
        status: "cancelled",
        cancellation_reason: "Solicitação",
      }),
    "PATCH",
    "/appointments/a%2Fb",
    {
      expected_revision: 3,
      status: "cancelled",
      cancellation_reason: "Solicitação",
    },
  ],
  [
    "agenda delete",
    (c) => c.appointments.delete(id),
    "DELETE",
    "/appointments/a%2Fb",
  ],
  [
    "agenda history",
    (c) => c.appointments.history(id, { page: 2 }),
    "GET",
    "/appointments/a%2Fb/history",
    undefined,
    { page: "2" },
  ],
  [
    "agenda availability",
    (c) =>
      c.appointments.availability({
        customer_id: customer,
        owner_user_id: "user",
        service_id: "service",
        from: stamp,
        to: stamp,
        exclude_id: id,
      }),
    "GET",
    "/appointments/availability",
    undefined,
    {
      customer_id: customer,
      owner_user_id: "user",
      service_id: "service",
      from: stamp,
      to: stamp,
      exclude_id: id,
    },
  ],
  [
    "agenda services",
    (c) => c.appointments.services.list({ customer_id: customer, page: 2 }),
    "GET",
    "/appointments/services",
    undefined,
    { customer_id: customer, page: "2" },
  ],
  [
    "agenda schedule",
    (c) =>
      c.appointments.schedules.create({
        customer_id: customer,
        owner_user_id: "user",
        time_zone: "America/Sao_Paulo",
        windows: [{ dow: 1, start: "09:00", end: "18:00" }],
      }),
    "POST",
    "/appointments/schedules",
    {
      customer_id: customer,
      owner_user_id: "user",
      time_zone: "America/Sao_Paulo",
      windows: [{ dow: 1, start: "09:00", end: "18:00" }],
    },
  ],
  [
    "agenda exception delete CAS",
    (c) => c.appointments.exceptions.delete(id, 3),
    "DELETE",
    "/appointments/exceptions/a%2Fb",
    { expected_revision: 3 },
  ],
];
describe("Atendimento: contratos HTTP e CAS", () => {
  it.each(cases)("%s", async (_name, call, method, path, body, query = {}) => {
    const f = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: [{ id: "record" }], meta, paging }),
          { status: 200 },
        ),
    );
    const c = new BotoZap({
      apiKey: "bz_live_unit",
      baseUrl: "https://api.test/v1",
      fetch: f,
    });
    await call(c);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe(`/v1${path}`);
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual(query);
    expect(init.method).toBe(method);
    expect(init.body ? JSON.parse(String(init.body)) : undefined).toEqual(body);
    expect(init.headers).toMatchObject({
      Authorization: "Bearer bz_live_unit",
    });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("criação da Agenda mantém chave idempotente no header, nunca no domínio", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: { id } })));
    const c = new BotoZap({ apiKey: "unit", fetch: f });
    await c.appointments.create(
      { contact_id: id, scheduled_at: stamp },
      { idempotencyKey: "booking:stable-1" },
    );
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      "Idempotency-Key": "booking:stable-1",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      contact_id: id,
      scheduled_at: stamp,
    });
  });
  it("falha CAS e erro ambíguo não fazem retries automáticos", async () => {
    for (const status of [409, 503]) {
      const f = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "conflict", message: "Atualize" },
            }),
            { status },
          ),
      );
      const c = new BotoZap({ apiKey: "unit", fetch: f });
      await expect(
        c.inbox.mutate("c", { operation: "archive", expected_version: 1 }),
      ).rejects.toBeInstanceOf(BotoZapError);
      expect(f).toHaveBeenCalledOnce();
    }
  });
  it("não confunde listas offset/cursor com envelopes de item", async () => {
    const c = new BotoZap({
      apiKey: "unit",
      fetch: async () => new Response(JSON.stringify({ data: [] })),
    });
    await expect(c.savedReplies.list()).rejects.toMatchObject({
      code: "malformed_response",
    });
    await expect(c.journeys.list()).rejects.toMatchObject({
      code: "malformed_response",
    });
  });
});
