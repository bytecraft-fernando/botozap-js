import { z } from "zod";
import type {
  CreateAppointment,
  UpdateAppointment,
  AvailabilityQuery,
  AppointmentQuery,
  AppointmentServiceInput,
  AppointmentScheduleInput,
  AppointmentExceptionInput,
} from "@botozap/sdk";
import { emptyOperationResult, type Register } from "../register.js";
const uuid = z.string().uuid(),
  instant = z.string().datetime({ offset: true }),
  version = z.number().int().positive(),
  nullableUuid = uuid.nullable().optional();
const zone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Fuso inválido.");
const row = z.object({ id: z.string() }).passthrough(),
  item = z.object({ data: row }),
  page = z.object({
    data: z.array(row),
    meta: z.object({
      page: z.number(),
      per_page: z.number(),
      total_count: z.number(),
      total_pages: z.number(),
    }),
  }),
  success = z.object({ success: z.literal(true) });
const idempotency_key = z.string().min(8).max(200).optional();
const fields = {
  title: z.string().min(1).max(200).optional(),
  scheduled_at: instant,
  ends_at: instant.optional(),
  time_zone: zone.optional(),
  note: z.string().max(16000).nullable().optional(),
  service_id: nullableUuid,
  owner_user_id: nullableUuid,
  status: z
    .enum(["pending", "confirmed", "cancelled", "completed", "no_show"])
    .optional(),
  conversation_id: nullableUuid,
  opportunity_id: nullableUuid,
  demand_id: nullableUuid,
  cancellation_reason: z.string().max(2000).nullable().optional(),
  location: z.string().max(1000).nullable().optional(),
  meeting_requested: z.boolean().optional(),
};
const service = {
  customer_id: uuid,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(1440),
  slot_minutes: z.number().int().min(5).max(240),
  buffer_before_minutes: z.number().int().min(0).max(240),
  buffer_after_minutes: z.number().int().min(0).max(240),
  minimum_notice_minutes: z.number().int().min(0).max(43200),
  booking_horizon_days: z.number().int().min(1).max(366),
  active: z.boolean(),
};
const schedule = {
  customer_id: uuid,
  owner_user_id: uuid,
  time_zone: zone,
  windows: z
    .array(
      z
        .object({
          dow: z.number().int().min(0).max(6),
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/),
        })
        .refine((v) => v.start < v.end),
    )
    .max(50),
};
const exception = {
  customer_id: uuid,
  owner_user_id: uuid,
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  kind: z.enum(["available", "busy"]),
  reason: z.string().max(500).nullable().optional(),
};
export function registerAgendaTools(register: Register) {
  register(
    "list_appointments",
    "Lista Agenda por período/Cliente/responsável; date é dia UTC. appointments:read.",
    {
      customer_id: uuid.optional(),
      contact_id: uuid.optional(),
      owner_user_id: z.union([uuid, z.literal("unassigned")]).optional(),
      service_id: uuid.optional(),
      status: fields.status,
      date: z.string().optional(),
      from: instant.optional(),
      to: instant.optional(),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
    },
    page,
    (c, a) => c.appointments.list(a as AppointmentQuery),
  );
  register(
    "get_appointment",
    "Lê compromisso e revision para CAS; appointments:read.",
    { id: uuid },
    item,
    async (c, a) => ({ data: await c.appointments.get(String(a.id)) }),
  );
  register(
    "create_appointment",
    "Cria compromisso com vínculos CRM. meeting_requested pode criar link Meet via conexão configurada. appointments:write.",
    { ...fields, contact_id: uuid, idempotency_key },
    item,
    async (c, a) => {
      const { idempotency_key, ...p } = a;
      return {
        data: await c.appointments.create(p as unknown as CreateAppointment, {
          idempotencyKey: idempotency_key as string | undefined,
        }),
      };
    },
  );
  register(
    "update_appointment",
    "Edita compromisso com revisão lida. Casos legados scheduled_at/note continuam aceitos sem revisão. appointments:write.",
    {
      id: uuid,
      ...z.object(fields).partial().shape,
      expected_revision: version.optional(),
    },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.appointments.update(String(id), p as UpdateAppointment),
      };
    },
  );
  register(
    "delete_appointment",
    "Exclui compromisso; cancele e aguarde sincronização Google quando houver evento externo. appointments:write.",
    { id: uuid },
    success,
    async (c, a) => {
      await c.appointments.delete(String(a.id));
      return emptyOperationResult();
    },
  );
  register(
    "list_appointment_history",
    "Histórico do compromisso, 20 por página. appointments:read.",
    { id: uuid, page: z.number().int().positive().optional() },
    page,
    (c, a) =>
      c.appointments.history(String(a.id), {
        page: a.page as number | undefined,
      }),
  );
  register(
    "get_appointment_availability",
    "Horários livres com jornada, exceções, buffers e calendários. appointments:read.",
    {
      customer_id: uuid,
      owner_user_id: uuid,
      service_id: uuid,
      from: instant,
      to: instant,
      exclude_id: uuid.optional(),
    },
    z.object({
      data: z.object({
        time_zone: z.string(),
        slots: z.array(z.object({ starts_at: instant, ends_at: instant })),
        schedule_published: z.boolean(),
      }),
    }),
    async (c, a) => ({
      data: await c.appointments.availability(
        a as unknown as AvailabilityQuery,
      ),
    }),
  );
  for (const [kind, singular, shape] of [
    ["services", "service", service],
    ["schedules", "schedule", schedule],
    ["exceptions", "exception", exception],
  ] as const) {
    register(
      `list_appointment_${kind}`,
      `Lista ${kind} do Cliente (100 por página). appointments:read.`,
      { customer_id: uuid, page: z.number().int().positive().optional() },
      page,
      (c, a) => c.appointments[kind].list(a as { customer_id: string }),
    );
    register(
      `create_appointment_${singular}`,
      `Cria configuração de ${singular}. appointments:write.`,
      shape,
      item,
      async (c, p) => ({
        data:
          kind === "services"
            ? await c.appointments.services.create(
                p as unknown as AppointmentServiceInput,
              )
            : kind === "schedules"
              ? await c.appointments.schedules.create(
                  p as unknown as AppointmentScheduleInput,
                )
              : await c.appointments.exceptions.create(
                  p as unknown as AppointmentExceptionInput,
                ),
      }),
    );
    register(
      `update_appointment_${singular}`,
      `Atualiza campos da configuração com expected_revision. appointments:write.`,
      {
        id: uuid,
        ...z.object(shape).partial().shape,
        expected_revision: version,
      },
      item,
      async (c, a) => {
        const { id, ...p } = a;
        return {
          data:
            kind === "services"
              ? await c.appointments.services.update(
                  String(id),
                  p as unknown as AppointmentServiceInput & {
                    expected_revision: number;
                  },
                )
              : kind === "schedules"
                ? await c.appointments.schedules.update(
                    String(id),
                    p as unknown as AppointmentScheduleInput & {
                      expected_revision: number;
                    },
                  )
                : await c.appointments.exceptions.update(
                    String(id),
                    p as unknown as AppointmentExceptionInput & {
                      expected_revision: number;
                    },
                  ),
        };
      },
    );
  }
  register(
    "delete_appointment_exception",
    "Exclui exceção de jornada com CAS; appointments:write.",
    { id: uuid, expected_revision: version },
    success,
    async (c, a) => {
      await c.appointments.exceptions.delete(
        String(a.id),
        Number(a.expected_revision),
      );
      return emptyOperationResult();
    },
  );
}
