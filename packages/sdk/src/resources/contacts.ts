import type { BotoZap } from "../client.js";
import type {
  Consent,
  ConsentChannel,
  ConsentPurpose,
  ConsentState,
  Contact,
  ContactConsents,
  CursorList,
  CursorParams,
} from "../types.js";

export interface ListContactsParams extends CursorParams {
  /** Só valores conhecidos; null não casa nem com false. */
  ig_follows_business?: boolean;
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

/** Consentimento inicial de `contacts.create` (campo `consents`). */
export interface InitialConsent {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  state: ConsentState;
  /** Texto livre de evidência (até 500 caracteres). */
  evidence?: string;
}

/** Corpo de `contacts.recordConsent` (`POST /v1/contacts/{id}/consents`). */
export interface RecordConsentParams {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  state: ConsentState;
  /** Texto livre de evidência (até 500 caracteres). */
  evidence?: string;
}

export interface CreateContactParams {
  /** wa_id canônico (BSUID "BR.1A2B…" ou dígitos E.164). */
  wa_id: string;
  phone_number_id?: string;
  /**
   * Nome que a empresa dá ao Contato (1–200 caracteres após aparar). `null`
   * ou `""` não grava nome. Independe de `profile_name`, que vem do canal.
   */
  display_name?: string | null;
  /** Até 20 tags de 1–40 caracteres; o servidor apara e remove repetidas sem diferenciar maiúsculas. Não combine com metadata.tags. */
  tags?: string[];
  /**
   * Consentimentos iniciais, gravados junto com o contato numa transação só. Se
   * o contato já recusou (foi excluído depois de recusar e voltou), o aceite não
   * é gravado, o contato nasce como Recusou e a resposta traz `warnings` com
   * `consent_opted_out`.
   */
  consents?: InitialConsent[];
  [key: string]: unknown;
}

/**
 * Campos do PATCH. `tags` substitui a lista inteira; `add_tags`/`remove_tags`
 * alteram a lista atual sem perder escrita concorrente. Não combine `tags` com
 * `add_tags`/`remove_tags`, nem com `metadata.tags` (422 invalid_tags).
 */
export interface UpdateContactParams {
  profile_name?: string;
  /**
   * Nome que a empresa dá ao Contato (1–200 caracteres após aparar); `null`
   * ou `""` limpa. A ingestão de mensagens nunca o sobrescreve.
   */
  display_name?: string | null;
  username?: string;
  notes?: string | null;
  stage_id?: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
  add_tags?: string[];
  remove_tags?: string[];
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
        ig_follows_business: params.ig_follows_business === undefined ? undefined : String(params.ig_follows_business),
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

  /**
   * Cria um contato. A resposta (201) pode trazer `warnings` por canal e
   * finalidade: `consent_opted_out` (o contato já recusou; o aceite pedido em
   * `consents` não foi gravado) ou `consent_unconfirmed` (não foi possível
   * confirmar o consentimento vigente).
   */
  create(params: CreateContactParams): Promise<Contact> {
    return this.client.requestItem<Contact>("POST", "/contacts", {
      body: params,
    });
  }

  update(
    id: string,
    params: UpdateContactParams | Record<string, unknown>,
  ): Promise<Contact> {
    return this.client.requestItem<Contact>("PATCH", `/contacts/${enc(id)}`, {
      body: params,
    });
  }

  /**
   * Remove um contato e o que é dele (conversas, mensagens, CRM, compromissos e
   * Consentimentos); a mídia dele é apagada. A recusa não se perde: fica guardada
   * como código cifrado (hash) na lista de recusa da Conta e vale se o contato
   * voltar, que nasce como Recusou. Responde 204 (sem corpo).
   */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/contacts/${enc(id)}`);
  }

  /**
   * Consentimentos do contato: `current` (o vigente por canal e finalidade) e
   * `history` (todos, do mais novo ao mais antigo). Scope `contacts:read`.
   */
  listConsents(id: string): Promise<ContactConsents> {
    return this.client.requestItem<ContactConsents>(
      "GET",
      `/contacts/${enc(id)}/consents`,
    );
  }

  /**
   * Registra um Consentimento do contato (origem `api`). Scope `contacts:write`.
   * Sobre uma recusa do próprio contato responde `409 consent_opted_out` e nada é
   * gravado: só ele volta a aceitar (botão do pedido de consentimento ou Palavra
   * de volta). Para recusar, registre `state: "revoked"`.
   */
  recordConsent(id: string, params: RecordConsentParams): Promise<Consent> {
    return this.client.requestItem<Consent>(
      "POST",
      `/contacts/${enc(id)}/consents`,
      { body: params },
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
