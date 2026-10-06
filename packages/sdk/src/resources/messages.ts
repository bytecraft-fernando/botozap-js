import type { BotoZap } from "../client.js";
import { BotoZapError } from "../errors.js";
import type {
  CursorList,
  CursorParams,
  Message,
  QuickReply,
  SendResult,
  TemplatePayload,
} from "../types.js";

/**
 * Ordem de `messages.list`: `created_at` (padrão, chegada à BotoZap) ou
 * `event_at` (data real da mensagem; útil com histórico importado). O cursor é
 * da ordem que o gerou: reuse-o com o mesmo `sort`.
 */
export type MessageSort = "created_at" | "event_at";

/** Filtros de `messages.list` (paginação por cursor). Ver GET /v1/messages. */
export interface ListMessagesParams extends CursorParams {
  sort?: MessageSort;
  /** id da Meta OU uuid interno do número. */
  phone_number_id?: string;
  /** uuid interno da conversa (o `id` de /v1/conversations). */
  conversation_id?: string;
  direction?: "inbound" | "outbound";
  /** enum message_status (ex.: "sent", "delivered", "read", "failed"). */
  status?: string;
  /** enum message_kind (ex.: "text", "image", "template"). */
  message_type?: string;
  /** true = só mensagens com mídia; false = só sem mídia. */
  has_media?: boolean;
}

export interface SendTextParams {
  /**
   * Destinatário: telefone E.164 (ex.: "+5531988887777") ou BSUID no WhatsApp;
   * IGSID do contato no Instagram. O canal sai da forma do endereço (ou do `from`).
   */
  to: string;
  /** Corpo do texto. */
  text: string;
  /**
   * Origem: ID Meta ou UUID interno do Número (WhatsApp), id da conta na Meta
   * ou UUID da Conta de canal (Instagram). Obrigatório quando há mais de uma
   * origem do mesmo canal.
   */
  from?: string;
  /**
   * Opções de resposta (só Instagram, só com texto, até 13, dentro da janela de
   * 24h). No WhatsApp a API recusa com 422 `channel_not_supported`.
   */
  quick_replies?: QuickReply[];
}

export interface SendTemplateParams {
  to: string;
  template: TemplatePayload;
  /** ID Meta ou UUID interno do Número de origem. */
  from?: string;
}

export interface SendImageParams {
  to: string;
  type: "image";
  link: string;
  caption?: string;
  from?: string;
}

export interface SendAudioParams {
  to: string;
  type: "audio";
  link: string;
  from?: string;
}

export interface SendVideoParams {
  to: string;
  type: "video";
  link: string;
  caption?: string;
  from?: string;
}

export interface SendDocumentParams {
  to: string;
  type: "document";
  link: string;
  caption?: string;
  filename?: string;
  from?: string;
}

/**
 * Mídia por URL pública. `to` aceita telefone/BSUID (WhatsApp) ou IGSID
 * (Instagram); `from` aceita a origem de qualquer canal. No Instagram não
 * existe `caption`: a API recusa com 422 `unsupported_caption`.
 */
export type SendMediaParams =
  | SendImageParams
  | SendVideoParams
  | SendAudioParams
  | SendDocumentParams;

/** Header de `interactive` (texto; mídia só em button e cta_url). */
export type InteractiveHeader =
  | { type: "text"; text: string }
  | { type: "image"; image: { link: string } }
  | { type: "video"; video: { link: string } }
  | { type: "document"; document: { link: string; filename?: string } };

interface InteractiveBase {
  header?: InteractiveHeader;
  body: { text: string };
  footer?: { text: string };
}

/** Até 3 botões de resposta (título até 20 caracteres, ids únicos). */
export interface InteractiveButtonPayload extends InteractiveBase {
  type: "button";
  action: {
    buttons: { type?: "reply"; reply: { id: string; title: string } }[];
  };
}

/** Lista: até 10 seções e 10 opções no total; `title` da seção obrigatório com mais de uma. */
export interface InteractiveListPayload extends InteractiveBase {
  type: "list";
  header?: { type: "text"; text: string };
  action: {
    button: string;
    sections: {
      title?: string;
      rows: { id: string; title: string; description?: string }[];
    }[];
  };
}

/** Botão de link (URL https pública). */
export interface InteractiveCtaUrlPayload extends InteractiveBase {
  type: "cta_url";
  action: {
    name: "cta_url";
    parameters: { display_text: string; url: string };
  };
}

/** Objeto `interactive` no formato da Cloud API (validado pela API). */
export type InteractivePayload =
  | InteractiveButtonPayload
  | InteractiveListPayload
  | InteractiveCtaUrlPayload;

export interface SendInteractiveParams {
  to: string;
  interactive: InteractivePayload;
  from?: string;
}

export interface SendLocationParams {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  from?: string;
}

export interface SendReactionParams {
  to: string;
  /**
   * Mensagem RECEBIDA do contato: UUID interno ou wamid no WhatsApp (até 30
   * dias); o `mid` (`external_id`) no Instagram.
   */
  message_id: string;
  /** Emoji da reação; `""` retira a reação. */
  emoji: string;
  from?: string;
}

export interface SendOptions {
  /** Reuse for retries of the same send; a different payload conflicts. */
  idempotencyKey?: string;
}

/** Endpoints de mensagem (POST /v1/messages, GET /v1/messages/:id). */
export class Messages {
  constructor(private readonly client: BotoZap) {}

  /** Envia uma mensagem de texto. */
  async send(params: SendTextParams, options: SendOptions = {}): Promise<SendResult> {
    const result = await this.client.requestObject<SendResult>("POST", "/messages", {
      idempotencyKey: options.idempotencyKey,
      body: {
        to: params.to,
        type: "text",
        text: { body: params.text },
        from: params.from,
        ...(params.quick_replies !== undefined ? { quick_replies: params.quick_replies } : {}),
      },
    });
    return assertSendResult(result);
  }

  /** Envia uma mensagem usando um template aprovado. */
  async sendTemplate(params: SendTemplateParams, options: SendOptions = {}): Promise<SendResult> {
    const result = await this.client.requestObject<SendResult>("POST", "/messages", {
      idempotencyKey: options.idempotencyKey,
      body: {
        to: params.to,
        type: "template",
        template: params.template,
        from: params.from,
      },
    });
    return assertSendResult(result);
  }

  /** Envia mídia por URL pública. */
  async sendMedia(params: SendMediaParams, options: SendOptions = {}): Promise<SendResult> {
    const media: Record<string, unknown> = { link: params.link };
    if ("caption" in params && params.caption !== undefined) {
      media.caption = params.caption;
    }
    if ("filename" in params && params.filename !== undefined) {
      media.filename = params.filename;
    }
    const result = await this.client.requestObject<SendResult>("POST", "/messages", {
      idempotencyKey: options.idempotencyKey,
      body: {
        to: params.to,
        from: params.from,
        type: params.type,
        [params.type]: media,
      },
    });
    return assertSendResult(result);
  }

  /**
   * Envia botões de resposta, lista ou botão de link (WhatsApp; mensagem livre,
   * exige janela de 24h aberta).
   */
  async sendInteractive(
    params: SendInteractiveParams,
    options: SendOptions = {},
  ): Promise<SendResult> {
    return postMessage(
      this.client,
      { to: params.to, from: params.from, type: "interactive", interactive: params.interactive },
      options,
    );
  }

  /** Envia uma localização (WhatsApp; mensagem livre). */
  async sendLocation(params: SendLocationParams, options: SendOptions = {}): Promise<SendResult> {
    const location: Record<string, unknown> = {
      latitude: params.latitude,
      longitude: params.longitude,
    };
    if (params.name !== undefined) location.name = params.name;
    if (params.address !== undefined) location.address = params.address;
    return postMessage(
      this.client,
      { to: params.to, from: params.from, type: "location", location },
      options,
    );
  }

  /**
   * Reage a uma mensagem recebida (WhatsApp ou Instagram). `emoji: ""` retira
   * a reação. O retorno traz `reaction` com o alvo e a ação.
   */
  async sendReaction(params: SendReactionParams, options: SendOptions = {}): Promise<SendResult> {
    return postMessage(
      this.client,
      {
        to: params.to,
        from: params.from,
        type: "reaction",
        reaction: { message_id: params.message_id, emoji: params.emoji },
      },
      options,
    );
  }

  /** Lista as mensagens da conta (paginação por cursor). */
  list(params: ListMessagesParams = {}): Promise<CursorList<Message>> {
    return this.client.requestCursorList<CursorList<Message>>("GET", "/messages", {
      query: {
        limit: params.limit,
        after: params.after,
        before: params.before,
        sort: params.sort,
        phone_number_id: params.phone_number_id,
        conversation_id: params.conversation_id,
        direction: params.direction,
        status: params.status,
        message_type: params.message_type,
        has_media:
          params.has_media === undefined ? undefined : String(params.has_media),
      },
    });
  }

  /** Busca uma mensagem pelo id interno. */
  get(id: string): Promise<Message> {
    return this.client.requestItem<Message>(
      "GET",
      `/messages/${encodeURIComponent(id)}`,
    );
  }
}

async function postMessage(
  client: BotoZap,
  body: Record<string, unknown>,
  options: SendOptions,
): Promise<SendResult> {
  const result = await client.requestObject<SendResult>("POST", "/messages", {
    idempotencyKey: options.idempotencyKey,
    body,
  });
  return assertSendResult(result);
}

/**
 * Valida o recibo de envio. WhatsApp devolve `wamid`; Instagram devolve
 * `wamid: null` com `external_id` (o `mid`). Um dos dois identificadores do
 * canal precisa vir como string: sem nenhum, o aceite não é comprovável.
 */
function assertSendResult(value: SendResult): SendResult {
  const hasWamid = typeof value?.wamid === "string";
  const hasExternalId =
    value?.wamid === null && typeof value.external_id === "string" && value.external_id !== "";
  if (
    !value ||
    !(hasWamid || hasExternalId) ||
    typeof value.to !== "string" ||
    typeof value.status !== "string" ||
    (value.id !== null && typeof value.id !== "string")
  ) {
    throw new BotoZapError(
      "malformed_response",
      "resposta de envio sem id/wamid (ou external_id)/to/status válidos",
      0,
    );
  }
  return value;
}
