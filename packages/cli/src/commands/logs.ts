import { Command } from "commander";
import { context, toInt } from "./shared.js";
import { printJson, printTable, printCursorFooter } from "../output.js";

export function registerLogs(program: Command): void {
  const logs = program
    .command("logs")
    .description("Logs de requisições à API (api_logs)");

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
        { header: "CRIADO", key: "created_at" },
      ]);
      printCursorFooter(res.paging);
    });
}
