import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";

export interface Template {
  id: string;
  name?: string;
  /**
   * Textos dos botões de resposta rápida marcados como de saída. O toque num
   * botão marcado grava a recusa da finalidade do template (marketing ou
   * avisos). `[]` quando não há marcação.
   */
  opt_out_buttons?: string[];
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
  /**
   * Textos dos botões de resposta rápida de `components` que são de saída
   * (até 10). Texto que não é botão de resposta rápida do template responde 422
   * `invalid_template`.
   */
  opt_out_buttons?: string[];
}

/** Corpo de `PATCH /v1/templates/:id`. */
export interface SyncTemplatesParams {
  /** Só as conexões deste Cliente; sem ele, todas as conexões ativas da conta. */
  customer_id?: string;
}

/** Resultado de `templates.sync()`. */
export interface TemplateSyncResult {
  /** Conexões ativas do WhatsApp conferidas. */
  connections: number;
  /** Templates que a Meta tem e foram gravados aqui. */
  synced: number;
  /** Templates tirados daqui porque foram excluídos na Meta. */
  removed: number;
  /** Conexões sem autorização guardada, puladas (reconecte o número). */
  skipped_without_token: number;
  /** Uma régua de modelo não acompanhou a mudança de status: sincronize de novo. */
  automations_outdated: boolean;
}

export interface UpdateTemplateParams {
  /**
   * Textos dos botões de resposta rápida que são de saída; `[]` limpa a marcação.
   * Anotação do BotoZap: não altera o template na Meta.
   */
  opt_out_buttons: string[];
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

  /**
   * Marca quais botões de resposta rápida são de saída (`opt_out_buttons`). O toque
   * num botão marcado grava a recusa da finalidade do template; botão não marcado
   * não muda nada, qualquer que seja o texto. Não altera o template na Meta.
   * Scope `templates:write`.
   */
  update(id: string, params: UpdateTemplateParams): Promise<Template> {
    return this.client.requestItem<Template>(
      "PATCH",
      `/templates/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /**
   * O Sincronizar da tela de Templates: traz da Meta status, categoria,
   * conteúdo e `rejection_reason` dos templates das conexões ativas (ou de um
   * Cliente), importa os criados no WhatsApp Manager e tira daqui os excluídos
   * lá. Use quando um status parecer parado. Autorização recusada pela Meta
   * responde 409 `reconnect_required`. Scope `templates:write`.
   */
  sync(params: SyncTemplatesParams = {}): Promise<TemplateSyncResult> {
    return this.client.requestItem<TemplateSyncResult>("POST", "/templates/sync", { body: params });
  }
}
