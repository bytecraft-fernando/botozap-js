import { Command } from "commander";
import type { MetaCostReport } from "@botozap/sdk";
import { context } from "./shared.js";
import { dim, printJson, printLine, printTable } from "../output.js";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function day(value: string | undefined, flag: string): string | undefined {
  if (value === undefined) return undefined;
  if (!DAY_RE.test(value)) throw new Error(`${flag} deve estar no formato YYYY-MM-DD.`);
  return value;
}

/** Custo ausente é "indisponível", nunca 0. */
function money(value: unknown): string {
  return typeof value === "number" ? value.toFixed(4) : "indisponível";
}

const UNAVAILABLE_REASON: Record<string, string> = {
  not_synced: "há Conexão ativa ainda sem leitura completa da Meta",
  cost_not_returned: "a Meta não devolveu o custo de parte do recorte",
};

function printMetaCosts(report: MetaCostReport): void {
  printLine(
    `Custo aproximado da Meta de ${report.from} a ${report.to}` +
      (report.customer_id ? ` (cliente ${report.customer_id})` : " (conta inteira)"),
  );
  printTable(report.totals as unknown as Record<string, unknown>[], [
    { header: "MOEDA", key: "currency" },
    { header: "VOLUME", key: "volume" },
    { header: "CUSTO META", key: "cost", format: money },
    { header: "ESTIMADO", key: "estimated_cost", format: money },
    { header: "FONTE", key: "cost_source" },
  ]);
  if (report.by_category.length > 0) {
    printLine("");
    printTable(report.by_category as unknown as Record<string, unknown>[], [
      { header: "CATEGORIA", key: "pricing_category" },
      { header: "TIPO", key: "pricing_type" },
      { header: "MOEDA", key: "currency" },
      { header: "VOLUME", key: "volume" },
      { header: "CUSTO META", key: "cost", format: money },
      { header: "ESTIMADO", key: "estimated_cost", format: money },
    ]);
  }
  printLine("");
  if (report.unavailable) {
    const reason = report.unavailable_reason
      ? UNAVAILABLE_REASON[report.unavailable_reason] ?? report.unavailable_reason
      : "motivo não informado";
    printLine(`Atenção: custo parcialmente indisponível — ${reason}.`);
  }
  printLine(
    dim(
      `Sincronizadas ${report.sync.synced_connections}/${report.sync.connections} conexões` +
        (report.sync.last_synced_at ? `; última leitura ${report.sync.last_synced_at}` : "") +
        (report.sync.covered_from ? `; coberto desde ${report.sync.covered_from}` : "") +
        ". Valores aproximados; a fatura da Meta é a autoridade. Use -o json para o detalhe por dia.",
    ),
  );
}

export function registerUsage(program: Command): void {
  const usage = program.command("usage").description("Uso e custos da conta");

  usage
    .command("meta-costs")
    .description("Custo aproximado da Meta por moeda e categoria (Pricing Analytics)")
    .option("--customer-id <id>", "recorta pelas WABAs de um cliente (padrão: conta inteira)")
    .option("--from <YYYY-MM-DD>", "primeiro dia UTC, inclusivo (padrão: 29 dias antes de --to)")
    .option("--to <YYYY-MM-DD>", "último dia UTC, inclusivo (padrão: hoje; máximo 366 dias)")
    .action(async (opts, cmd: Command) => {
      const from = day(opts.from, "--from");
      const to = day(opts.to, "--to");
      const { client, format } = context(cmd);
      const report = await client.usage.metaCosts({
        customer_id: opts.customerId,
        from,
        to,
      });
      if (format === "json") return printJson(report);
      printMetaCosts(report);
    });
}
