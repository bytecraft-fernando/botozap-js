import { Command } from "commander";
import { context, toInt } from "./shared.js";
import { printJson, printTable, printCursorFooter } from "../output.js";

export function registerDeliveries(program: Command): void {
  const deliveries = program
    .command("deliveries")
    .description("Entregas de webhook (webhook_deliveries)");

  deliveries
    .command("list")
    .description("Lista entregas de webhook (paginação por cursor)")
    .option("--endpoint-id <id>", "filtra por endpoint")
    .option("--webhook-id <id>", "alias de --endpoint-id")
    .option("--status <status>", "filtra por status")
    .option("--event-type <tipo>", "filtra por tipo de evento")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      // `webhook_id` é alias de `endpoint_id` na rota; --endpoint-id/--webhook-id
      // colapsam no mesmo param (endpoint tem precedência).
      const res = await client.webhookDeliveries.list({
        webhook_id: opts.endpointId ?? opts.webhookId,
        status: opts.status,
        event_type: opts.eventType,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "EVENTO", key: "event_type" },
        { header: "STATUS", key: "status" },
        { header: "HTTP", key: "response_status" },
        { header: "CRIADA", key: "created_at" },
      ]);
      printCursorFooter(res.paging);
    });
}
