import { Command } from "commander";
import { context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printOffsetFooter,
  printLine,
} from "../output.js";

export function registerSetupLinks(program: Command): void {
  const links = program
    .command("setup-links")
    .description("Links de configuração (Embedded Signup) de um cliente");

  links
    .command("list")
    .description("Lista os setup links de um cliente (offset)")
    .requiredOption("--customer <id>", "id do cliente (obrigatório)")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.customers.listSetupLinks(opts.customer, {
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "STATUS", key: "status" },
        { header: "URL", key: "url", max: 60 },
        { header: "EXPIRA", key: "expires_at" },
      ]);
      printOffsetFooter(res.meta);
    });

  links
    .command("create")
    .description("Cria um setup link para um cliente")
    .requiredOption("--customer <id>", "id do cliente (obrigatório)")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.customers.createSetupLink(opts.customer);
      if (format === "json") return printJson(data);
      printLine("Setup link criado.");
      printDetail(data as unknown as Record<string, unknown>);
    });

  links
    .command("update <linkId>")
    .description("Atualiza um setup link (status / expiração)")
    .requiredOption("--customer <id>", "id do cliente (obrigatório)")
    .option("--status <status>", "novo status")
    .option("--expires-at <data>", "nova expiração (ISO 8601)")
    .action(async (linkId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const body: { status?: string; expires_at?: string } = {};
      if (opts.status !== undefined) body.status = opts.status;
      if (opts.expiresAt !== undefined) body.expires_at = opts.expiresAt;
      if (Object.keys(body).length === 0) {
        throw new Error("Informe ao menos --status ou --expires-at.");
      }
      const data = await client.customers.updateSetupLink(
        opts.customer,
        linkId,
        body,
      );
      if (format === "json") return printJson(data);
      printLine("Setup link atualizado.");
      printDetail(data as unknown as Record<string, unknown>);
    });
}
