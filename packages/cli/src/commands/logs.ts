import { Command } from "commander";
import { context, toInt } from "./shared.js";
import { printJson, printTable, printCursorFooter } from "../output.js";

export function registerLogs(program: Command): void {
  const logs = program
    .command("logs")
    .description("Logs de requisições à API (api_logs) e avisos da Meta por hora");

  logs
    .command("list")
    .description("Lista logs de API (paginação por cursor)")
    .option("--source <fonte>", "filtra por fonte")
    .option("--method <metodo>", "filtra por método HTTP")
    .option("--status-code <codigo>", "filtra por status HTTP")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.apiLogs.list({
        source: opts.source,
        method: opts.method,
        status_code: toInt(opts.statusCode),
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "MÉTODO", key: "method" },
        { header: "ROTA", key: "path", max: 40 },
        { header: "STATUS", key: "status_code" },
        { header: "FONTE", key: "source" },
        { header: "ID DA CHAMADA", key: "request_id", max: 40 },
        { header: "CRIADO", key: "created_at" },
      ]);
      printCursorFooter(res.paging);
    });

  logs
    .command("meta")
    .description("Avisos da Meta contados por hora, da hora mais nova para a mais antiga (cursor)")
    .option("--channel-account-id <id>", "uma Conta de canal (o número ou a conta do Instagram)")
    .option("--since <iso>", "início do período (ISO 8601, inclusivo)")
    .option("--until <iso>", "fim do período (ISO 8601, exclusivo)")
    .option("--limit <n>", "horas por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.apiLogs.metaHourly({
        channel_account_id: opts.channelAccountId,
        since: opts.since,
        until: opts.until,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(
        res.data.map((h) => ({ ...h, canais: h.channels.length })),
        [
          { header: "HORA", key: "hour" },
          { header: "RECEBIDOS", key: "received" },
          { header: "COM FALHA", key: "failed" },
          { header: "CANAIS", key: "canais" },
        ],
      );
      printCursorFooter(res.paging);
    });
}
