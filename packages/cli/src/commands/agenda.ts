import type { Command } from "commander";
import type {
  CreateAppointment,
  UpdateAppointment,
  AvailabilityQuery,
  AppointmentServiceInput,
  AppointmentScheduleInput,
  AppointmentExceptionInput,
} from "@botozap/sdk";
import { operation } from "./attendance.js";
export function registerAgenda(program: Command) {
  const group = program
    .command("appointments")
    .description("Agenda completa; scopes appointments:read/write");
  operation(
    group,
    "list",
    "Filtros: customer_id,contact_id,owner_user_id,service_id,status,from,to,date(UTC),page,per_page",
    (c, _id, p) => c.appointments.list(p),
  );
  operation(group, "get <id>", "Detalha compromisso e revision", (c, id) =>
    c.appointments.get(id!),
  );
  operation(
    group,
    "create",
    "Cria compromisso; idempotency_key opcional no header; title,ends_at,time_zone,owner_user_id,service_id,links CRM e meeting_requested opcionais",
    (c, _id, p) => {
      const { idempotency_key, ...body } = p;
      return c.appointments.create(body as unknown as CreateAppointment, {
        idempotencyKey: idempotency_key as string | undefined,
      });
    },
    ["contact_id", "scheduled_at"],
  );
  operation(
    group,
    "update <id>",
    "Edita compromisso com expected_revision; legado scheduled_at/note continua aceito",
    (c, id, p) => c.appointments.update(id!, p as UpdateAppointment),
  );
  operation(
    group,
    "delete <id>",
    "Exclui compromisso; Google deve estar cancelado e sincronizado antes",
    (c, id) => c.appointments.delete(id!),
  );
  operation(group, "history <id>", "Histórico paginado (page)", (c, id, p) =>
    c.appointments.history(id!, p),
  );
  operation(
    group,
    "availability",
    "Horários livres calculados incluindo jornadas, exceções, buffers e calendários",
    (c, _id, p) =>
      c.appointments.availability(p as unknown as AvailabilityQuery),
    ["customer_id", "owner_user_id", "service_id", "from", "to"],
  );
  for (const kind of ["services", "schedules", "exceptions"] as const) {
    const configuration = group
      .command(kind)
      .description(`Configuração de ${kind}`);
    operation(
      configuration,
      "list",
      "customer_id e page",
      (c, _id, p) => c.appointments[kind].list(p as { customer_id: string }),
      ["customer_id"],
    );
    const required =
      kind === "services"
        ? [
            "customer_id",
            "name",
            "duration_minutes",
            "slot_minutes",
            "buffer_before_minutes",
            "buffer_after_minutes",
            "minimum_notice_minutes",
            "booking_horizon_days",
            "active",
          ]
        : kind === "schedules"
          ? ["customer_id", "owner_user_id", "time_zone", "windows"]
          : [
              "customer_id",
              "owner_user_id",
              "local_date",
              "start_minute",
              "end_minute",
              "kind",
            ];
    operation(
      configuration,
      "create",
      "Cria configuração completa; consulte tipos públicos do SDK",
      (c, _id, p) =>
        kind === "services"
          ? c.appointments.services.create(
              p as unknown as AppointmentServiceInput,
            )
          : kind === "schedules"
            ? c.appointments.schedules.create(
                p as unknown as AppointmentScheduleInput,
              )
            : c.appointments.exceptions.create(
                p as unknown as AppointmentExceptionInput,
              ),
      required,
    );
    operation(
      configuration,
      "update <id>",
      "Altera campos da configuração com expected_revision",
      (c, id, p) =>
        kind === "services"
          ? c.appointments.services.update(
              id!,
              p as unknown as AppointmentServiceInput & {
                expected_revision: number;
              },
            )
          : kind === "schedules"
            ? c.appointments.schedules.update(
                id!,
                p as unknown as AppointmentScheduleInput & {
                  expected_revision: number;
                },
              )
            : c.appointments.exceptions.update(
                id!,
                p as unknown as AppointmentExceptionInput & {
                  expected_revision: number;
                },
              ),
      ["expected_revision"],
    );
    if (kind === "exceptions")
      operation(
        configuration,
        "delete <id>",
        "Exclui exceção com expected_revision",
        (c, id, p) =>
          c.appointments.exceptions.delete(id!, Number(p.expected_revision)),
        ["expected_revision"],
      );
  }
}
