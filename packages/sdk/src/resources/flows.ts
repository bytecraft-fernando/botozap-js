import type { BotoZap } from "../client.js";
import type { Flow, FlowVersion, OffsetList, OffsetParams } from "../types.js";

export interface CreateFlowParams {
  name?: string;
  [key: string]: unknown;
}

/**
 * Filtros de `flows.list` (paginação por offset). Flows vivem na Meta e a lista
 * é por WABA — a rota GET /v1/flows EXIGE `phone_number_id` OU
 * `waba_connection_id` (sem um deles responde 422 missing_target). Informe um.
 */
export interface ListFlowsParams extends OffsetParams {
  /** phone_number_id (Meta) → resolve a conexão do número (escopado por conta). */
  phone_number_id?: string;
  /** Alternativa a `phone_number_id`: a conexão WABA cujos flows listar. */
  waba_connection_id?: string;
}

/**
 * Flows vivem na Meta, não no nosso banco — a amarração flow → conta é via
 * `phone_number_id` (resolve a WABA e o token). Por isso get/delete/publish/
 * setup_encryption/versions/data_endpoint EXIGEM `phone_number_id`.
 */
export interface FlowPhoneParams {
  /** phone_number_id (Meta) do número cuja WABA hospeda o flow. */
  phone_number_id: string;
}

/** Corpo de `POST /v1/flows/:id/versions` — sobe um novo flow.json. */
export interface CreateFlowVersionParams {
  phone_number_id: string;
  /** JSON do flow (objeto ou string JSON válida). */
  flow_json: unknown;
  [key: string]: unknown;
}

/** Corpo de `POST /v1/flows/:id/data_endpoint` — conecta a forward URL do dev. */
export interface SetFlowDataEndpointParams {
  phone_number_id: string;
  /** URL HTTPS do backend do dev que recebe o data_exchange. */
  forward_url: string;
  [key: string]: unknown;
}

/** WhatsApp Flows: criar, versionar, publicar e configurar data endpoint. */
export class Flows {
  constructor(private readonly client: BotoZap) {}

  /**
   * Lista os flows de uma WABA (paginação por offset/página). Informe
   * `phone_number_id` OU `waba_connection_id` — a rota exige um deles.
   */
  list(params: ListFlowsParams = {}): Promise<OffsetList<Flow>> {
    return this.client.requestOffsetList<OffsetList<Flow>>("GET", "/flows", {
      query: {
        page: params.page,
        per_page: params.per_page,
        phone_number_id: params.phone_number_id,
        waba_connection_id: params.waba_connection_id,
      },
    });
  }

  get(id: string, params: FlowPhoneParams): Promise<Flow> {
    return this.client.requestItem<Flow>("GET", `/flows/${enc(id)}`, {
      query: { phone_number_id: params.phone_number_id },
    });
  }

  create(params: CreateFlowParams): Promise<Flow> {
    return this.client.requestItem<Flow>("POST", "/flows", { body: params });
  }

  /** Remove um flow (só DRAFT, regra da Meta). Responde 204 (sem corpo). */
  delete(id: string, params: FlowPhoneParams): Promise<void> {
    return this.client.request<void>("DELETE", `/flows/${enc(id)}`, {
      query: { phone_number_id: params.phone_number_id },
    });
  }

  publish(id: string, params: FlowPhoneParams): Promise<Flow> {
    return this.client.requestItem<Flow>("POST", `/flows/${enc(id)}/publish`, {
      body: { phone_number_id: params.phone_number_id },
    });
  }

  /** Lista as versões de um flow (paginação por offset/página). */
  listVersions(
    id: string,
    params: OffsetParams = {},
  ): Promise<OffsetList<FlowVersion>> {
    return this.client.requestOffsetList<OffsetList<FlowVersion>>(
      "GET",
      `/flows/${enc(id)}/versions`,
      { query: { page: params.page, per_page: params.per_page } },
    );
  }

  createVersion(
    id: string,
    params: CreateFlowVersionParams,
  ): Promise<FlowVersion> {
    return this.client.requestItem<FlowVersion>(
      "POST",
      `/flows/${enc(id)}/versions`,
      { body: params },
    );
  }

  setupEncryption(
    id: string,
    params: FlowPhoneParams,
  ): Promise<Record<string, unknown>> {
    return this.client.requestItem<Record<string, unknown>>(
      "POST",
      `/flows/${enc(id)}/setup_encryption`,
      { body: { phone_number_id: params.phone_number_id } },
    );
  }

  getDataEndpoint(id: string): Promise<Record<string, unknown>> {
    return this.client.requestItem<Record<string, unknown>>(
      "GET",
      `/flows/${enc(id)}/data_endpoint`,
    );
  }

  setDataEndpoint(
    id: string,
    params: SetFlowDataEndpointParams,
  ): Promise<Record<string, unknown>> {
    return this.client.requestItem<Record<string, unknown>>(
      "POST",
      `/flows/${enc(id)}/data_endpoint`,
      { body: params },
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
