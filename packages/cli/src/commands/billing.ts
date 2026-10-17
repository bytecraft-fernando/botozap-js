import { Command } from "commander";
import type { Billing, BusinessSlot } from "@botozap/sdk";
import { context } from "./shared.js";
import { dim, printDetail, printJson, printLine, printTable } from "../output.js";

const PLAN_LABEL: Record<string, string> = {
  paid: "pago",
  free: "Free",
  trial: "teste grátis",
  courtesy: "cortesia (sem cobrança)",
};

function reais(cents: unknown): string {
  return typeof cents === "number"
    ? `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`
    : "-";
}

function printSlots(slots: BusinessSlot[]): void {
  printTable(slots as unknown as Record<string, unknown>[], [
    { header: "ID", key: "id", max: 36 },
    {
      header: "CLIENTE",
      key: "customer_name",
      format: (_v, row) =>
        row.customer_id ? String(row.customer_name ?? row.customer_id) : "vazio",
    },
    { header: "VALOR", key: "amount_cents", format: reais },
    { header: "FATURA", key: "paid", format: (v) => (v ? "paga" : "em aberto") },
    { header: "VENCIMENTO", key: "next_due_date" },
    { header: "PAUSADO", key: "paused", format: (v) => (v ? "sim" : "não") },
    {
      header: "LINK DA FATURA",
      key: "invoice_url",
      max: 80,
      format: (v) => (typeof v === "string" ? v : "ainda não disponível"),
    },
  ]);
}

function printBilling(billing: Billing): void {
  printDetail({
    plano: PLAN_LABEL[billing.plan] ?? billing.plan,
    "negócios inclusos":
      billing.included_businesses === null ? "sem limite" : billing.included_businesses,
    ...(billing.legacy_extra_businesses > 0
      ? { "negócios extras (contrato antigo)": billing.legacy_extra_businesses }
      : {}),
    "valor do slot": `${reais(billing.slot_amount_cents)}/mês`,
    "pode comprar slot": billing.can_add_slot ? "sim" : "não",
  });
  printLine("");
  printSlots(billing.slots);
  if (billing.slots.some((s) => s.paused)) {
    printLine("");
    printLine(
      "Atenção: há negócio pausado porque a fatura do slot venceu há mais de 7 dias. Pagar libera na hora.",
    );
  }
}

export function registerBilling(program: Command): void {
  const billing = program
    .command("billing")
    .description("Plano da conta e slots adicionais (R$ 47/mês por negócio a mais)")
    .action(async (_opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.billing.get();
      if (format === "json") return printJson(data);
      printBilling(data);
    });

  const slots = billing
    .command("slots")
    .description("Comprar e cancelar slots adicionais");

  slots
    .command("create")
    .description(
      "Compra um slot vazio (gera cobrança de R$ 47/mês). Recusas: plan_required " +
        "(assine o plano), slot_limit (pague uma fatura em aberto), " +
        "billing_customer_required (fale com o suporte)",
    )
    .option(
      "--idempotency-key <chave>",
      "8 a 200 caracteres sem espaço; repetir com a mesma chave devolve o mesmo slot em vez de comprar outro",
    )
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.billing.slots.create({
        idempotencyKey: opts.idempotencyKey,
      });
      if (format === "json") return printJson(data);
      printLine("Slot comprado.");
      printDetail(data as unknown as Record<string, unknown>);
      if (data.invoice_url === null) {
        printLine(dim("A fatura chega em instantes; consulte com `botozap billing`."));
      }
    });

  slots
    .command("cancel <id>")
    .description(
      "Cancela um slot vazio, sem reembolso. Slot ocupado responde slot_in_use: desconecte o negócio antes",
    )
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await client.billing.slots.cancel(id);
      if (format === "json") return printJson({ canceled: true });
      printLine("Slot cancelado.");
    });
}
