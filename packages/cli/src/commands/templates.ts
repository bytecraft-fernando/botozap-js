import { Command } from "commander";
import { readFileSync } from "node:fs";
import { context, toInt } from "./shared.js";
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
      });
      if (format === "json") return printJson(data);
      printLine("Template criado.");
      printDetail(data as Record<string, unknown>);
    });
}
