import { Command } from "commander";
import { readFileSync } from "node:fs";
import { collect, context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printOffsetFooter,
  printLine,
} from "../output.js";

/** Lê e parseia JSON de um arquivo. */
function readJsonFile(file: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(`Não foi possível ler o arquivo: ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Arquivo não é JSON válido: ${file}`);
  }
}

export function registerTemplates(program: Command): void {
  const templates = program
    .command("templates")
    .description("Gerenciar templates de mensagem");

  templates
    .command("list")
    .description("Lista templates (paginação por offset)")
    .option("--status <status>", "filtra por status")
    .option("--category <categoria>", "filtra por categoria")
    .option("--phone-number-id <id>", "filtra por número")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.templates.list({
        status: opts.status,
        category: opts.category,
        phone_number_id: opts.phoneNumberId,
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "NOME", key: "name" },
        { header: "IDIOMA", key: "language" },
        { header: "CATEGORIA", key: "category" },
        { header: "STATUS", key: "status" },
      ]);
      printOffsetFooter(res.meta);
    });

  templates
    .command("get <id>")
    .description("Detalha um template")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.templates.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  templates
    .command("create")
    .description("Cria um template (componentes via --components arquivo.json)")
    .requiredOption("--name <nome>", "nome do template")
    .requiredOption("--language <idioma>", "código de idioma (ex.: pt_BR)")
    .requiredOption("--category <categoria>", "categoria (MARKETING, UTILITY, …)")
    .requiredOption(
      "--components <arquivo>",
      "arquivo JSON com o array de componentes",
    )
    .option("--waba-connection-id <id>", "conexão WABA alvo")
    .option("--phone-number-id <id>", "número alvo")
    .option(
      "--opt-out-button <texto>",
      "texto de um botão de resposta rápida que é de saída (repetível; o toque grava a recusa)",
      collect,
    )
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const components = readJsonFile(opts.components);
      const data = await client.templates.create({
        name: opts.name,
        language: opts.language,
        category: opts.category,
        components: components as unknown[],
        waba_connection_id: opts.wabaConnectionId,
        phone_number_id: opts.phoneNumberId,
        ...(opts.optOutButton ? { opt_out_buttons: opts.optOutButton as string[] } : {}),
      });
      if (format === "json") return printJson(data);
      printLine("Template criado.");
      printDetail(data as Record<string, unknown>);
    });

  templates
    .command("update <id>")
    .description(
      "Marca quais botões de resposta rápida são de saída (o toque grava a recusa da finalidade do template). " +
        "Anotação do BotoZap: não altera o template na Meta",
    )
    .option("--opt-out-button <texto>", "texto de um botão de saída (repetível; substitui a marcação inteira)", collect)
    .option("--clear-opt-out-buttons", "limpa a marcação")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.optOutButton && opts.clearOptOutButtons) {
        throw new Error("Use --opt-out-button OU --clear-opt-out-buttons, não os dois.");
      }
      if (!opts.optOutButton && !opts.clearOptOutButtons) {
        throw new Error("Informe --opt-out-button <texto> (repetível) ou --clear-opt-out-buttons.");
      }
      const data = await client.templates.update(id, {
        opt_out_buttons: opts.clearOptOutButtons ? [] : (opts.optOutButton as string[]),
      });
      if (format === "json") return printJson(data);
      printLine("Template atualizado.");
      printDetail(data as Record<string, unknown>);
    });

  templates
    .command("sync")
    .description(
      "Sincroniza com a Meta (o Sincronizar do painel): traz o status real, importa os criados no WhatsApp Manager " +
        "e tira os excluídos lá",
    )
    .option("--customer-id <id>", "só as conexões deste cliente")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.templates.sync(opts.customerId ? { customer_id: opts.customerId as string } : {});
      if (format === "json") return printJson(data);
      printLine(
        `${data.synced} template(s) sincronizado(s) em ${data.connections} conexão(ões); ${data.removed} removido(s) por exclusão na Meta.`,
      );
      if (data.skipped_without_token > 0) {
        printLine(`${data.skipped_without_token} conexão(ões) sem autorização foram puladas: reconecte o número.`);
      }
      if (data.automations_outdated) printLine("Uma régua de modelo não acompanhou a mudança de status: sincronize de novo.");
    });
}
