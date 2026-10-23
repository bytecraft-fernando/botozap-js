import type { BotoZap } from "../client.js";
import type { CursorList, CursorParams } from "../types.js";
export interface JourneyStep {
  template_id: string;
  delay_minutes: number;
  variable_map?: Record<string, string>;
}
export interface JourneyConfig {
  customer_id: string;
  name: string;
  status?: "active" | "paused";
  target_kind?: "contact" | "opportunity" | "demand";
  trigger_kind?:
    | "contact_date"
    | "stage_entered"
    | "appointment"
    | "demand_status";
  date_field_key?: string | null;
  stage_id?: string | null;
  demand_status?: "open" | "in_progress" | "waiting_customer" | null;
  /** Serviço da Agenda que dispara a régua quando `trigger_kind` é `appointment`. */
  appointment_service_id?: string | null;
  offset_days?: number;
  offset_hours?: number;
  yearly?: boolean;
  stop_on_reply?: boolean;
  stop_on_exit?: boolean;
  send_start_hour?: number;
  send_end_hour?: number;
  steps: JourneyStep[];
}
export interface Journey extends Required<Omit<JourneyConfig, "steps" | "appointment_service_id">> {
  appointment_service_id?: string | null;
  id: string;
  version: number;
  archived_at: string | null;
  pause_reason: string | null;
  environment: "live" | "sandbox";
  catalog_key?: string | null;
  created_at?: string;
  steps?: JourneyStep[];
}
export interface JourneyRun {
  id: string;
  contact_id: string;
  occurrence_key: string;
  status: string;
  stop_reason: string | null;
  opportunity_id: string | null;
  demand_id: string | null;
  finished_at: string | null;
  created_at: string;
  steps?: Array<{
    id: string;
    position: number;
    due_at: string;
    status: string;
    error: string | null;
    skip_reason: string | null;
    external_id: string | null;
    message_id: string | null;
    delivered_at: string | null;
    read_at: string | null;
    snapshot: unknown;
  }>;
  [key: string]: unknown;
}
export interface JourneyEnrollment {
  contact_id: string;
  occurrence_key: string;
  due_at?: string;
  opportunity_id?: string | null;
  demand_id?: string | null;
  appointment_id?: string | null;
}
export interface JourneyQuery extends Pick<CursorParams, "limit" | "after"> {
  customer_id?: string;
}
/** Segmento de negócio em que o modelo pronto aparece na galeria. */
export type JourneyCatalogSegment =
  | "geral"
  | "salao"
  | "clinica"
  | "loja"
  | "oficina"
  | "servicos"
  | (string & {});

/**
 * Gatilho do modelo pronto, como a galeria do painel o descreve (as chaves
 * vêm em camelCase, do jeito que a API devolve).
 */
export type JourneyCatalogTrigger =
  | {
      kind: "contact_date";
      dateFieldKey: string;
      dateFieldLabel: string;
      offsetDays: number;
      yearly: boolean;
    }
  | { kind: "stage_entered"; stageKey: string; waitDays: number }
  | { kind: "appointment"; offsetHours: number };

/** Modelo pronto de Régua (`GET /v1/journeys/catalog`), o mesmo da galeria de Automações. */
export interface JourneyCatalogItem {
  /** Chave do modelo, usada em `journeys.enableModel`. */
  key: string;
  name: string;
  description: string;
  segments: JourneyCatalogSegment[];
  trigger: JourneyCatalogTrigger;
  category: "UTILITY" | "MARKETING";
  /** Nome do template que o modelo cria no número. */
  template_name: string;
  template_language: string;
  /** Texto do template, com variáveis `{{1}}`, `{{2}}`… */
  body: string;
  /** De onde vem cada variável (`"1"` → `contact.name`, por exemplo). */
  variable_map: Record<string, string>;
  /** Exemplo de cada variável enviado à Meta na análise do template. */
  examples: Record<string, string>;
}

/** Corpo de `journeys.enableModel`. */
export interface EnableJourneyModelParams {
  /** Cliente (negócio) que recebe a Régua. */
  customer_id: string;
  /**
   * Conexão (WABA) do número que envia. Com mais de um número no Cliente,
   * informe esta ou `phone_number_id`; sem nenhuma das duas a API responde
   * 422 `validation_error`.
   */
  waba_connection_id?: string;
  /** `phone_number_id` da Meta do número que envia (alternativa a `waba_connection_id`). */
  phone_number_id?: string;
}

/** Resposta de `journeys.enableModel`: 201 quando cria a Régua, 200 quando ela já existia. */
export interface JourneyModelEnableResult {
  journey_id: string;
  /** `false` quando o modelo já tinha uma Régua não arquivada no Cliente (nada mudou). */
  created: boolean;
  /** O template do modelo foi enviado à Meta nesta chamada. */
  template_submitted: boolean;
  /** O template recusado foi reenviado à Meta e a Régua voltou a esperar a aprovação. */
  resubmitted: boolean;
  /** `true` com o template já aprovado; senão a Régua fica pausada (`pending_template`) e liga sozinha na aprovação. */
  active: boolean;
}

export class Journeys {
  constructor(private readonly client: BotoZap) {}
  list(params: JourneyQuery = {}): Promise<CursorList<Journey>> {
    return this.client.requestCursorList("GET", "/journeys", {
      query: { ...params },
    });
  }
  /**
   * Lista os modelos prontos de Régua, os mesmos da galeria de Automações do
   * painel, com gatilho, texto do template, `variable_map` e os `examples` que
   * vão à Meta. Scope `journeys:read`.
   */
  catalog(): Promise<JourneyCatalogItem[]> {
    return this.client.requestItem<JourneyCatalogItem[]>("GET", "/journeys/catalog");
  }

  /**
   * Liga um modelo pronto no Cliente, como "Usar modelo" no painel: cria o
   * template do modelo no número e o envia à aprovação da Meta (reaproveita o
   * template se já existe), cria o campo de data do modelo e a Régua. Com o
   * template aprovado a Régua já nasce ativa e pode enviar mensagens
   * automáticas; senão fica pausada (`pending_template`) e liga sozinha na
   * aprovação. Se o modelo já tem Régua no Cliente, responde `created: false`
   * sem mudar nada, exceto quando ela está pausada com `template_rejected`: aí
   * reenvia o template (`resubmitted: true`).
   *
   * Scope `journeys:write`; exige plano com automações (403 `plan_restricted`).
   * Recusas: `not_found` (modelo, Cliente ou número), `validation_error` (422,
   * falta `customer_id` ou o número com mais de um no Cliente), `not_connected`
   * (409), `meta_error` (422 recusa da Meta; 502 Meta indisponível).
   */
  enableModel(key: string, params: EnableJourneyModelParams): Promise<JourneyModelEnableResult> {
    return this.client.requestItem<JourneyModelEnableResult>(
      "POST",
      `/journeys/catalog/${encodeURIComponent(key)}/enable`,
      { body: params },
    );
  }
  get(id: string, params: { customer_id?: string } = {}): Promise<Journey> {
    return this.client.requestItem(
      "GET",
      `/journeys/${encodeURIComponent(id)}`,
      { query: { ...params } },
    );
  }
  create(input: JourneyConfig): Promise<Journey> {
    return this.client.requestItem("POST", "/journeys", { body: input });
  }
  update(
    id: string,
    input: JourneyConfig & { version: number },
  ): Promise<Journey> {
    return this.client.requestItem(
      "PUT",
      `/journeys/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  /** Archives using CAS; this endpoint returns a record, not HTTP 204. */
  delete(id: string, version: number): Promise<Journey> {
    return this.client.requestItem(
      "DELETE",
      `/journeys/${encodeURIComponent(id)}`,
      { query: { version } },
    );
  }
  control(
    id: string,
    input: { action: "pause" | "resume" | "archive"; version: number },
  ): Promise<Journey> {
    return this.client.requestItem(
      "POST",
      `/journeys/${encodeURIComponent(id)}/control`,
      { body: input },
    );
  }
  runs(id: string, params: JourneyQuery = {}): Promise<CursorList<JourneyRun>> {
    return this.client.requestCursorList(
      "GET",
      `/journeys/${encodeURIComponent(id)}/runs`,
      { query: { ...params } },
    );
  }
  enroll(id: string, input: JourneyEnrollment): Promise<{ id: string }> {
    return this.client.requestItem(
      "POST",
      `/journeys/${encodeURIComponent(id)}/runs`,
      { body: input },
    );
  }
  getRun(id: string): Promise<JourneyRun> {
    return this.client.requestItem(
      "GET",
      `/journey-runs/${encodeURIComponent(id)}`,
    );
  }
  controlRun(
    id: string,
    input: { action: "stop" } | { action: "acknowledge"; note: string },
  ): Promise<JourneyRun> {
    return this.client.requestItem(
      "POST",
      `/journey-runs/${encodeURIComponent(id)}/control`,
      { body: input },
    );
  }
}
