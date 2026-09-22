import { z } from "zod";
import { emptyOperationResult, type Register } from "../register.js";
const uuid = z.string().uuid(),
  version = z.number().int().positive(),
  row = z.object({ id: uuid }).passthrough(),
  item = z.object({ data: row }),
  list = z.object({ data: z.array(row) }),
  page = list.extend({
    meta: z.object({
      page: z.number(),
      per_page: z.number(),
      total_count: z.number(),
      total_pages: z.number(),
    }),
  }),
  offset = {
    page: z.number().int().positive().optional(),
    per_page: z.number().int().min(1).max(100).optional(),
  };
export function registerCalendarTools(register: Register) {
  register(
    "list_calendar_connections",
    "Lista conexões autorizadas por pessoas em /calendarios no Painel. API key não representa pessoa para OAuth. calendar:read.",
    offset,
    page,
    (c, a) => c.calendar.connections(a),
  );
  register(
    "disconnect_calendar",
    "Desconecta conta Google e interrompe sua sincronização. calendar:write.",
    { id: uuid },
    z.object({ success: z.literal(true) }),
    async (c, a) => {
      await c.calendar.disconnect(String(a.id));
      return emptyOperationResult();
    },
  );
  register(
    "list_connection_calendars",
    "Calendários disponíveis e seleções da conexão. calendar:read.",
    { connection_id: uuid },
    list,
    async (c, a) => ({
      data: await c.calendar.calendars(String(a.connection_id)),
    }),
  );
  register(
    "refresh_connection_calendars",
    "Atualiza catálogo no Google. calendar:write.",
    { connection_id: uuid },
    list,
    async (c, a) => ({
      data: await c.calendar.refresh(String(a.connection_id)),
    }),
  );
  register(
    "select_calendar",
    "Seleciona calendário de destino e se ocupação bloqueia horários; CAS revision. calendar:write.",
    {
      id: uuid,
      destination: z.boolean(),
      include_busy: z.boolean(),
      expected_revision: version,
    },
    z.object({ data: z.object({ updated: z.literal(true) }) }),
    async (c, a) => ({
      data: await c.calendar.select(String(a.id), {
        destination: Boolean(a.destination),
        include_busy: Boolean(a.include_busy),
        expected_revision: Number(a.expected_revision),
      }),
    }),
  );
  register(
    "list_calendar_jobs",
    "Lista sincronizações, falhas e tentativas. calendar:read.",
    { ...offset, connection_id: uuid.optional() },
    page,
    (c, a) => c.calendar.jobs(a),
  );
  register(
    "retry_calendar_job",
    "Reagenda sincronização com falha. calendar:write.",
    { id: uuid },
    z.object({ data: z.object({ queued: z.literal(true) }) }),
    async (c, a) => ({ data: await c.calendar.retryJob(String(a.id)) }),
  );
  register(
    "resolve_calendar_conflict",
    "Resolve conflito do compromisso (appointment_id), escolhendo local ou Google. Leia ambas as versões antes; calendar:write.",
    {
      appointment_id: uuid,
      expected_revision: version,
      choice: z.enum(["local", "remote"]),
    },
    item,
    async (c, a) => ({
      data: await c.calendar.resolveConflict(String(a.appointment_id), {
        expected_revision: Number(a.expected_revision),
        choice: a.choice as "local" | "remote",
      }),
    }),
  );
}
