import { Command } from "commander";
import { context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printOffsetFooter,
  printLine,
} from "../output.js";

export function registerCustomers(program: Command): void {
  const customers = program
    .command("customers")
    .description("Gerenciar clientes (do seu workspace)");

  customers
    .command("list")
    .description("Lista clientes (paginação por offset)")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.customers.list({
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "NOME", key: "name" },
        { header: "EXTERNO", key: "external_customer_id" },
        { header: "CRIADO", key: "created_at" },
      ]);
      printOffsetFooter(res.meta);
    });

  customers
    .command("get <id>")
    .description("Detalha um cliente")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.customers.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  customers
    .command("create")
    .description("Cria um cliente")
    .requiredOption("--name <nome>", "nome do cliente (obrigatório)")
    .option("--external-customer-id <id>", "id externo")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.customers.create({
        name: opts.name,
        external_customer_id: opts.externalCustomerId,
      });
      if (format === "json") return printJson(data);
      printLine("Cliente criado.");
      printDetail(data as Record<string, unknown>);
    });

  customers
    .command("update <id>")
    .description("Atualiza um cliente")
    .option("--name <nome>", "novo nome")
    .option("--external-customer-id <id>", "novo id externo")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const body: { name?: string; external_customer_id?: string } = {};
      if (opts.name !== undefined) body.name = opts.name;
      if (opts.externalCustomerId !== undefined) {
        body.external_customer_id = opts.externalCustomerId;
      }
      if (Object.keys(body).length === 0) {
        throw new Error("Informe ao menos --name ou --external-customer-id.");
      }
      const data = await client.customers.update(id, body);
      if (format === "json") return printJson(data);
      printLine("Cliente atualizado.");
      printDetail(data as Record<string, unknown>);
    });

  customers
    .command("delete <id>")
    .description("Remove um cliente")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await client.customers.delete(id);
      if (format === "json") return printJson({ deleted: true });
      printLine("Cliente removido.");
    });
}
