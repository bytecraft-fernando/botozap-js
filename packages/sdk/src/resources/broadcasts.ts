import type { BotoZap } from "../client.js";
import type {
  Broadcast,
  BroadcastRecipient,
  CursorList,
  CursorParams,
  OffsetList,
  OffsetParams,
} from "../types.js";

export interface ListBroadcastsParams extends OffsetParams {
  status?: string;
  customer_id?: string;
  phone_number_id?: string;
}

/**
 * Corpo de `POST /v1/broadcasts` — espelha o contrato real da rota. A origem é
 * `phone_number_id` OU `waba_connection_id` (um dos dois obrigatório);
 * `template_name` + `template_language` são obrigatórios. A conta vem da chave,
 * nunca do corpo. (A rota NÃO aceita `customer_id` nem um objeto `template`.)
 */
export interface CreateBroadcastParams {
  name?: string;
  /** phone_number_id (Meta) do número de origem. */
  phone_number_id?: string;
  /** Alternativa a `phone_number_id`: a conexão WABA de origem. */
  waba_connection_id?: string;
  /** Nome do template aprovado (obrigatório). */
  template_name: string;
  /** Código de idioma do template, ex.: "pt_BR" (obrigatório). */
  template_language: string;
  /** Opcional: id interno do template (revalidado por ownership/conexão). */
  template_id?: string;
}

/** Transição de estado via `PATCH /v1/broadcasts/:id`. */
export interface UpdateBroadcastParams {
  /** `stopped` interrompe (sending/scheduled); `draft` cancela um agendamento. */
  status: "stopped" | "draft";
}

export interface ScheduleBroadcastParams {
  /** Data/hora ISO 8601. */
  scheduled_at: string;
  [key: string]: unknown;
}

/** Filtros de `listRecipients` (paginação por cursor + filtro de status). */
export interface ListRecipientsParams extends CursorParams {
  /** Filtra por status do destinatário (ex.: "pending", "sent", "failed"). */
  status?: string;
}

/** Resultado de `addRecipients`: quantos entraram, quantos eram duplicados, erros. */
export interface AddRecipientsResult {
  added: number;
  duplicates: number;
  errors: unknown[];
}

/** Transmissões: criar, adicionar destinatários, agendar/enviar/cancelar. */
export class Broadcasts {
  constructor(private readonly client: BotoZap) {}

  /** Lista as transmissões da conta (paginação por offset/página). */
  list(params: ListBroadcastsParams = {}): Promise<OffsetList<Broadcast>> {
    return this.client.requestOffsetList<OffsetList<Broadcast>>("GET", "/broadcasts", {
      query: {
        page: params.page,
        per_page: params.per_page,
        status: params.status,
        customer_id: params.customer_id,
        phone_number_id: params.phone_number_id,
      },
    });
  }

  get(id: string): Promise<Broadcast> {
    return this.client.requestItem<Broadcast>("GET", `/broadcasts/${enc(id)}`);
  }

  create(params: CreateBroadcastParams): Promise<Broadcast> {
    return this.client.requestItem<Broadcast>("POST", "/broadcasts", {
      body: params,
    });
  }

  update(id: string, params: UpdateBroadcastParams): Promise<Broadcast> {
    return this.client.requestItem<Broadcast>(
      "PATCH",
      `/broadcasts/${enc(id)}`,
      { body: params },
    );
  }

  /** Lista os destinatários de uma transmissão (paginação por cursor). */
  listRecipients(
    id: string,
    params: ListRecipientsParams = {},
  ): Promise<CursorList<BroadcastRecipient>> {
    return this.client.requestCursorList<CursorList<BroadcastRecipient>>(
      "GET",
      `/broadcasts/${enc(id)}/recipients`,
      {
        query: {
          limit: params.limit,
          after: params.after,
          before: params.before,
          status: params.status,
        },
      },
    );
  }

  /** Adiciona destinatários (lista de números ou contatos). */
  addRecipients(id: string, recipients: unknown[]): Promise<AddRecipientsResult> {
    return this.client.requestItem<AddRecipientsResult>(
      "POST",
      `/broadcasts/${enc(id)}/recipients`,
      { body: { recipients } },
    );
  }

  /** Remove TODOS os destinatários. Responde 204 (sem corpo). */
  removeRecipients(id: string): Promise<void> {
    return this.client.request<void>(
      "DELETE",
      `/broadcasts/${enc(id)}/recipients`,
    );
  }

  schedule(id: string, params: ScheduleBroadcastParams): Promise<Broadcast> {
    return this.client.requestItem<Broadcast>(
      "POST",
      `/broadcasts/${enc(id)}/schedule`,
      { body: params },
    );
  }

  send(id: string): Promise<Broadcast> {
    return this.client.requestItem<Broadcast>(
      "POST",
      `/broadcasts/${enc(id)}/send`,
    );
  }

  cancel(id: string): Promise<Broadcast> {
    return this.client.requestItem<Broadcast>(
      "POST",
      `/broadcasts/${enc(id)}/cancel`,
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
