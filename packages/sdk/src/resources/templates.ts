import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";

export interface Template {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** Filtros de `templates.list` (paginação por offset). Ver GET /v1/templates. */
export interface ListTemplatesParams extends OffsetParams {
  /** Status do template (a rota normaliza para maiúsculas), ex.: "APPROVED". */
  status?: string;
  /** Categoria (a rota normaliza para maiúsculas), ex.: "MARKETING". */
  category?: string;
  /** Filtra pela conexão WABA. */
  waba_connection_id?: string;
  /** phone_number_id (Meta) → resolve a conexão do número (escopado por conta). */
  phone_number_id?: string;
}

/**
 * Corpo de `POST /v1/templates` — cria o template e o submete à Meta. A conexão
 * WABA vem de `waba_connection_id` OU `phone_number_id` (um dos dois). Ver a
 * rota para o formato exato de `components`.
 */
export interface CreateTemplateParams {
  name: string;
  /** Código de idioma, ex.: "pt_BR". */
  language: string;
  /** Categoria da Meta: "MARKETING" | "UTILITY" | "AUTHENTICATION". */
  category: string;
  /** Componentes do template (header/body/buttons…), formato da Cloud API. */
  components: unknown[];
  /** Conexão WABA alvo (alternativa a `phone_number_id`). */
  waba_connection_id?: string;
  /** phone_number_id (Meta) → resolve a conexão do número (alternativa). */
  phone_number_id?: string;
}

/** Endpoints de template (GET/POST /v1/templates, GET /v1/templates/:id). */
export class Templates {
  constructor(private readonly client: BotoZap) {}

  /** Lista os templates da conta (paginação por offset/página). */
  list(params: ListTemplatesParams = {}): Promise<OffsetList<Template>> {
    return this.client.requestOffsetList<OffsetList<Template>>("GET", "/templates", {
      query: {
        page: params.page,
        per_page: params.per_page,
        status: params.status,
        category: params.category,
        waba_connection_id: params.waba_connection_id,
        phone_number_id: params.phone_number_id,
      },
    });
  }

  /** Busca um template pelo id. */
  get(id: string): Promise<Template> {
    return this.client.requestItem<Template>(
      "GET",
      `/templates/${encodeURIComponent(id)}`,
    );
  }

  /** Cria um template e o submete à Meta para análise. */
  create(params: CreateTemplateParams): Promise<Template> {
    return this.client.requestItem<Template>("POST", "/templates", {
      body: params,
    });
  }
}
