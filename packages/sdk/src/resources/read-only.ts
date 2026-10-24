import type { BotoZap } from "../client.js";
import type {
  ApiLog,
  WebhookDeliveryStatus,
  CursorList,
  CursorParams,
  OffsetList,
  OffsetParams,
  User,
  WebhookDelivery,
} from "../types.js";

/** Membros da conta (somente leitura via API). */
export class Users {
  constructor(private readonly client: BotoZap) {}

  /** Lista os membros da conta (paginação por offset/página). */
  list(params: OffsetParams = {}): Promise<OffsetList<User>> {
    return this.client.requestOffsetList<OffsetList<User>>("GET", "/users", {
      query: { page: params.page, per_page: params.per_page },
    });
  }
}

export interface ListApiLogsParams extends CursorParams {
  /** Origem do log (ex.: "api"). */
  source?: string;
  /** Método HTTP (a rota normaliza para maiúsculas). */
  method?: string;
  /** Código HTTP exato (inteiro). */
  status_code?: number;
}

/** Logs de requisições à API (somente leitura, paginação por cursor). */
export class ApiLogs {
  constructor(private readonly client: BotoZap) {}

  list(params: ListApiLogsParams = {}): Promise<CursorList<ApiLog>> {
    return this.client.requestCursorList<CursorList<ApiLog>>("GET", "/api_logs", {
      query: {
        limit: params.limit,
        after: params.after,
        before: params.before,
        source: params.source,
        method: params.method,
        status_code: params.status_code,
      },
    });
  }
}

export interface ListWebhookDeliveriesParams extends CursorParams {
  /** Alias de `endpoint_id` na rota — entregas de um endpoint específico. */
  webhook_id?: string;
  /** delivery_status (pending|success|failed|exhausted|limited). */
  status?: WebhookDeliveryStatus | (string & {});
  /** Tipo do evento (ex.: "webhook.test", "messages"). */
  event_type?: string;
  /** Canal da entrega (`channel_account_id`); `"none"` = sem canal (teste, eventos da WABA). */
  channel_account_id?: string;
}

/** Resultado de `webhookDeliveries.replay`: a entrega voltou para a fila. */
export interface WebhookDeliveryReplay {
  id: string;
  status: "pending";
  replayed: true;
}

/**
 * Histórico de Entregas de webhook e reenvio das esgotadas. Única escrita deste
 * arquivo; `users` e `apiLogs` seguem só leitura.
 */
export class WebhookDeliveries {
  constructor(private readonly client: BotoZap) {}

  list(
    params: ListWebhookDeliveriesParams = {},
  ): Promise<CursorList<WebhookDelivery>> {
    return this.client.requestCursorList<CursorList<WebhookDelivery>>(
      "GET",
      "/webhook_deliveries",
      {
        query: {
          limit: params.limit,
          after: params.after,
          before: params.before,
          webhook_id: params.webhook_id,
          status: params.status,
          event_type: params.event_type,
          channel_account_id: params.channel_account_id,
        },
      },
    );
  }

  /**
   * Reenvia uma entrega esgotada (`exhausted`) ou cortada pelo limite de repasse
   * (`limited`): ela volta para a fila e o evento sai de novo com a mesma
   * `X-Idempotency-Key`, como o botão Reenviar do painel. Repetir não duplica: a
   * entrega já na fila responde 409 `delivery_not_replayable`. Outras recusas:
   * 404 `not_found`, 409 `forward_limit_reached` (limite de repasse do mês
   * acabou) e 429 `replay_rate_limited`. Exige o escopo `webhooks:write`.
   */
  replay(id: string): Promise<WebhookDeliveryReplay> {
    return this.client.requestItem<WebhookDeliveryReplay>(
      "POST",
      `/webhook_deliveries/${encodeURIComponent(id)}/replay`,
    );
  }
}
