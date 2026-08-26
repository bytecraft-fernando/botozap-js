import type { BotoZap } from "../client.js";
import { BotoZapError } from "../errors.js";
import type {
  CursorList,
  CursorParams,
  Message,
  SendResult,
  TemplatePayload,
} from "../types.js";

/** Filtros de `messages.list` (paginação por cursor). Ver GET /v1/messages. */
export interface ListMessagesParams extends CursorParams {
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
  /** Número de destino em E.164, ex: "+5531988887777". */
  to: string;
  /** Corpo do texto. */
  text: string;
  /** ID Meta ou UUID interno do Número de origem (obrigatório se houver mais de um). */
  from?: string;
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

export type SendMediaParams =
  | SendImageParams
  | SendVideoParams
  | SendAudioParams
  | SendDocumentParams;

/** Endpoints de mensagem (POST /v1/messages, GET /v1/messages/:id). */
export class Messages {
  constructor(private readonly client: BotoZap) {}

  /** Envia uma mensagem de texto. */
  async send(params: SendTextParams): Promise<SendResult> {
    const result = await this.client.requestObject<SendResult>("POST", "/messages", {
      body: {
        to: params.to,
        type: "text",
        text: { body: params.text },
        from: params.from,
      },
    });
    return assertSendResult(result);
  }

  /** Envia uma mensagem usando um template aprovado. */
  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    const result = await this.client.requestObject<SendResult>("POST", "/messages", {
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
  async sendMedia(params: SendMediaParams): Promise<SendResult> {
    const media: Record<string, unknown> = { link: params.link };
    if ("caption" in params && params.caption !== undefined) {
      media.caption = params.caption;
    }
    if ("filename" in params && params.filename !== undefined) {
      media.filename = params.filename;
    }
    const result = await this.client.requestObject<SendResult>("POST", "/messages", {
      body: {
        to: params.to,
        from: params.from,
        type: params.type,
        [params.type]: media,
      },
    });
    return assertSendResult(result);
  }

  /** Lista as mensagens da conta (paginação por cursor). */
  list(params: ListMessagesParams = {}): Promise<CursorList<Message>> {
    return this.client.requestCursorList<CursorList<Message>>("GET", "/messages", {
      query: {
        limit: params.limit,
        after: params.after,
        before: params.before,
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

function assertSendResult(value: SendResult): SendResult {
  if (
    typeof value.wamid !== "string" ||
    typeof value.to !== "string" ||
    typeof value.status !== "string" ||
    (value.id !== null && typeof value.id !== "string")
  ) {
    throw new BotoZapError(
      "malformed_response",
      "resposta de envio sem id/wamid/to/status válidos",
      0,
    );
  }
  return value;
}
