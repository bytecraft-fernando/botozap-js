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
  /** Destinatário efetivamente usado após normalização de telefone/BSUID. */
  sent_to?: string;
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
  /** Nome do perfil no canal; a ingestão o sobrescreve a cada inbound. */
  profile_name?: string | null;
  /**
   * Nome que a empresa dá ao Contato (1–200 caracteres). Só a API o grava;
   * `null` quando não definido. Não substitui `profile_name`.
   */
  display_name?: string | null;
  /** Contact tags (stored in metadata.tags); returned by servers with #498. */
  tags?: string[];
  [key: string]: unknown;
}

/** Origem da Conversa: anúncio Click-to-WhatsApp, orgânica ou desconhecida (`null`). */
export type ConversationEntryPoint = "ctwa" | "organic";

/**
 * Último clique em anúncio Click-to-WhatsApp que trouxe o Contato. Só os
 * campos de atribuição; o texto completo do anúncio fica na mensagem.
 */
export interface ConversationReferral {
  /** ID do anúncio ou post na Meta. */
  source_id: string | null;
  source_url: string | null;
  headline: string | null;
  /** Click ID do anúncio (atribuição/conversões). */
  ctwa_clid: string | null;
  /** Quando o BotoZap recebeu o clique (ISO 8601). */
  received_at: string | null;
}

export interface Conversation {
  id: string;
  /** UUID interno do Número da própria Conversa. */
  phone_number_id?: string;
  contact?: {
    /** Identidade canônica do Contato: telefone ou BSUID. */
    wa_id?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  };
  /** `"ctwa"` (anúncio), `"organic"` ou `null` quando desconhecida. */
  entry_point?: ConversationEntryPoint | null;
  /** Último referral de anúncio; `null` se a Conversa nunca veio de anúncio. */
  referral?: ConversationReferral | null;
  /**
   * Fim da janela grátis do Free Entry Point informado pela Meta no status de
   * um envio (ISO 8601); `null` fora dela.
   */
  fep_expires_at?: string | null;
  /**
   * ESTIMATIVA do prazo para responder e abrir a janela grátis (último clique
   * + 24h); `null` sem clique recente. Não altera a regra da janela de 24h.
   */
  fep_reply_by?: string | null;
  [key: string]: unknown;
}

export interface Assignment {
  id: string;
  [key: string]: unknown;
}

export interface Webhook {
  id: string;
  /** Cliente cujas entregas o endpoint recebe; `null` = todos os da Conta. */
  customer_id?: string | null;
  url: string;
  events?: string[];
  active?: boolean;
  /** True quando o endpoint tem Authorization no Vault. O valor nunca é devolvido. */
  has_authorization?: boolean;
  /** Segredo HMAC; presente somente na resposta de criação. */
  secret?: string;
  [key: string]: unknown;
}

export interface PhoneNumber {
  id: string;
  /** Nome local do Número no BotoZap (até 100 caracteres); `null` se não definido. */
  label?: string | null;
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

/** Evento autoritativo do stream durável da Conta e ambiente autenticados. */
export interface BotoZapEvent {
  id: string;
  /** Cursor monotônico e contíguo, serializado como string. */
  cursor: string;
  type: string;
  /**
   * WAMID da mensagem do WhatsApp que originou o Evento. `null` fora do
   * WhatsApp (ex.: Instagram) ou em Eventos sem mensagem; use `external_id`
   * para o identificador genérico do canal.
   */
  message_id: string | null;
  /**
   * Identificador da mensagem no canal de origem: o `wamid` no WhatsApp, o
   * `mid` no Instagram. Pode ser `null` em Eventos sem mensagem.
   */
  external_id: string | null;
  /** UUID interno da Mensagem; pode ser null em status de Broadcast. */
  message_resource_id: string | null;
  occurred_at: string;
  created_at: string;
  data: Record<string, unknown>;
}

/** Paginação crescente do stream; `cursor` é seguro para o próximo `after`. */
export interface EventPaging {
  cursor: string;
  next: string | null;
  has_more: boolean;
}

export interface EventList {
  data: BotoZapEvent[];
  paging: EventPaging;
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
 * Retorno de GET /v1/media/:id — metadados de uma mídia RECEBIDA (inbound) já
 * espelhada, mais a `download_url` (URL assinada, efêmera) para baixar o binário.
 * O `id` é o `media_id` da Cloud API (não um uuid interno).
 *
 * `mime_type`/`file_size`/`sha256` podem vir `null` (a Meta nem sempre informa
 * todos). Se a mídia AINDA está sendo espelhada, a rota responde 202 e o SDK
 * lança `BotoZapError` com `code: "media_not_ready"` (ver `media.get`) — nesse
 * caso este objeto nunca é devolvido.
 */
export interface MediaAsset {
  /** media_id da Cloud API. */
  id: string;
  mime_type: string | null;
  /** Tamanho em bytes. */
  file_size: number | null;
  sha256: string | null;
  /** URL assinada para baixar o binário. Válida até `expires_at`. */
  download_url: string;
  /** ISO 8601 — quando a `download_url` deixa de valer. */
  expires_at: string;
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
  /** Código de idioma da página; `null` = automático. */
  language: string | null;
  /**
   * Destino depois de concluir; recebe `setup_link_id` e `status=completed`
   * (a query string da URL é preservada, o token nunca é enviado).
   */
  success_redirect_url: string | null;
  /**
   * Destino com `status=failed` (link esgotado) ou `status=cancelled` (o
   * Cliente voltou num erro recuperável; o link segue válido), mais
   * `setup_link_id`.
   */
  failure_redirect_url: string | null;
  /** Reservado: hoje sempre `null` (a página de conexão não aplica tema). */
  theme_config: unknown;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}
