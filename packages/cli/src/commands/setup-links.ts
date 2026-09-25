import { Command } from "commander";
import type { CreateSetupLinkParams } from "@botozap/sdk";
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
    .description("Cria um setup link para um cliente (expira em 30 dias)")
    .requiredOption("--customer <id>", "id do cliente (obrigatório)")
    .option(
      "--connection-types <lista>",
      "dedicated e/ou coexistence, separados por vírgula (padrão: dedicated)",
    )
    .option("--language <código>", "idioma da página (ex.: pt_BR); auto = automático")
    .option(
      "--success-redirect-url <url>",
      "destino ao concluir; recebe setup_link_id e status=completed",
    )
    .option(
      "--failure-redirect-url <url>",
      "destino com status=failed (link esgotado) ou status=cancelled (cliente voltou; link segue válido)",
    )
    .addHelpText(
      "after",
      `
Redirecionamentos (só em estado final do link):
  concluído                        -> success_redirect_url, status=completed
  link esgotado sem concluir       -> failure_redirect_url, status=failed
  cliente volta (erro recuperável) -> failure_redirect_url, status=cancelled
                                      (o link segue válido)
Todo destino recebe também setup_link_id; a query da sua URL é preservada e o
token do link nunca é enviado. Link expirado ou revogado não redireciona. As URLs
precisam ser https, sem usuário/senha e com até 2048 caracteres (senão a API
responde 422 invalid_redirect_url).`,
    )
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const params: CreateSetupLinkParams = {};
      if (opts.connectionTypes !== undefined) {
        params.allowed_connection_types = String(opts.connectionTypes)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      if (opts.language !== undefined) params.language = opts.language;
      if (opts.successRedirectUrl !== undefined) {
        params.success_redirect_url = opts.successRedirectUrl;
      }
      if (opts.failureRedirectUrl !== undefined) {
        params.failure_redirect_url = opts.failureRedirectUrl;
      }
      const data = await client.customers.createSetupLink(opts.customer, params);
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
