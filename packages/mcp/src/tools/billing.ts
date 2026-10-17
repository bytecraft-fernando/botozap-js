/** Ferramentas de plano e slots adicionais (só chave de API). */
import { z } from "zod";
import { emptyOperationResult, type Register } from "../register.js";
import {
  billingResultSchema,
  businessSlotResultSchema,
  emptyOperationResultSchema,
} from "../schemas.js";

export function registerBillingTools(register: Register): void {
  register(
    "get_billing",
    "Mostra o plano da Conta e os slots adicionais. O plano pago inclui 1 negócio (included_businesses; null = sem limite) e cada negócio a mais ocupa um slot de R$ 47/mês, com assinatura própria. Para cada slot: Cliente que ocupa (customer_id null = slot vazio), se a fatura está paga, vencimento, link da fatura (invoice_url) e se o negócio está pausado (fatura vencida há mais de 7 dias; pagar libera na hora). can_add_slot diz se dá para comprar slot. Retorna { data }.",
    {},
    billingResultSchema,
    async (client) => ({ data: await client.billing.get() }),
  );

  register(
    "create_business_slot",
    "Compra um slot vazio para conectar mais um negócio. Gera cobrança de R$ 47/mês (assinatura própria): confirme com o usuário antes. Para repetir sem comprar outro, envie idempotency_key: a mesma chave devolve o mesmo slot. invoice_url pode vir null; a fatura chega em instantes em get_billing. Recusas: plan_required (Free ou teste grátis: assine o plano), slot_limit (já há 2 slots com fatura em aberto: pague uma antes), billing_customer_required (conta sem cadastro de cobrança: fale com o suporte). Retorna { data } com o slot.",
    {
      idempotency_key: z
        .string()
        .min(8)
        .max(200)
        .regex(/^[\x21-\x7E]+$/, "Use só caracteres ASCII, sem espaço.")
        .optional()
        .describe("Chave da compra (8 a 200 caracteres ASCII, sem espaço). Repetir com a mesma chave devolve o mesmo slot; sem ela, cada chamada compra um slot."),
    },
    businessSlotResultSchema,
    async (client, args) => ({
      data: await client.billing.slots.create({
        idempotencyKey: args.idempotency_key as string | undefined,
      }),
    }),
  );

  register(
    "cancel_business_slot",
    "Cancela um slot vazio. Não há reembolso do que já foi cobrado. Cancelar um slot que já estava cancelado também dá certo. Recusas: slot_in_use (o slot tem um negócio: desconecte o negócio antes), not_found (slot não existe nesta Conta). Retorna { success: true }.",
    {
      slot_id: z.string().uuid().describe("UUID do slot (veja get_billing)."),
    },
    emptyOperationResultSchema,
    async (client, args) => {
      await client.billing.slots.cancel(String(args.slot_id));
      return emptyOperationResult();
    },
  );
}
