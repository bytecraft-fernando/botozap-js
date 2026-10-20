import type { BotoZap } from "../client.js";
import type { CursorList, CursorParams } from "../types.js";

/** Quem agiu: `user` (pessoa da equipe), `api_key` (chave de API) ou `system`. */
export interface TeamEventActor {
  type: "user" | "api_key" | "system" | (string & {});
  user_id: string | null;
  api_key_id: string | null;
  label: string | null;
}

/** Sobre o que a ação foi (conversa, canal, webhook, exportação…). */
export interface TeamEventTarget {
  type: string | null;
  /** Nome legível do tipo; `null` quando o tipo é desconhecido. */
  type_label: string | null;
  id: string | null;
  label: string | null;
}

/** Um evento do Registro de atividades da equipe. */
export interface TeamEvent {
  id: string;
  /** ISO 8601. */
  created_at: string;
  actor: TeamEventActor;
  /** Código da ação, por exemplo `export.requested` ou `webhook.created`. */
  action: string;
  /** Texto legível da ação. */
  action_label: string;
  target: TeamEventTarget;
  /** Estado antes da ação, quando a ação altera algo. */
  before: unknown;
  /** Estado depois da ação. */
  after: unknown;
  ip_address: string | null;
}

/** Filtros de `teamEvents.list`. */
export interface ListTeamEventsParams extends CursorParams {
  /** Eventos a partir desta data (ISO 8601, inclusive). */
  since?: string;
  /** Eventos antes desta data (ISO 8601, exclusive). */
  until?: string;
  /** Pessoa ou chave de API que agiu (o id de quem agiu). */
  actor_id?: string;
  /** Código da ação, por exemplo `export.requested`. */
  action?: string;
  /** Tipo do alvo, por exemplo `conversation` ou `webhook`. */
  target_type?: string;
  /** Id do alvo, por exemplo o da conversa. */
  target_id?: string;
}

/**
 * Registro de atividades da equipe (`/v1/team_events`): quem fez o quê, quando e
 * de onde. Só leitura, mais novo primeiro.
 */
export class TeamEvents {
  constructor(private readonly client: BotoZap) {}

  /**
   * Lista o registro (paginação por cursor). Scope `team:read`, e só
   * Administrador lê: a chave vale enquanto quem a criou seguir como
   * Administrador da Conta (senão 403 `admin_required`). Filtro inválido é 422.
   */
  list(params: ListTeamEventsParams = {}): Promise<CursorList<TeamEvent>> {
    return this.client.requestCursorList<CursorList<TeamEvent>>(
      "GET",
      "/team_events",
      {
        query: {
          limit: params.limit,
          after: params.after,
          before: params.before,
          since: params.since,
          until: params.until,
          actor_id: params.actor_id,
          action: params.action,
          target_type: params.target_type,
          target_id: params.target_id,
        },
      },
    );
  }
}
