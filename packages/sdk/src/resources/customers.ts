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

/** Corpo de `POST /v1/customers/:id/setup_links`. */
export interface CreateSetupLinkParams {
  /** Tipos de conexão liberados: "dedicated" e/ou "coexistence". */
  allowed_connection_types?: string[];
  provision_phone_number?: boolean;
  language?: string;
  success_redirect_url?: string;
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

  /** Cria um link de setup sob um cliente. */
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
