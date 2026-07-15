import type { BotoZap } from "../client.js";
import type { Contact, CursorList, CursorParams } from "../types.js";

export interface ListContactsParams extends CursorParams {
  /** Filtra pelos números do cliente (derivado da conexão do número). */
  customer_id?: string;
  /**
   * Nesta base todo contato pertence a um cliente; `false` nunca casa (página
   * vazia), `true` é no-op.
   */
  has_customer?: boolean;
  /** Busca parcial (ilike) no nome de perfil. */
  profile_name_contains?: string;
  /** Busca parcial (ilike) no wa_id. */
  wa_id_contains?: string;
  /** Criados em ou após esta data (ISO 8601). */
  created_after?: string;
  /** Criados em ou antes desta data (ISO 8601). */
  created_before?: string;
}

export interface CreateContactParams {
  /** wa_id canônico (BSUID "BR.1A2B…" ou dígitos E.164). */
  wa_id: string;
  phone_number_id?: string;
  [key: string]: unknown;
}

/** Contatos: listar, buscar, criar, atualizar, remover. */
export class Contacts {
  constructor(private readonly client: BotoZap) {}

  /** Lista os contatos da conta (paginação por cursor). */
  list(params: ListContactsParams = {}): Promise<CursorList<Contact>> {
    return this.client.requestCursorList<CursorList<Contact>>("GET", "/contacts", {
      query: {
        limit: params.limit,
        after: params.after,
        before: params.before,
        customer_id: params.customer_id,
        has_customer:
          params.has_customer === undefined
            ? undefined
            : String(params.has_customer),
        profile_name_contains: params.profile_name_contains,
        wa_id_contains: params.wa_id_contains,
        created_after: params.created_after,
        created_before: params.created_before,
      },
    });
  }

  get(id: string): Promise<Contact> {
    return this.client.requestItem<Contact>("GET", `/contacts/${enc(id)}`);
  }

  create(params: CreateContactParams): Promise<Contact> {
    return this.client.requestItem<Contact>("POST", "/contacts", {
      body: params,
    });
  }

  update(id: string, params: Record<string, unknown>): Promise<Contact> {
    return this.client.requestItem<Contact>("PATCH", `/contacts/${enc(id)}`, {
      body: params,
    });
  }

  /** Remove um contato. Responde 204 (sem corpo). */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/contacts/${enc(id)}`);
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
