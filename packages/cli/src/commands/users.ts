import { Command } from "commander";
import { context, toInt } from "./shared.js";
import { printJson, printTable, printOffsetFooter } from "../output.js";

export function registerUsers(program: Command): void {
  const users = program
    .command("users")
    .description("Usuários do workspace");

  users
    .command("list")
    .description("Lista usuários (paginação por offset)")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.users.list({
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "NOME", key: "name" },
        { header: "EMAIL", key: "email" },
        { header: "PAPEL", key: "role" },
      ]);
      printOffsetFooter(res.meta);
    });
}
