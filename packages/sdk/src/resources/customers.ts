import type { BotoZap } from "../client.js";
import type {
  Customer,
  OffsetList,
  OffsetParams,
  SetupLink,
} from "../types.js";

export interface CreateCustomerParams {
  name: string;
  /** Referência do cliente no seu sistema (único por conta). */
  external_customer_id?: string;
  [key: string]: unknown;
}

/** Campos editáveis de um cliente (`PATCH /v1/customers/:id`). */
export interface UpdateCustomerParams {
  name?: string;
  external_customer_id?: string;
}

/**
 * Corpo de `POST /v1/customers/:id/setup_links`.
 *
 * Redirecionamentos: acontecem na página de conexão, só em estado final do
 * link. Conexão concluída leva a `success_redirect_url` com
 * `?setup_link_id=<id>&status=completed` (confirme o número em
 * `phoneNumbers.list`: uma conexão concluída ainda pode ter pendência de
 * registro). Link esgotado sem concluir leva a `failure_redirect_url` com
 * `status=failed`. Num erro em que dá para tentar de novo, o Cliente pode
 * escolher voltar: vai para `failure_redirect_url` com `status=cancelled` e o
 * link continua válido. A query string que a sua URL já tiver é preservada e o
 * token do link nunca é enviado. Link expirado ou revogado mostra a página de
 * erro, sem redirecionar.
 */
export interface CreateSetupLinkParams {
  /**
   * Tipos de conexão liberados: "dedicated" e/ou "coexistence" (padrão
   * "dedicated"). Uma lista sem nenhum tipo válido responde
   * `422 invalid_connection_types`; tipos desconhecidos ao lado de válidos são
   * ignorados.
   */
  allowed_connection_types?: string[];
  /** Código de idioma da página (ex.: "pt_BR"); "auto" ou vazio deixa automático. */
  language?: string;
  /**
   * Destino depois de concluir (`status=completed`). Precisa ser `https://`,
   * sem usuário/senha e com até 2048 caracteres; senão a API responde
   * `422 invalid_redirect_url`.
   */
  success_redirect_url?: string;
  /**
   * Destino quando o link se esgota sem concluir (`status=failed`) ou quando o
   * Cliente escolhe voltar num erro recuperável (`status=cancelled`; o link
   * segue válido). Mesmas regras de `success_redirect_url`.
   */
  failure_redirect_url?: string;
}

/** Corpo de `PATCH /v1/customers/:id/setup_links/:linkId`. */
export interface UpdateSetupLinkParams {
  /** "active" | "expired" | "revoked" (a rota rejeita outros valores). */
  status?: string;
  /** Nova expiração (ISO 8601). */
  expires_at?: string;
}

function enc(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Endpoints de cliente (`/v1/customers`) e seus links de setup
 * (`/v1/customers/:id/setup_links`).
 */
export class Customers {
  constructor(private readonly client: BotoZap) {}

  /** Lista os clientes da conta (paginação por offset/página). */
  list(params: OffsetParams = {}): Promise<OffsetList<Customer>> {
    return this.client.requestOffsetList<OffsetList<Customer>>("GET", "/customers", {
      query: { page: params.page, per_page: params.per_page },
    });
  }

  /** Busca um cliente pelo id. */
  get(id: string): Promise<Customer> {
    return this.client.requestItem<Customer>("GET", `/customers/${enc(id)}`);
  }

  /** Cria um cliente. */
  create(params: CreateCustomerParams): Promise<Customer> {
    return this.client.requestItem<Customer>("POST", "/customers", {
      body: params,
    });
  }

  /** Atualiza `name` / `external_customer_id` de um cliente. */
  update(id: string, params: UpdateCustomerParams): Promise<Customer> {
    return this.client.requestItem<Customer>("PATCH", `/customers/${enc(id)}`, {
      body: params,
    });
  }

  /** Exclui um cliente. Responde 204 (sem corpo). */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/customers/${enc(id)}`);
  }

  /** Lista os links de setup de um cliente (paginação por offset/página). */
  listSetupLinks(
    customerId: string,
    params: OffsetParams = {},
  ): Promise<OffsetList<SetupLink>> {
    return this.client.requestOffsetList<OffsetList<SetupLink>>(
      "GET",
      `/customers/${enc(customerId)}/setup_links`,
      { query: { page: params.page, per_page: params.per_page } },
    );
  }

  /**
   * Cria um link de setup sob um cliente (expira em 30 dias). Envie a `url`
   * devolvida ao Cliente; veja em {@link CreateSetupLinkParams} como funcionam
   * os redirecionamentos. URL de redirecionamento inválida lança
   * `BotoZapError` com `code: "invalid_redirect_url"` (422).
   */
  createSetupLink(
    customerId: string,
    params: CreateSetupLinkParams = {},
  ): Promise<SetupLink> {
    return this.client.requestItem<SetupLink>(
      "POST",
      `/customers/${enc(customerId)}/setup_links`,
      { body: params },
    );
  }

  /** Atualiza status/expiração de um link de setup. */
  updateSetupLink(
    customerId: string,
    linkId: string,
    params: UpdateSetupLinkParams,
  ): Promise<SetupLink> {
    return this.client.requestItem<SetupLink>(
      "PATCH",
      `/customers/${enc(customerId)}/setup_links/${enc(linkId)}`,
      { body: params },
    );
  }
}
