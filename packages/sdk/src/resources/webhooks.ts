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
}

export interface UpdateWebhookParams {
  url?: string;
  events?: string[];
  active?: boolean;
  /**
   * Omitido = não mexe. `{ Authorization: string }` cria/substitui.
   * `{ Authorization: null }` remove o header.
   */
  headers?: { Authorization?: string | null };
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
