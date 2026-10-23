import type { SendOptions } from "./messages.js";
import type { BotoZap } from "../client.js";
import { BotoZapError } from "../errors.js";
import type {
  Assignment,
  Conversation,
  ConsentPurpose,
  ConsentRequestResult,
  CursorList,
  CursorParams,
  OffsetList,
  OffsetParams,
  MessageChannel,
  QuickReply,
  ReplyToParam,
  SendResult,
} from "../types.js";

export interface ListConversationsParams extends CursorParams {
  /** Só valores conhecidos; null não casa nem com false. */
  ig_follows_business?: boolean;
  /** Recorta as conversas pelos canais do negócio autorizado. */
  customer_id?: string;
  /** true: somente conversas com agente pausado aguardando humano. */
  agent_paused?: boolean;
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
  /** Canal da Conversa: `whatsapp` ou `instagram` (outro valor é 422). */
  channel?: MessageChannel;
  /** UUID da Conta de canal (Número ou Conta do Instagram) de origem. */
  channel_account_id?: string;
}

export interface CreateAssignmentParams {
  /** Membro a quem atribuir a conversa. */
  user_id: string;
  notes?: string;
}

export interface ReplyConversationParams {
  /** Corpo da resposta livre dentro da janela de 24h. */
  text: string;
  /** Opções de resposta (só em Conversas do Instagram; ver `messages.send`). */
  quick_replies?: QuickReply[];
  /**
   * Responde citando uma mensagem desta conversa: `{ message_id }` com o UUID
   * interno ou o wamid/mid da citada (ver `messages.send`).
   */
  reply_to?: ReplyToParam;
}

/** Corpo opcional de `conversations.requestConsent`. */
export interface RequestConsentParams {
  /** Finalidades pedidas ao contato (lista não vazia). Padrão: `["marketing"]`. */
  purposes?: ConsentPurpose[];
  /** Texto do pedido (até 1024 caracteres). Padrão: o texto padrão do BotoZap. */
  body?: string;
}

/** Resposta de `conversations.typing` (200). */
export interface ConversationTypingResult {
  conversation_id: string;
  /** Canal da Conversa. */
  channel: MessageChannel;
  typing: true;
  /**
   * `true` quando a chamada repetiu outra de menos de 20 s: a Meta não foi
   * chamada de novo e o indicador que já estava valendo continua.
   */
  repeated: boolean;
}

/** Resposta de `conversations.markRead` (200). */
export interface ConversationReadResult {
  conversation_id: string;
  /** Momento da leitura gravado (ISO 8601). */
  last_read_at: string;
}

/** Conversas (read + status) e atribuições a membros. */
export class Conversations {
  constructor(private readonly client: BotoZap) {}

  /** Pausa/retoma o agente nesta conversa. agents:write; retomar pode gerar respostas. */
  controlAgent(
    id: string,
    action: "pause" | "resume",
  ): Promise<{ conversation_id: string; paused: boolean }> {
    return this.client.requestItem(
      "POST",
      `/conversations/${encodeURIComponent(id)}/agent-control`,
      { body: { action } },
    );
  }

  /** Lista as conversas da conta (paginação por cursor). */
  list(
    params: ListConversationsParams = {},
  ): Promise<CursorList<Conversation>> {
    return this.client.requestCursorList<CursorList<Conversation>>(
      "GET",
      "/conversations",
      {
        query: {
          limit: params.limit,
        ig_follows_business: params.ig_follows_business === undefined ? undefined : String(params.ig_follows_business),
          customer_id: params.customer_id,
          agent_paused: params.agent_paused === undefined ? undefined : String(params.agent_paused),
          after: params.after,
          before: params.before,
          phone_number_id: params.phone_number_id,
          status: params.status,
          contact: params.contact,
          phone_number: params.phone_number,
          channel: params.channel,
          channel_account_id: params.channel_account_id,
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

  /**
   * Responde uma Conversa sem o chamador precisar combinar Contato e origem.
   * No WhatsApp a origem é o Número da Conversa; no Instagram, a Conta de
   * canal (`channel_account.id`). A leitura e o envio usam a mesma chave; o
   * POST /messages revalida Conta, ambiente, identidade, janela, quota e
   * billing antes de chamar a Meta.
   */
  async reply(
    id: string,
    params: ReplyConversationParams,
    options: SendOptions = {},
  ): Promise<SendResult> {
    const conversation = await this.get(id);
    const from =
      conversation.channel === "instagram"
        ? conversation.channel_account?.id
        : conversation.phone_number_id;
    if (typeof from !== "string" || !from.trim()) {
      throw new BotoZapError(
        "malformed_response",
        conversation.channel === "instagram"
          ? "Conversa do Instagram sem UUID da Conta de canal de origem."
          : "Conversa sem UUID interno do Número de origem.",
        0,
      );
    }

    const contact = conversation.contact;
    const to =
      typeof contact?.wa_id === "string" && contact.wa_id.trim()
        ? contact.wa_id
        : typeof contact?.phone === "string" && contact.phone.trim()
          ? contact.phone
          : null;
    if (!to) {
      throw new BotoZapError(
        "conversation_recipient_unavailable",
        "Conversa sem destinatário utilizável no Contato.",
        422,
      );
    }

    return this.client.messages.send(
      {
        to,
        text: params.text,
        from,
        ...(params.quick_replies !== undefined ? { quick_replies: params.quick_replies } : {}),
        ...(params.reply_to !== undefined ? { reply_to: params.reply_to } : {}),
      },
      options,
    );
  }

  /**
   * Envia o pedido de consentimento na conversa (o "Pedir consentimento" do
   * composer): botões no WhatsApp, respostas rápidas no Instagram. Só com a
   * janela de 24h aberta, e sai também para quem recusou marketing: é o caminho
   * de volta. O toque do contato grava o aceite (origem `conversation_button`).
   * Scope `messages:send`. Responde 201 com o `channel` do envio; `warnings` com
   * `send_unrecorded` significa que a Meta aceitou e a gravação falhou: não
   * reenvie, o pedido já saiu.
   *
   * Recusas: `outside_window` (WhatsApp) ou `window_closed` (Instagram) com a
   * janela fechada, `channel_not_supported` (canal sem botões), `no_phone`,
   * `not_connected` (número desconectado ou sem token), `invalid_recipient`.
   * Não há chave de idempotência: não repita um pedido de resultado incerto sem
   * conferir o histórico da conversa.
   */
  requestConsent(
    id: string,
    params: RequestConsentParams = {},
  ): Promise<ConsentRequestResult> {
    return this.client.requestItem<ConsentRequestResult>(
      "POST",
      `/conversations/${enc(id)}/consent-request`,
      { body: params },
    );
  }

  /**
   * Mostra "digitando…" ao contato enquanto a integração prepara a resposta,
   * como o Painel quando o atendente digita. O sinal vai na última mensagem
   * recebida do contato, que fica como lida (tiques azuis no WhatsApp, "visto"
   * no Instagram); a Meta tira o indicador quando a resposta sai ou em ~25 s.
   * Repetir em menos de 20 s não chama a Meta de novo (`repeated: true`); para
   * uma resposta demorada, chame de novo a cada 20 s. Sem corpo. Scope
   * `messages:send`; não aceita chave sandbox.
   *
   * Recusas: `no_inbound_message` (409, a conversa não tem mensagem recebida:
   * template e primeira mensagem não têm "digitando…"), `outside_window`
   * (WhatsApp) ou `window_closed` (Instagram) com a janela de 24h fechada (422),
   * `not_connected` (409), `meta_error` (422 na recusa da Meta, 502 se ela
   * falhar; a resposta em si pode ser enviada normalmente) e `not_found` (404).
   */
  typing(id: string): Promise<ConversationTypingResult> {
    return this.client.requestItem<ConversationTypingResult>(
      "POST",
      `/conversations/${enc(id)}/typing`,
    );
  }

  /**
   * Marca a conversa como lida, como abrir a conversa no Painel: grava
   * `last_read_at` (a conversa deixa de aparecer como não lida) e, logo depois
   * da resposta, a última mensagem recebida fica como lida para o contato
   * (tiques azuis no WhatsApp, "visto" no Instagram). A mesma mensagem não é
   * marcada duas vezes na Meta: repetir só atualiza `last_read_at`. O aviso ao
   * contato é de melhor esforço (canal desconectado ou recusa da Meta não mudam
   * a resposta). Sem corpo. Scope `conversations:write`; aceita chave sandbox
   * (grava a leitura sem avisar a Meta).
   */
  markRead(id: string): Promise<ConversationReadResult> {
    return this.client.requestItem<ConversationReadResult>(
      "POST",
      `/conversations/${enc(id)}/read`,
    );
  }

  /**
   * Exclui a conversa, com efeito imediato e sem volta: mensagens, notas,
   * atribuições, vínculos com oportunidades e demandas e o que a IA guardou
   * dela saem juntos, e os arquivos de mídia são apagados. O contato fica, com a
   * recusa e o consentimento. Só Administrador (por OAuth, papel de
   * administrador). Responde 204; id inexistente, de outra Conta ou já excluído
   * é 404. Scope `conversations:write`.
   */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/conversations/${enc(id)}`);
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
