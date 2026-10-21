import type { BotoZap } from "../client.js";

/**
 * Plano da Conta: `paid` (plano pago), `free`, `trial` (teste grátis) ou
 * `courtesy` (conta cortesia ou interna, sem cobrança). Valores novos podem surgir.
 */
export type BillingPlan = "paid" | "free" | "trial" | "courtesy" | (string & {});

/**
 * Slot adicional: cada negócio além do que o plano inclui ocupa um slot com
 * assinatura própria (R$ 47/mês).
 */
export interface BusinessSlot {
  id: string;
  /** `open` (ativo) ou `canceled`. */
  status: "open" | "canceled" | (string & {});
  /** Cliente que ocupa o slot; `null` quando o slot está vazio. */
  customer_id: string | null;
  customer_name: string | null;
  /** Valor mensal em centavos (4700). */
  amount_cents: number;
  /** `true` quando a fatura atual do slot está paga. */
  paid: boolean;
  /** Vencimento em aberto (`YYYY-MM-DD`). */
  next_due_date: string;
  /** Link da fatura; `null` enquanto ainda não está disponível. */
  invoice_url: string | null;
  /**
   * `true` quando o negócio que ocupa o slot está pausado porque a fatura
   * venceu há mais de 7 dias. Pagar libera na hora.
   */
  paused: boolean;
  /** ISO 8601. */
  created_at: string;
}

/**
 * Garantia de 7 dias: enquanto ela vale, cancelar devolve a primeira
 * mensalidade integral.
 */
export interface BillingGuarantee {
  /** Ciclo da assinatura: `monthly` ou `annual`. */
  term: "monthly" | "annual";
  /** Valor devolvido no cancelamento, em centavos. */
  amount_cents: number;
  /** Prazo final da garantia (ISO 8601). */
  deadline: string;
}

/** Resposta de `GET /v1/billing`: plano da Conta e slots adicionais. */
export interface Billing {
  plan: BillingPlan;
  /** Negócios incluídos no plano; `null` = sem limite. */
  included_businesses: number | null;
  /** Negócios extras do contrato antigo (não usam slot). */
  legacy_extra_businesses: number;
  /** Valor de cada slot em centavos (4700). */
  slot_amount_cents: number;
  /** `true` quando dá para comprar slot (plano pago com cadastro de cobrança). */
  can_add_slot: boolean;
  /** Slots ativos, dos mais antigos aos mais novos. */
  slots: BusinessSlot[];
  /**
   * Garantia de 7 dias: presente enquanto o cancelamento ainda devolve a
   * primeira mensalidade integral; `null` quando não há direito. Ausente em
   * servidores antigos.
   */
  guarantee?: BillingGuarantee | null | undefined;
}

/** Opções de {@link BillingSlots.create}. */
export interface CreateBusinessSlotOptions {
  /**
   * Chave da compra (8 a 200 caracteres ASCII, sem espaço). Repetir com a
   * mesma chave devolve o mesmo slot em vez de comprar outro. Sem ela, cada
   * chamada compra um slot.
   */
  idempotencyKey?: string;
}

function enc(id: string): string {
  return encodeURIComponent(id);
}

/** Slots adicionais (`/v1/billing/slots`). */
export class BillingSlots {
  constructor(private readonly client: BotoZap) {}

  /**
   * Compra um slot vazio: gera cobrança de R$ 47/mês. Scope `billing:write`.
   * `invoice_url` pode vir `null`; a fatura chega em instantes em
   * {@link BillingResource.get}. Recusas: 402 `plan_required` (Free ou teste: assine o
   * plano), 402 `slot_limit` (já há 2 slots com fatura em aberto: pague uma),
   * 402 `billing_customer_required` (conta sem cadastro de cobrança: fale com o
   * suporte), 422 `invalid_idempotency_key`.
   */
  create(options: CreateBusinessSlotOptions = {}): Promise<BusinessSlot> {
    return this.client.requestItem<BusinessSlot>("POST", "/billing/slots", {
      idempotencyKey: options.idempotencyKey,
    });
  }

  /**
   * Cancela um slot vazio, sem reembolso. Responde 204, também quando o slot
   * já estava cancelado. Slot ocupado responde 409 `slot_in_use`: desconecte o
   * negócio antes. Scope `billing:write`.
   */
  cancel(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/billing/slots/${enc(id)}`);
  }
}

/** Plano da Conta e slots adicionais (`/v1/billing`). Só chave de API. */
export class BillingResource {
  readonly slots: BillingSlots;

  constructor(private readonly client: BotoZap) {
    this.slots = new BillingSlots(client);
  }

  /** Plano, negócios incluídos e slots ativos. Scope `billing:read`. */
  get(): Promise<Billing> {
    return this.client.requestItem<Billing>("GET", "/billing");
  }
}
