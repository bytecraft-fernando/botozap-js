import { Command } from "commander";
import { context, toInt } from "./shared.js";
import { printCursorFooter, printJson, printTable } from "../output.js";

export function registerTeamEvents(program: Command): void {
  const teamEvents = program
    .command("team-events")
    .description("Registro de atividades da equipe (scope team:read; só Administrador)");

  teamEvents
    .command("list")
    .description("Lista o registro de atividades, do mais novo ao mais antigo (paginação por cursor)")
    .option("--since <data>", "a partir desta data (ISO 8601)")
    .option("--until <data>", "antes desta data (ISO 8601)")
    .option("--actor-id <id>", "pessoa ou chave de API que agiu")
    .option("--action <ação>", "código da ação, por exemplo export.requested")
    .option("--target-type <tipo>", "tipo do alvo, por exemplo conversation")
    .option("--target-id <id>", "id do alvo, por exemplo o da conversa")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.teamEvents.list({
        since: opts.since,
        until: opts.until,
        actor_id: opts.actorId,
        action: opts.action,
        target_type: opts.targetType,
        target_id: opts.targetId,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data as unknown as Record<string, unknown>[], [
        { header: "QUANDO", key: "created_at" },
        { header: "QUEM", key: "actor.label", max: 28 },
        { header: "AÇÃO", key: "action_label", max: 40 },
        { header: "ALVO", key: "target.label", max: 28 },
        { header: "IP", key: "ip_address" },
      ]);
      printCursorFooter(res.paging);
    });
}
