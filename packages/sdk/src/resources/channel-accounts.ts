import type { BotoZap } from "../client.js";
import type { MessageChannel, OffsetList, OffsetParams } from "../types.js";

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

/** Estado de uma Regra de comentário. `paused_plan`: ativa, mas pausada pelo plano. */
export type CommentRuleStatus = "active" | "inactive" | "paused_plan" | (string & {});

/**
 * Regra de comentário do Instagram: um comentário que casa `keyword` (ou
 * qualquer comentário, quando `null`) no post `media_id` (ou em todos, quando
 * `null`) recebe o direct `dm_text` e, opcionalmente, a resposta pública
 * `reply_text`.
 */
export interface CommentRule {
  id: string;
  channel_account_id: string;
  /** Palavra-chave (até 60 caracteres); `null` = qualquer comentário. */
  keyword: string | null;
  /** Texto do direct (até 1000 bytes). */
  dm_text: string;
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
  /** Palavra-chave; `null`/vazio = qualquer comentário. */
  keyword?: string | null;
  /** Resposta pública ao comentário; `null`/vazio = sem resposta. */
  reply_text?: string | null;
  /** Id numérico do post; `null`/vazio = todos os posts. */
  media_id?: string | null;
  /** Padrão `true`. */
  is_active?: boolean;
}

/** Corpo de `updateCommentRule` (PATCH): só os campos enviados mudam. */
export type UpdateCommentRuleParams = Partial<CreateCommentRuleParams>;

/** Contas de canal (WhatsApp e Instagram) e Regras de comentário do Instagram. */
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
   * `is_active: false` desliga a regra; não há exclusão pela API.
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
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
