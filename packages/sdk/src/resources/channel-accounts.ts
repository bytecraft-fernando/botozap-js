import type { InstagramInteractivePayload } from "./messages.js";
import type { BotoZap } from "../client.js";
import type { MessageChannel, OffsetList, OffsetParams, QuickReply } from "../types.js";

/**
 * Saúde do token de uma Conta do Instagram: `ok`; `expiring` (vence em até 7
 * dias, a renovação automática ainda tenta); `expired`; `invalid` (a Meta
 * recusou o token); `revoked` (conta desconectada); `unknown` (conexão
 * pendente). Com `expired`, `invalid` ou `revoked` os envios falham até
 * reconectar a conta.
 */
export type InstagramTokenStatus =
  | "ok"
  | "expiring"
  | "expired"
  | "invalid"
  | "revoked"
  | "unknown"
  | (string & {});

/**
 * Conta de canal: o endpoint concreto de um Cliente num canal — o Número no
 * WhatsApp, a Conta do Instagram no Instagram. O `id` (UUID) serve de `from`
 * no envio e de filtro `channel_account_id` nas listagens.
 */
export interface ChannelAccount {
  id: string;
  channel: MessageChannel;
  customer_id: string;
  /** Telefone formatado no WhatsApp, @username no Instagram; pode ser nulo. */
  display: string | null;
  status: string;
  sandbox: boolean;
  /** Id do endpoint na Meta: `phone_number_id` no WhatsApp, id da conta no Instagram. */
  external_id: string;
  created_at: string;
  updated_at: string;
  /** Detalhes do Número; só em Contas de canal do WhatsApp. */
  whatsapp?: {
    id: string | null;
    phone_number_id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    quality_rating: string | null;
    type: string | null;
    waba_connection_id: string | null;
    waba_id: string | null;
    connection_status: string | null;
    token_status: string | null;
  };
  /** Detalhes e saúde da conexão; só em Contas de canal do Instagram. Nunca traz o token. */
  instagram?: {
    /** Id da conta profissional na Meta (o mesmo `external_id`). */
    instagram_account_id: string;
    username: string | null;
    name: string | null;
    instagram_connection_id: string | null;
    connection_status: string | null;
    token_status: InstagramTokenStatus | null;
    /** Validade do token atual (60 dias, renovado sozinho a cada ~30). */
    token_expires_at: string | null;
    /** Última renovação bem-sucedida do token. */
    token_refreshed_at: string | null;
  };
  [key: string]: unknown;
}

/** Filtros de `channelAccounts.list` (GET /v1/channel_accounts). */
export interface ListChannelAccountsParams extends OffsetParams {
  /** `whatsapp` ou `instagram` (outro valor é 422). */
  channel?: MessageChannel;
  /** UUID do Cliente dono das Contas de canal. */
  customer_id?: string;
}

/** Estado confirmado da conexão; nunca inclui tokens. */
export interface InstagramConnection {
  status: string;
  username: string | null;
  subscribed_at: string | null;
  token_expires_at: string | null;
  revoked_reason: string | null;
  health: "conectado" | "pendente" | "reconexao_necessaria" | "revogado" | (string & {});
  subscribed_fields: string[];
  diagnostic: { code: string; message: string; next_step: string; help_url: string };
}
export interface MessageRuleQrParams { format?: "png" | "svg" }

/** Estado de uma Regra de comentário. `paused_plan`: ativa, mas pausada pelo plano. */
export type CommentRuleStatus = "active" | "inactive" | "paused_plan" | (string & {});

/**
 * Regra de comentário do Instagram: um comentário que casa `keyword` (ou
 * qualquer comentário, quando `null`) no post `media_id` (ou em todos, quando
 * `null`) recebe a abertura `dm_text` e, opcionalmente, a resposta pública
 * `reply_text`. Com `dm_button_title`, o toque entrega texto/imagem.
 */
export interface CommentRule {
  id: string;
  channel_account_id: string;
  /** Palavra-chave (até 60 caracteres); `null` = qualquer comentário. */
  keyword: string | null;
  /** Expressões alternativas; lista vazia = qualquer comentário. */
  keywords?: string[];
  excluded_keywords?: string[];
  reply_variations?: string[];
  /** Aguarda o próximo post quando true e media_id é null. */
  next_post?: boolean;
  /** Durante lives; não combinar com media_id ou next_post. Servidor sem suporte: 422 feature_unavailable. */
  live?: boolean;
  next_post_activated_at?: string | null;
  /** Abertura: 1000 bytes sem botão; 640 caracteres com botão. */
  dm_text: string;
  require_follow?: boolean;
  /** Com require_follow, obrigatório (640 caracteres) e exige botão de entrega. */
  non_follower_text?: string | null;
  /** Título do botão (20 caracteres); null mantém direct simples. */
  dm_button_title?: string | null;
  /** Texto entregue após o toque (1000 bytes). */
  delivery_text?: string | null;
  /** URL HTTPS pública de imagem entregue após o toque. */
  delivery_media?: string | null;
  /** Resposta pública ao comentário (até 2200 caracteres); `null` = sem resposta. */
  reply_text: string | null;
  /** Id numérico do post (`media.id`); `null` = todos os posts. */
  media_id: string | null;
  /** Configuração gravada; o efeito real está em `status`. */
  is_active: boolean;
  status: CommentRuleStatus;
  /** `true` quando a regra está ativa mas o plano não permite operá-la. */
  paused_by_plan: boolean;
  /** Aviso não bloqueante (regra sem palavra-chave valendo para todos os posts). */
  notice: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Corpo de `createCommentRule` (POST /v1/channel_accounts/:id/comment-rules). */
export interface CreateCommentRuleParams {
  /** Texto do direct enviado a quem comentou (obrigatório). */
  dm_text: string;
  require_follow?: boolean;
  /** Com require_follow, obrigatório (640 caracteres) e exige botão de entrega. */
  non_follower_text?: string | null;
  /** Botão de até 20 caracteres; com botão dm_text aceita até 640 caracteres. */
  dm_button_title?: string | null;
  /** Obrigatório com botão; até 1000 bytes. null remove. */
  delivery_text?: string | null;
  /** Imagem HTTPS pública sem credenciais; null remove. */
  delivery_media?: string | null;
  /** Palavra-chave; `null`/vazio = qualquer comentário. */
  keyword?: string | null;
  /** Até 20 expressões (60 caracteres cada); prevalece sobre keyword. */
  keywords?: string[];
  /** Até 20 exclusões (60 caracteres cada). */
  excluded_keywords?: string[];
  /** Até 10 respostas públicas (2200 caracteres cada); prevalece sobre reply_text. */
  reply_variations?: string[];
  /** Próximo post; não combinar com media_id explícito. */
  next_post?: boolean;
  /** Durante lives; não combinar com media_id ou next_post. Servidor sem suporte: 422 feature_unavailable. */
  live?: boolean;
  /** Resposta pública ao comentário; `null`/vazio = sem resposta. */
  reply_text?: string | null;
  /** Id numérico do post; `null`/vazio = todos os posts. */
  media_id?: string | null;
  /** Padrão `true`. */
  is_active?: boolean;
}

/** Corpo de `updateCommentRule` (PATCH): só os campos enviados mudam. */
export type UpdateCommentRuleParams = Partial<CreateCommentRuleParams>;

/** Resultado da exclusão de uma Regra de comentário. */
export interface DeleteCommentRuleResult {
  id: string;
  deleted: true;
}

/** Gatilhos aceitos pelas Regras de mensagem do Instagram. */
export type MessageRuleTrigger = "keyword" | "story_reply" | "story_mention" | "share" | "ref" | "ad";
export type FixedRuleMessage =
  | { type: "text"; text: string; quick_replies?: QuickReply[] }
  | { type: "image" | "video" | "audio" | "document"; link: string; filename?: string }
  | { type: "interactive"; interactive: InstagramInteractivePayload };
export type MessageRuleAction =
  | { type: "message"; message: FixedRuleMessage }
  | { type: "agent"; agent_id: string; router_id?: never }
  | { type: "agent"; router_id: string; agent_id?: never }
  | { type: "stage"; stage_id: string | null }
  | { type: "tags"; add?: string[]; remove?: string[] }
  | { type: "assign"; user_id: string };

/** POST: a API valida combinações de gatilho e ações. */
export interface CreateMessageRuleParams {
  /** 1–100 caracteres. */
  name: string;
  trigger: MessageRuleTrigger;
  /** Até 20 expressões de 60 caracteres; keyword exige ao menos uma. */
  keywords?: string[];
  excluded_keywords?: string[];
  /** Só em story_reply, até 200 caracteres. */
  story_contains?: string | null;
  /** Só em ref; ausente/null gera ref no servidor. */
  ref?: string | null;
  /** Só em ad, até 32 dígitos. */
  ad_id?: string | null;
  /** Inteiro 0–1000; padrão 100. Menor prioridade vence. */
  priority?: number;
  is_active?: boolean;
  /** 1–5 ações; no máximo uma de cada tipo. */
  actions: MessageRuleAction[];
  require_follow?: boolean;
  /** Até 1000 bytes; null remove. */
  non_follower_text?: string | null;
}
export type UpdateMessageRuleParams = Partial<CreateMessageRuleParams>;
export interface MessageRule {
  id: string;
  account_id: string;
  channel_account_id: string;
  name: string;
  trigger: MessageRuleTrigger;
  keywords: string[];
  excluded_keywords: string[];
  story_contains: string | null;
  ref: string | null;
  /** Link ig.me pronto; null sem ref ou username válido. */
  ref_link: string | null;
  ad_id: string | null;
  priority: number;
  is_active: boolean;
  actions: MessageRuleAction[];
  require_follow?: boolean;
  /** Até 1000 bytes; null remove. */
  non_follower_text?: string | null;
  created_at: string;
  updated_at: string;
}
export interface DeleteMessageRuleResult { id: string; deleted: true }
export interface CommentRuleMetricsParams {
  /** ISO 8601 com fuso; from deve ser anterior a to. */
  from: string;
  to: string;
}
export interface CommentRuleCounters {
  comments_matched: number;
  dms_delivered: number;
  public_replies: number;
  dm_touches: number;
  conversations_opened: number;
  /** Razão, não percentual; null sem DM entregue. Pode superar 1. */
  touch_rate: number | null;
}
export interface CommentRuleMetrics extends CommentRuleMetricsParams {
  rule_id: string;
  channel_account_id: string;
  totals: CommentRuleCounters;
  posts: (CommentRuleCounters & { media_id: string | null; live: boolean })[];
}

export interface InstagramIceBreaker {
  question: string;
  payload: string;
}

export type InstagramPersistentMenuItem =
  | { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

/** Até 4 perguntas e 5 itens no menu. */
export interface MessengerProfileConfig {
  ice_breakers: InstagramIceBreaker[];
  persistent_menu: InstagramPersistentMenuItem[];
}

/** Ausente preserva a seção; null ou [] remove. */
export interface UpdateMessengerProfileParams {
  ice_breakers?: InstagramIceBreaker[] | null;
  persistent_menu?: InstagramPersistentMenuItem[] | null;
}

/** Espelho desejado e confirmação de aplicação na Meta. */
export interface MessengerProfile {
  channel_account_id: string;
  config: MessengerProfileConfig;
  revision: number;
  sync_status: string;
  synced_at: string | null;
  last_error_code: number | null;
  updated_at: string | null;
}

/** Contas de canal e configurações do Instagram. */
export class ChannelAccounts {
  constructor(private readonly client: BotoZap) {}

  /** Lista as Contas de canal da conta (paginação por offset/página). numbers:read. */
  list(params: ListChannelAccountsParams = {}): Promise<OffsetList<ChannelAccount>> {
    return this.client.requestOffsetList<OffsetList<ChannelAccount>>(
      "GET",
      "/channel_accounts",
      {
        query: {
          page: params.page,
          per_page: params.per_page,
          channel: params.channel,
          customer_id: params.customer_id,
        },
      },
    );
  }

  /** Busca uma Conta de canal pelo UUID interno ou pelo id na Meta (`external_id`). numbers:read. */
  get(id: string): Promise<ChannelAccount> {
    return this.client.requestItem<ChannelAccount>("GET", `/channel_accounts/${enc(id)}`);
  }

  /** Estado e diagnóstico da conexão Instagram. numbers:read; sem sandbox. */
  getConnection(id: string): Promise<InstagramConnection> {
    return this.client.requestItem("GET", `/channel_accounts/${enc(id)}/connection`);
  }

  /** Reassina webhooks usando a autorização existente. numbers:write; sem sandbox. */
  resubscribeConnection(id: string): Promise<InstagramConnection> {
    return this.client.requestItem("POST", `/channel_accounts/${enc(id)}/connection/resubscribe`);
  }

  /** Desconecta a conta. numbers:write; por chave de API (OAuth: somente painel). */
  disconnect(id: string): Promise<InstagramConnection> {
    return this.client.requestItem("DELETE", `/channel_accounts/${enc(id)}/connection`);
  }

  /** QR do ref_link, PNG por padrão; 404 sem link. message-rules:read. */
  getMessageRuleQr(id: string, ruleId: string, params: MessageRuleQrParams = {}): Promise<ArrayBuffer> {
    return this.client.requestBinary("GET", `${messageRulesPath(id, ruleId)}/qr`, { query: { format: params.format } });
  }

  /** Lista as Regras de comentário de uma Conta do Instagram (UUID). comment-rules:read. */
  listCommentRules(
    channelAccountId: string,
    params: OffsetParams = {},
  ): Promise<OffsetList<CommentRule>> {
    return this.client.requestOffsetList<OffsetList<CommentRule>>(
      "GET",
      `/channel_accounts/${enc(channelAccountId)}/comment-rules`,
      { query: { page: params.page, per_page: params.per_page } },
    );
  }

  /** Busca uma Regra de comentário. comment-rules:read. */
  getCommentRule(channelAccountId: string, ruleId: string): Promise<CommentRule> {
    return this.client.requestItem<CommentRule>(
      "GET",
      `/channel_accounts/${enc(channelAccountId)}/comment-rules/${enc(ruleId)}`,
    );
  }

  /**
   * Cria uma Regra de comentário. comment-rules:write. Exige plano que inclua
   * Regras de comentário (senão 422 `plan_restricted`); palavra-chave repetida
   * para o mesmo alvo é 409 `duplicate_rule`.
   */
  createCommentRule(
    channelAccountId: string,
    params: CreateCommentRuleParams,
  ): Promise<CommentRule> {
    return this.client.requestItem<CommentRule>(
      "POST",
      `/channel_accounts/${enc(channelAccountId)}/comment-rules`,
      { body: params },
    );
  }

  /**
   * Altera uma Regra de comentário (só os campos enviados). comment-rules:write.
   * `is_active: false` desliga a regra.
   */
  updateCommentRule(
    channelAccountId: string,
    ruleId: string,
    params: UpdateCommentRuleParams,
  ): Promise<CommentRule> {
    return this.client.requestItem<CommentRule>(
      "PATCH",
      `/channel_accounts/${enc(channelAccountId)}/comment-rules/${enc(ruleId)}`,
      { body: params },
    );
  }
  /** Exclui uma Regra de comentário. comment-rules:write. */
  deleteCommentRule(channelAccountId: string, ruleId: string): Promise<DeleteCommentRuleResult> {
    return this.client.requestItem<DeleteCommentRuleResult>(
      "DELETE", `/channel_accounts/${enc(channelAccountId)}/comment-rules/${enc(ruleId)}`,
    );
  }

  /** Resultados da Regra por período e post. comment-rules:read. */
  getCommentRuleMetrics(channelAccountId: string, ruleId: string, params: CommentRuleMetricsParams): Promise<CommentRuleMetrics> {
    return this.client.requestItem<CommentRuleMetrics>("GET",
      `/channel_accounts/${enc(channelAccountId)}/comment-rules/${enc(ruleId)}/metrics`,
      { query: { from: params.from, to: params.to } });
  }

  /** Lista Regras de mensagem com paginação offset. message-rules:read. */
  listMessageRules(channelAccountId: string, params: OffsetParams = {}): Promise<OffsetList<MessageRule>> {
    return this.client.requestOffsetList<OffsetList<MessageRule>>("GET", messageRulesPath(channelAccountId),
      { query: { page: params.page, per_page: params.per_page } });
  }
  /** Busca uma Regra de mensagem. message-rules:read. */
  getMessageRule(channelAccountId: string, ruleId: string): Promise<MessageRule> {
    return this.client.requestItem<MessageRule>("GET", messageRulesPath(channelAccountId, ruleId));
  }
  /** Cria uma Regra de mensagem. message-rules:write. */
  createMessageRule(channelAccountId: string, params: CreateMessageRuleParams): Promise<MessageRule> {
    return this.client.requestItem<MessageRule>("POST", messageRulesPath(channelAccountId), { body: params });
  }
  /** PATCH parcial; a API valida o estado final. message-rules:write. */
  updateMessageRule(channelAccountId: string, ruleId: string, params: UpdateMessageRuleParams): Promise<MessageRule> {
    return this.client.requestItem<MessageRule>("PATCH", messageRulesPath(channelAccountId, ruleId), { body: params });
  }
  /** Exclui a Regra preservando Disparos e Eventos. message-rules:write. */
  deleteMessageRule(channelAccountId: string, ruleId: string): Promise<DeleteMessageRuleResult> {
    return this.client.requestItem<DeleteMessageRuleResult>("DELETE", messageRulesPath(channelAccountId, ruleId));
  }

  /** Lê o espelho salvo (sem consultar a Meta). messenger-profile:read; sem sandbox. */
  getMessengerProfile(channelAccountId: string): Promise<MessengerProfile> {
    return this.client.requestItem<MessengerProfile>("GET", profilePath(channelAccountId));
  }

  /** Salva/aplica apenas as seções enviadas. messenger-profile:write; sem sandbox. */
  updateMessengerProfile(channelAccountId: string, params: UpdateMessengerProfileParams): Promise<MessengerProfile> {
    return this.client.requestItem<MessengerProfile>("PATCH", profilePath(channelAccountId), { body: params });
  }

  /** Remove perguntas e menu, conservando configuração vazia. messenger-profile:write. */
  deleteMessengerProfile(channelAccountId: string): Promise<MessengerProfile> {
    return this.client.requestItem<MessengerProfile>("DELETE", profilePath(channelAccountId));
  }

  /** Verifica/reaplica explicitamente o desejado salvo. messenger-profile:write. */
  syncMessengerProfile(channelAccountId: string): Promise<MessengerProfile> {
    return this.client.requestItem<MessengerProfile>("POST", `${profilePath(channelAccountId)}/sync`);
  }
}

function profilePath(id: string): string {
  return `/channel_accounts/${enc(id)}/messenger-profile`;
}

function enc(id: string): string {
  return encodeURIComponent(id);
}

function messageRulesPath(id: string, ruleId?: string): string {
  return `/channel_accounts/${enc(id)}/message-rules${ruleId === undefined ? "" : `/${enc(ruleId)}`}`;
}
