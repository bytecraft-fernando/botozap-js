import { Command, Option } from "commander";
import type { AccountExport } from "@botozap/sdk";
import { context } from "./shared.js";
import { printDetail, printJson, printLine, printTable } from "../output.js";

function scopeLabel(exp: AccountExport): string {
  return exp.scope.type === "customer"
    ? `Cliente ${exp.scope.customer_name ?? exp.scope.customer_id}`
    : "Conta inteira";
}

export function registerExports(program: Command): void {
  const exports = program
    .command("exports")
    .description("Exportação de dados da Conta (scopes exports:read e exports:write)");

  exports
    .command("create")
    .description(
      "Pede a exportação da Conta inteira ou de um Cliente. O arquivo é gerado em fila, fica 7 dias e vem num zip " +
        "com um arquivo por tipo. Pedido igual enquanto o anterior está na fila devolve o mesmo",
    )
    .option("--customer-id <id>", "exporta só este Cliente (padrão: a Conta inteira)")
    .addOption(new Option("--format <formato>", "json | csv").choices(["json", "csv"]).default("json"))
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.exports.create({
        ...(opts.customerId ? { customer_id: opts.customerId as string } : {}),
        format: opts.format,
      });
      if (format === "json") return printJson(data);
      printLine("Exportação pedida. Acompanhe com `botozap exports get <id>`.");
      printDetail({ id: data.id, status: data.status, formato: data.format, abrangência: scopeLabel(data) });
    });

  exports
    .command("list")
    .description("Últimos pedidos de exportação (até 50), do mais novo ao mais antigo")
    .action(async (_opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.exports.list();
      if (format === "json") return printJson(data);
      printTable(data as unknown as Record<string, unknown>[], [
        { header: "ID", key: "id", max: 36 },
        { header: "STATUS", key: "status" },
        { header: "FORMATO", key: "format" },
        { header: "ABRANGÊNCIA", key: "scope", format: (_v, row) => scopeLabel(row as unknown as AccountExport) },
        { header: "PEDIDO EM", key: "created_at" },
        { header: "EXPIRA EM", key: "expires_at" },
      ]);
    });

  exports
    .command("get <id>")
    .description("Estado do pedido e, quando pronto, o link de download (vale poucos minutos; cada consulta gera outro)")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.exports.get(id);
      if (format === "json") return printJson(data);
      printDetail({
        id: data.id,
        status: data.status,
        formato: data.format,
        abrangência: scopeLabel(data),
        "pedido por": `${data.requested_by} (${data.requested_via})`,
        "pedido em": data.created_at,
        "terminou em": data.finished_at,
        "expira em": data.expires_at,
        tamanho: data.size_bytes,
        registros: data.counts,
        erro: data.error ? `${data.error.code}: ${data.error.message}` : null,
        download: data.download ? `${data.download.url} (vale ${data.download.expires_in}s)` : null,
      });
    });
}
