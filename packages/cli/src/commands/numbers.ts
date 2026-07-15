import { Command } from "commander";
import { context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printOffsetFooter,
} from "../output.js";

export function registerNumbers(program: Command): void {
  const numbers = program
    .command("numbers")
    .description("Números de telefone (WhatsApp) conectados");

  numbers
    .command("list")
    .description("Lista números (paginação por offset)")
    .option("--customer-id <id>", "filtra por cliente")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.phoneNumbers.list({
        customer_id: opts.customerId,
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "NÚMERO", key: "display_phone_number" },
        { header: "NOME", key: "verified_name" },
        { header: "STATUS", key: "status" },
        { header: "QUALIDADE", key: "quality_rating" },
      ]);
      printOffsetFooter(res.meta);
    });

  numbers
    .command("get <id>")
    .description("Detalha um número")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  numbers
    .command("health <id>")
    .description("Verifica a saúde de um número")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.health(id);
      if (format === "json") return printJson(data);
      printDetail(data);
    });
}
