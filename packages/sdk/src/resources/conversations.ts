import type { BotoZap } from "../client.js";
import type {
  Assignment,
  Conversation,
  CursorList,
  CursorParams,
  OffsetList,
  OffsetParams,
} from "../types.js";

export interface ListConversationsParams extends CursorParams {
  /** id da Meta OU uuid interno do número. */
  phone_number_id?: string;
  /** "active" | "ended" — derivado da janela de 24h. */
  status?: string;
  /**
   * Busca parcial por contato (nome de perfil, @username, telefone ou wa_id).
   * Tem precedência sobre `phone_number` na rota.
   */
  contact?: string;
  /** Alias de busca por contato (usado quando `contact` não é informado). */
  phone_number?: string;
}

export interface CreateAssignmentParams {
  /** Membro a quem atribuir a conversa. */
  user_id: string;
  notes?: string;
}

/** Conversas (read + status) e atribuições a membros. */
export class Conversations {
  constructor(private readonly client: BotoZap) {}

  /** Lista as conversas da conta (paginação por cursor). */
  list(params: ListConversationsParams = {}): Promise<CursorList<Conversation>> {
    return this.client.requestCursorList<CursorList<Conversation>>(
      "GET",
      "/conversations",
      {
        query: {
          limit: params.limit,
          after: params.after,
          before: params.before,
          phone_number_id: params.phone_number_id,
          status: params.status,
          contact: params.contact,
          phone_number: params.phone_number,
        },
      },
    );
  }

  get(id: string): Promise<Conversation> {
    return this.client.requestItem<Conversation>(
      "GET",
      `/conversations/${enc(id)}`,
    );
  }

  update(id: string, params: Record<string, unknown>): Promise<Conversation> {
    return this.client.requestItem<Conversation>(
      "PATCH",
      `/conversations/${enc(id)}`,
      { body: params },
    );
  }

  /** Lista as atribuições da conversa (paginação por offset/página). */
  listAssignments(
    id: string,
    params: OffsetParams = {},
  ): Promise<OffsetList<Assignment>> {
    return this.client.requestOffsetList<OffsetList<Assignment>>(
      "GET",
      `/conversations/${enc(id)}/assignments`,
      { query: { page: params.page, per_page: params.per_page } },
    );
  }

  createAssignment(
    id: string,
    params: CreateAssignmentParams,
  ): Promise<Assignment> {
    return this.client.requestItem<Assignment>(
      "POST",
      `/conversations/${enc(id)}/assignments`,
      { body: params },
    );
  }

  getAssignment(id: string, assignmentId: string): Promise<Assignment> {
    return this.client.requestItem<Assignment>(
      "GET",
      `/conversations/${enc(id)}/assignments/${enc(assignmentId)}`,
    );
  }

  updateAssignment(
    id: string,
    assignmentId: string,
    params: Record<string, unknown>,
  ): Promise<Assignment> {
    return this.client.requestItem<Assignment>(
      "PATCH",
      `/conversations/${enc(id)}/assignments/${enc(assignmentId)}`,
      { body: params },
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
