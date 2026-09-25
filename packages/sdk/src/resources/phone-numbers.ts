import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams, PhoneNumber } from "../types.js";

export interface ListPhoneNumbersParams extends OffsetParams {
  customer_id?: string;
}

/** Corpo de `PATCH /v1/phone_numbers/:id`. */
export interface UpdatePhoneNumberParams {
  /**
   * Nome local do Número: até 100 caracteres após aparar, sem quebras de
   * linha nem caracteres de controle. `null` ou `""` limpa.
   */
  label: string | null;
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

  /**
   * Atualiza o nome local (`label`) do Número. É o único campo editável:
   * identidade e dados sincronizados da Meta (`display_phone_number`,
   * `verified_name`, `quality_rating`) não mudam por aqui. `{id}` aceita o
   * UUID interno ou o `phone_number_id` da Meta.
   */
  update(id: string, params: UpdatePhoneNumberParams): Promise<PhoneNumber> {
    return this.client.requestItem<PhoneNumber>(
      "PATCH",
      `/phone_numbers/${enc(id)}`,
      { body: { label: params.label } },
    );
  }

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
