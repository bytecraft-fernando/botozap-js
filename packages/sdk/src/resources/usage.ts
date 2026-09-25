import type { BotoZap } from "../client.js";

/** Query de `GET /v1/usage/meta-costs`. */
export interface MetaCostsParams {
  /**
   * Recorta pelas WABAs de um Cliente da Conta; sem ele, a Conta inteira.
   * Cliente inexistente ou de outra Conta responde 404 `not_found`.
   */
  customer_id?: string;
  /** Primeiro dia (UTC, inclusivo, `YYYY-MM-DD`). Padrão: 29 dias antes de `to`. */
  from?: string;
  /** Último dia (UTC, inclusivo, `YYYY-MM-DD`). Padrão: hoje. Máximo de 366 dias no intervalo. */
  to?: string;
}

/** De onde vem `estimated_cost`: só Meta, só estimativa ou os dois. */
export type MetaCostSource = "meta" | "estimate" | "mixed";

/** Por que algum custo do recorte não está disponível. */
export type MetaCostUnavailableReason = "not_synced" | "cost_not_returned";

/**
 * Grupo agregado numa moeda. Moedas diferentes nunca são somadas nem
 * convertidas: cada moeda vira um grupo próprio.
 */
export interface MetaCostGroup {
  /** Moeda da WABA (ex.: "BRL"); `null` quando a Meta não informou. */
  currency: string | null;
  /** Mensagens cobráveis e grátis contadas pela Meta. */
  volume: number;
  /**
   * Custo APROXIMADO informado pela Meta. `null` se alguma linha do grupo
   * veio sem custo — ausência nunca vira 0. A fatura da Meta é a autoridade.
   */
  cost: number | null;
  /**
   * Custo da Meta onde houver + volume × tarifa publicada onde não houver.
   * `null` se alguma linha não tem custo nem tarifa conhecida.
   */
  estimated_cost: number | null;
  /** Origem de `estimated_cost`; `null` quando `estimated_cost` é `null`. */
  cost_source: MetaCostSource | null;
}

/** Grupo por dia (UTC) e moeda. */
export interface MetaCostDay extends MetaCostGroup {
  /** Dia UTC, `YYYY-MM-DD`. */
  day: string;
}

/** Grupo por categoria, tipo de preço e moeda. */
export interface MetaCostCategory extends MetaCostGroup {
  /** Categoria da Meta (ex.: "MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"). */
  pricing_category: string;
  /** Tipo de preço da Meta (ex.: "REGULAR", "FREE_CUSTOMER_SERVICE", "FREE_ENTRY_POINT"). */
  pricing_type: string;
}

/** Base usada em `estimated_cost`. */
export interface MetaCostEstimate {
  /**
   * `true` quando todo o recorte tem custo da Meta ou estimativa (nada
   * `null`) e todas as Conexões ativas foram sincronizadas.
   */
  available: boolean;
  basis: "published_rates" | (string & {});
  /** Mercado das tarifas usadas (destinatário). */
  market: "BR" | (string & {});
  /** Início de vigência das tarifas publicadas (`YYYY-MM-DD`). */
  rates_effective_from: string;
  /** Data em que as tarifas foram conferidas na fonte oficial. */
  rates_as_of: string;
  source_url: string;
  /** O que a estimativa não considera. */
  excludes: Array<"volume_tiers" | "non_brazil_recipients" | (string & {})>;
}

/** Frescor e cobertura do sync diário da Pricing Analytics. */
export interface MetaCostSync {
  /** Conexões ativas do escopo (as que o sync diário lê). */
  connections: number;
  synced_connections: number;
  /** Leitura completa mais antiga entre as WABAs sincronizadas (ISO 8601). */
  last_synced_at: string | null;
  /**
   * Primeiro dia com leitura da Meta em TODAS as Conexões sincronizadas.
   * Antes dele, ausência de linha não significa custo zero.
   */
  covered_from: string | null;
}

/** Resposta de `GET /v1/usage/meta-costs`. */
export interface MetaCostReport {
  /** Cliente do recorte; `null` quando a consulta cobre a Conta inteira. */
  customer_id: string | null;
  source: "meta_pricing_analytics" | (string & {});
  /** Sempre `true`: o custo é o aproximado que a Meta informa. */
  approximate: true;
  /** Dia inicial efetivamente consultado (`YYYY-MM-DD`). */
  from: string;
  /** Dia final efetivamente consultado (`YYYY-MM-DD`). */
  to: string;
  /** `true` quando algum custo do recorte não está disponível (ver `unavailable_reason`). */
  unavailable: boolean;
  unavailable_reason: MetaCostUnavailableReason | null;
  /** Um grupo por moeda. */
  totals: MetaCostGroup[];
  /** Ordenado por dia e moeda. */
  by_day: MetaCostDay[];
  /** Ordenado por volume decrescente. */
  by_category: MetaCostCategory[];
  estimate: MetaCostEstimate;
  sync: MetaCostSync;
}

/** Uso e custos da Conta. */
export class Usage {
  constructor(private readonly client: BotoZap) {}

  /**
   * Custo da Meta por dia, categoria e tipo, lido da Pricing Analytics
   * sincronizada uma vez por dia por WABA. Scope `customers:read`; o sandbox
   * fica de fora. Intervalo grande demais responde 422 `range_too_large`.
   */
  metaCosts(params: MetaCostsParams = {}): Promise<MetaCostReport> {
    return this.client.requestItem<MetaCostReport>("GET", "/usage/meta-costs", {
      query: {
        customer_id: params.customer_id,
        from: params.from,
        to: params.to,
      },
    });
  }
}
