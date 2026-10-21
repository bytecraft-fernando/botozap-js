import { Command } from "commander";
import { collect, context, toInt } from "./shared.js";
import type { UpdateCustomerParams } from "@botozap/sdk";
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
        {
          header: "SUSPENSO",
          key: "plan_suspended",
          format: (v) => (v === true ? "sim (Free)" : v === false ? "não" : ""),
        },
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
    .option("--opt-out-keyword <palavra>", "Palavra de saída (repetível; substitui a lista inteira)", collect)
    .option("--clear-opt-out-keywords", "remove todas as Palavras de saída")
    .option("--opt-in-keyword <palavra>", "Palavra de volta (repetível; substitui a lista inteira)", collect)
    .option("--clear-opt-in-keywords", "remove todas as Palavras de volta")
    .option("--opt-out-confirmation <texto>", "texto enviado ao contato que recusa (até 500 caracteres)")
    .option("--opt-in-confirmation <texto>", "texto enviado ao contato que volta a aceitar (até 500 caracteres)")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      for (const [list, clear, flag] of [
        [opts.optOutKeyword, opts.clearOptOutKeywords, "opt-out-keyword"],
        [opts.optInKeyword, opts.clearOptInKeywords, "opt-in-keyword"],
      ] as const) {
        if (list && clear) throw new Error(`Use --${flag} OU --clear-${flag}s, não os dois.`);
      }
      const body: UpdateCustomerParams = {};
      if (opts.name !== undefined) body.name = opts.name;
      if (opts.externalCustomerId !== undefined) {
        body.external_customer_id = opts.externalCustomerId;
      }
      if (opts.optOutKeyword) body.opt_out_keywords = opts.optOutKeyword;
      if (opts.clearOptOutKeywords) body.opt_out_keywords = [];
      if (opts.optInKeyword) body.opt_in_keywords = opts.optInKeyword;
      if (opts.clearOptInKeywords) body.opt_in_keywords = [];
      if (opts.optOutConfirmation !== undefined) body.opt_out_confirmation = opts.optOutConfirmation;
      if (opts.optInConfirmation !== undefined) body.opt_in_confirmation = opts.optInConfirmation;
      if (Object.keys(body).length === 0) {
        throw new Error(
          "Informe ao menos --name, --external-customer-id, --opt-out-keyword, --opt-in-keyword, --opt-out-confirmation ou --opt-in-confirmation.",
        );
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
