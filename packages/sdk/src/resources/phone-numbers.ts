import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams, PhoneNumber } from "../types.js";

export interface ListPhoneNumbersParams extends OffsetParams {
  customer_id?: string;
}

/** Números conectados de cada cliente. */
export class PhoneNumbers {
  constructor(private readonly client: BotoZap) {}

  /** Lista os números da conta (paginação por offset/página). */
  list(params: ListPhoneNumbersParams = {}): Promise<OffsetList<PhoneNumber>> {
    return this.client.requestOffsetList<OffsetList<PhoneNumber>>(
      "GET",
      "/phone_numbers",
      {
        query: {
          page: params.page,
          per_page: params.per_page,
          customer_id: params.customer_id,
        },
      },
    );
  }

  get(id: string): Promise<PhoneNumber> {
    return this.client.requestItem<PhoneNumber>(
      "GET",
      `/phone_numbers/${enc(id)}`,
    );
  }

  // NOTA: `update` foi removido de propósito. A rota PATCH /v1/phone_numbers/:id
  // responde SEMPRE 422 `no_updatable_fields` — o schema atual só tem campos de
  // identidade e campos sincronizados da Meta, nenhum editável por aqui. Expor o
  // método só entregaria uma chamada garantidamente quebrada.

  /** Remove um número. Responde 204 (sem corpo). */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/phone_numbers/${enc(id)}`);
  }

  /** Saúde do número (qualidade, limite, status na Meta). */
  health(id: string): Promise<Record<string, unknown>> {
    return this.client.requestItem<Record<string, unknown>>(
      "GET",
      `/phone_numbers/${enc(id)}/health`,
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
