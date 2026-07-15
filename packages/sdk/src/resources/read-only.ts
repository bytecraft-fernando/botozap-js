import type { BotoZap } from "../client.js";
import type {
  ApiLog,
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
  /** delivery_status (pending|success|failed|exhausted). */
  status?: string;
  /** Tipo do evento (ex.: "webhook.test", "messages"). */
  event_type?: string;
}

/** Histórico de entregas de webhook (somente leitura, paginação por cursor). */
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
        },
      },
    );
  }
}
