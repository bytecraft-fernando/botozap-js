import { Command } from "commander";
import { context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
} from "../output.js";

export function registerConversations(program: Command): void {
  const conv = program
    .command("conversations")
    .description("Listar e gerenciar conversas");

  conv
    .command("list")
    .description("Lista conversas (paginação por cursor)")
    .option("--phone-number-id <id>", "filtra por número")
    .option("--status <status>", "active | ended")
    .option("--phone-number <e164>", "filtra pelo número do contato")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.conversations.list({
        phone_number_id: opts.phoneNumberId,
        status: opts.status,
        phone_number: opts.phoneNumber,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "CONTATO", key: "phone_number" },
        { header: "STATUS", key: "status" },
        { header: "ATUALIZADA", key: "updated_at" },
      ]);
      printCursorFooter(res.paging);
    });

  conv
    .command("get <id>")
    .description("Detalha uma conversa")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.conversations.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  conv
    .command("update <id>")
    .description("Atualiza o status de uma conversa (active | ended)")
    .requiredOption("--status <status>", "active | ended")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.conversations.update(id, {
        status: opts.status,
      });
      if (format === "json") return printJson(data);
      printLine("Conversa atualizada.");
      printDetail(data as Record<string, unknown>);
    });
}
