import type { BotoZap } from "../client.js";
import type { CursorList, CursorParams, Webhook } from "../types.js";

/** Header extra aceito no endpoint. Só `Authorization`; o valor nunca volta na resposta. */
export interface WebhookAuthorizationHeaders {
  Authorization: string;
}

export interface CreateWebhookParams {
  url: string;
  events?: string[];
  active?: boolean;
  secret?: string;
  /** `{ Authorization: "Bearer …" }` — persistido no Vault; ausente na resposta. */
  headers?: WebhookAuthorizationHeaders;
  /**
   * Limita as entregas a um Cliente (UUID) da Conta da chave. Omitido, `null`
   * ou vazio = sem filtro. UUID inválido → 422 `invalid_customer_id`; Cliente
   * de outra Conta → 404 `customer_not_found`.
   */
  customer_id?: string | null;
  /**
   * Limita as entregas a estes canais (1 a 100 ids de `channelAccounts.list`).
   * Omitido ou `null` = todos os canais da Conta. Id malformado → 422
   * `invalid_channel_account_ids`; canal de outra Conta → 404
   * `channel_account_not_found`.
   */
  channel_account_ids?: string[] | null;
}

export interface UpdateWebhookParams {
  /**
   * Rotaciona o secret de assinatura (16 a 256 caracteres, sem quebra de
   * linha). Vale a partir da próxima tentativa de entrega; a resposta não
   * devolve o valor. Formato inválido responde `422 invalid_secret`.
   */
  secret?: string;
  url?: string;
  events?: string[];
  active?: boolean;
  /**
   * Omitido = não mexe. `{ Authorization: string }` cria/substitui.
   * `{ Authorization: null }` remove o header.
   */
  headers?: { Authorization?: string | null };
  /**
   * Omitido = não mexe. UUID de um Cliente da Conta limita as entregas a ele;
   * `null` (ou string vazia) remove o filtro sem invalidar a verificação.
   */
  customer_id?: string | null;
  /**
   * Omitido = não mexe. `null` volta a receber de todos os canais; um array
   * (1 a 100 ids) limita as entregas a esses canais.
   */
  channel_account_ids?: string[] | null;
}

/** Webhooks: endpoints assinados que recebem os eventos da conta. */
export class Webhooks {
  constructor(private readonly client: BotoZap) {}

  /** Lista os endpoints de webhook da conta (paginação por cursor). */
  list(params: CursorParams = {}): Promise<CursorList<Webhook>> {
    return this.client.requestCursorList<CursorList<Webhook>>("GET", "/webhooks", {
      query: {
        limit: params.limit,
        after: params.after,
        before: params.before,
      },
    });
  }

  get(id: string): Promise<Webhook> {
    return this.client.requestItem<Webhook>("GET", `/webhooks/${enc(id)}`);
  }

  create(params: CreateWebhookParams): Promise<Webhook> {
    return this.client.requestItem<Webhook>("POST", "/webhooks", {
      body: params,
    });
  }

  update(id: string, params: UpdateWebhookParams): Promise<Webhook> {
    return this.client.requestItem<Webhook>("PATCH", `/webhooks/${enc(id)}`, {
      body: params,
    });
  }

  /** Remove um endpoint. Responde 204 (sem corpo). */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/webhooks/${enc(id)}`);
  }

  /** Dispara um evento de teste para o endpoint. */
  test(id: string): Promise<{ success: boolean }> {
    return this.client.requestItem<{ success: boolean }>(
      "POST",
      `/webhooks/${enc(id)}/test`,
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
