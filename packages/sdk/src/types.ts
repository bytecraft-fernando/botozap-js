/** Status de uma mensagem no envio. A API pode evoluir os valores. */
export type MessageStatus = "sent" | "delivered" | "read" | "failed" | string;

/**
 * Retorno de POST /v1/messages. Esta rota responde o objeto DIRETO (sem o
 * envelope `{ data }`), por isso o método `messages.send` devolve `SendResult`
 * cru. Todas as OUTRAS rotas de item vêm embrulhadas em `{ data }` (helper `ok`).
 */
export interface SendResult {
  id: string | null;
  wamid: string;
  to: string;
  status: MessageStatus;
  /** Presente apenas quando a chave é do ambiente sandbox. */
  sandbox?: boolean;
}

/** Componente de template do WhatsApp (header, body, button…). */
export interface TemplatePayload {
  name: string;
  /** A rota exige o objeto `{ code }` (formato da Cloud API) — string solta é rejeitada. */
  language: { code: string };
  components?: unknown[];
}

// ---------------------------------------------------------------------------
// Paginação — dois modelos, espelhando os helpers `okCursor`/`okOffset` da API.
// ---------------------------------------------------------------------------

/** Bloco de paginação por cursor (resposta de `okCursor`). */
export interface CursorPaging {
  cursors: { before: string | null; after: string | null };
  /** Cursor para a próxima página (itens mais antigos); null se não há mais. */
  next: string | null;
  /** Cursor para a página anterior (itens mais novos). */
  previous: string | null;
}

/** Bloco de paginação por offset/página (resposta de `okOffset`). */
export interface OffsetMeta {
  page: number;
  per_page: number;
  total_pages: number;
  total_count: number;
}

/** Lista paginada por cursor: `{ data, paging }`. */
export interface CursorList<T> {
  data: T[];
  paging: CursorPaging;
}

/** Lista paginada por offset/página: `{ data, meta }`. */
export interface OffsetList<T> {
  data: T[];
  meta: OffsetMeta;
}

/** Params de paginação por cursor (`limit`/`after`/`before`). */
export interface CursorParams {
  /** Quantos itens retornar (1..100). */
  limit?: number;
  /** Cursor `paging.next` para avançar (itens mais antigos). */
  after?: string;
  /** Cursor `paging.previous` para voltar (itens mais novos). */
  before?: string;
}

/** Params de paginação por offset/página (`page`/`per_page`). */
export interface OffsetParams {
  page?: number;
  per_page?: number;
}

// ---------------------------------------------------------------------------
// Entidades. Os campos exatos vêm da API; o `id` é sempre o uuid interno.
// ---------------------------------------------------------------------------

/** Cliente (customer) da sua conta. */
export interface Customer {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  [key: string]: unknown;
}

export interface Broadcast {
  id: string;
  [key: string]: unknown;
}

export interface BroadcastRecipient {
  id: string;
  [key: string]: unknown;
}

export interface Contact {
  id: string;
  wa_id?: string;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  [key: string]: unknown;
}

export interface Assignment {
  id: string;
  [key: string]: unknown;
}

export interface Webhook {
  id: string;
  url: string;
  events?: string[];
  active?: boolean;
  [key: string]: unknown;
}

export interface PhoneNumber {
  id: string;
  [key: string]: unknown;
}

export interface Flow {
  id: string;
  [key: string]: unknown;
}

export interface FlowVersion {
  [key: string]: unknown;
}

export interface User {
  id: string;
  [key: string]: unknown;
}

export interface ApiLog {
  id: string;
  [key: string]: unknown;
}

export interface WebhookDelivery {
  id: string;
  [key: string]: unknown;
}

/**
 * Retorno de POST /v1/media. A rota responde `{ ingest_id, target, resource }`:
 * `target.kind` diz o pipeline usado (`meta_media` traz `media_id` usável em
 * mensagens; `meta_resumable_asset` traz `handle` reutilizável em templates).
 */
export interface MediaUploadResult {
  ingest_id: string;
  target: {
    kind: "meta_media" | "meta_resumable_asset" | string;
    /** Presente em `kind: "meta_media"` — id usável no envio de mensagens. */
    media_id?: string;
    /** Presente em `kind: "meta_resumable_asset"` — handle reutilizável. */
    handle?: string;
    [key: string]: unknown;
  };
  resource: {
    filename: string;
    mime_type: string;
    size_bytes: number;
    sha256: string;
    source_url: string;
    [key: string]: unknown;
  };
}

/**
 * Link de setup de um cliente (Embedded Signup). Shape do contrato
 * (ver `/v1/customers/:id/setup_links`): a `url` embute o token opaco; o token
 * cru nunca é exposto separadamente.
 */
export interface SetupLink {
  id: string;
  status: string;
  whatsapp_setup_status: string;
  url: string;
  allowed_connection_types: string[];
  provision_phone_number: boolean;
  language: string | null;
  success_redirect_url: string | null;
  failure_redirect_url: string | null;
  theme_config: unknown;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}
