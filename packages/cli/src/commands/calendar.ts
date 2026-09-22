import type { Command } from "commander";
import { operation } from "./attendance.js";
export function registerCalendar(program: Command) {
  const group = program
    .command("calendar")
    .description(
      "Google Calendar: autorize primeiro em /calendarios no Painel; scopes calendar:read/write",
    );
  operation(
    group,
    "connections",
    "Lista conexões (page,per_page)",
    (c, _id, p) => c.calendar.connections(p),
  );
  operation(
    group,
    "disconnect <id>",
    "Desconecta conta Google e seus calendários",
    (c, id) => c.calendar.disconnect(id!),
  );
  operation(group, "calendars <id>", "Lista calendários da conexão", (c, id) =>
    c.calendar.calendars(id!),
  );
  operation(
    group,
    "refresh <id>",
    "Atualiza catálogo de calendários Google da conexão",
    (c, id) => c.calendar.refresh(id!),
  );
  operation(
    group,
    "select <id>",
    "Configura destino/ocupação com CAS expected_revision",
    (c, id, p) =>
      c.calendar.select(
        id!,
        p as {
          destination: boolean;
          include_busy: boolean;
          expected_revision: number;
        },
      ),
    ["destination", "include_busy", "expected_revision"],
  );
  operation(
    group,
    "jobs",
    "Lista sincronizações (connection_id,page,per_page)",
    (c, _id, p) => c.calendar.jobs(p),
  );
  operation(
    group,
    "retry-job <id>",
    "Reagenda sincronização com falha",
    (c, id) => c.calendar.retryJob(id!),
  );
  operation(
    group,
    "resolve-conflict <id>",
    "ID do compromisso; choice local/remote e expected_revision",
    (c, id, p) =>
      c.calendar.resolveConflict(
        id!,
        p as { expected_revision: number; choice: "local" | "remote" },
      ),
    ["choice", "expected_revision"],
  );
}
