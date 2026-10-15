/**
 * Contas de canal (WhatsApp e Instagram) e Regras de comentário do Instagram.
 *
 * Catálogo completo apenas: nenhuma destas tools entra no perfil `assistant`
 * (ver catalog-profile.ts), exceto `get_channel_account`, que já era helper de
 * tela desse perfil: definição (nome, descrição e schemas) preservada, e a
 * posição no catálogo também — com UI ela é registrada pelo painel de revisão;
 * sem UI, pelo servidor no mesmo ponto (ver server.ts).
 */
import { z } from "zod";
import type {
  CreateCommentRuleParams,
  CreateMessageRuleParams,
  UpdateMessageRuleParams,
  ListChannelAccountsParams,
  UpdateCommentRuleParams,
  UpdateMessengerProfileParams,
} from "@botozap/sdk";
import { imageToolResult, type Register } from "../register.js";
import {
  instagramConnectionResultSchema,
  messageRuleQrResultSchema,
  commentRuleMetricsResultSchema,
  messageRuleActionSchema,
  messageRuleTriggerSchema,
  messageRuleResultSchema,
  listMessageRulesResultSchema,
  deleteMessageRuleResultSchema,
  commentRuleResultSchema,
  deleteCommentRuleResultSchema,
  messengerProfileResultSchema,
  instagramIceBreakerSchema,
  instagramMenuItemSchema,
  listChannelAccountsResultSchema,
  listCommentRulesResultSchema,
} from "../schemas.js";

const channelAccountId = z
  .string()
  .uuid()
  .describe("UUID interno da Conta do Instagram (o `id` de list_channel_accounts).");
const ruleId = z.string().uuid().describe("UUID da Regra.");
const page = z.number().int().positive().optional().describe("Página (1-based).");
const perPage = z.number().int().positive().optional().describe("Itens por página (máx. 100).");

const followFields = {
  require_follow: z.boolean().optional().describe("Executa a entrega/ações somente para seguidores; ausente preserva no PATCH."),
  non_follower_text: z.string().nullable().optional().describe("Resposta para quem não segue; null remove. Comentários: obrigatório com require_follow (640 caracteres e botão); mensagens: opcional, até 1000 bytes."),
};
const ruleFields = {
  ...followFields,
  live: z.boolean().optional().describe("Durante lives; incompatível com media_id e next_post. Sem suporte no servidor: 422 feature_unavailable."),
  dm_button_title: z.string().nullable().optional().describe("Título do botão (20 caracteres); null remove. Com botão, dm_text aceita 640 caracteres. Só aparece no app Instagram."),
  delivery_text: z.string().nullable().optional().describe("Texto entregue após toque (1000 bytes); obrigatório com botão; null remove."),
  delivery_media: z.string().nullable().optional().describe("URL HTTPS pública de imagem, sem credenciais; null remove."),
  keywords: z.array(z.string()).optional().describe("Até 20 expressões de 60 caracteres; [] = qualquer comentário; prevalece sobre keyword."),
  excluded_keywords: z.array(z.string()).optional().describe("Até 20 expressões excluídas de 60 caracteres; [] limpa."),
  reply_variations: z.array(z.string()).optional().describe("Até 10 respostas públicas de 2200 caracteres; [] remove; prevalece sobre reply_text."),
  next_post: z.boolean().optional().describe("Aguarda o próximo post; não combinar true com media_id explícito."),
  keyword: z
    .string()
    .max(60)
    .nullable()
    .optional()
    .describe("Palavra-chave (até 60 caracteres); null ou vazio = qualquer comentário."),
  reply_text: z
    .string()
    .max(2200)
    .nullable()
    .optional()
    .describe("Resposta pública ao comentário (até 2200 caracteres); null ou vazio = sem resposta."),
  media_id: z
    .string()
    .nullable()
    .optional()
    .describe("Id numérico do post (media.id do evento instagram.comment.received, não o código da URL); null ou vazio = todos os posts."),
  is_active: z.boolean().optional().describe("Liga/desliga a regra (padrão true na criação)."),
} as const;

const messageRuleFields = {
  ...followFields,
  keywords: z.array(z.string()).optional().describe("Até 20 expressões de 60 caracteres; keyword exige ao menos uma."),
  excluded_keywords: z.array(z.string()).optional().describe("Só com keyword; até 20 exclusões de 60 caracteres."),
  story_contains: z.string().nullable().optional().describe("Só com story_reply; até 200 caracteres; null remove."),
  ref: z.string().nullable().optional().describe("Só com ref; 1–64 letras, dígitos, _ ou -. Ausente/null gera no servidor."),
  ad_id: z.string().nullable().optional().describe("Só com ad; 1–32 dígitos; null remove."),
  priority: z.number().int().optional().describe("0–1000; padrão 100; menor vence, depois criação/id."),
  is_active: z.boolean().optional().describe("Padrão true; false pausa a regra."),
};
const actions = z.array(messageRuleActionSchema).describe("1–5 ações, uma de cada tipo. agent exige exatamente agent_id ou router_id do respondedor publicado; tags exige add/remove. A API valida combinações e limites (422). Mensagem fixa: text (1000 bytes, quick_replies), mídia HTTPS ou interactive Instagram button/generic. Sem HUMAN_AGENT.");

/** `get_channel_account`: mesma definição publicada; o handler usa o SDK. */
export function registerGetChannelAccount(register: Register): void {
  register(
    "get_channel_account",
    "Consulta a conta de canal autorizada para resolver o negócio de uma conversa.",
    { id: z.string().uuid() },
    z.object({ data: z.record(z.unknown()) }),
    async (client, args) => ({ data: await client.channelAccounts.get(String(args.id)) }),
  );
}

export function registerChannelAccountTools(register: Register): void {
  register(
    "list_channel_accounts",
    "Lista as Contas de canal da conta — Números do WhatsApp e Contas do Instagram lado a lado (paginação offset: { data, meta }). O `id` (UUID) serve de `from` no envio e de `channel_account_id` em list_conversations; `external_id` é o id na Meta. Filtros opcionais por canal e cliente.",
    {
      channel: z.enum(["whatsapp", "instagram"]).optional().describe("Filtra pelo canal."),
      customer_id: z.string().uuid().optional().describe("Filtra pelas Contas de canal de um cliente."),
      page,
      per_page: perPage,
    },
    listChannelAccountsResultSchema,
    (client, args) => client.channelAccounts.list(args as ListChannelAccountsParams),
  );

  register("get_instagram_connection", "Lê estado, saúde e diagnóstico da conexão Instagram. numbers:read; sem sandbox.",
    { channel_account_id: channelAccountId }, instagramConnectionResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.getConnection(String(args.channel_account_id)) }));
  register("resubscribe_instagram_connection", "Refaz a assinatura dos webhooks com a autorização existente; não renova autorização. numbers:write; sem sandbox.",
    { channel_account_id: channelAccountId }, instagramConnectionResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.resubscribeConnection(String(args.channel_account_id)) }));
  register("disconnect_instagram_connection", "Desconecta a conta do Instagram (destrutivo). Chave de API; por OAuth, somente painel. numbers:write; sem sandbox.",
    { channel_account_id: channelAccountId }, instagramConnectionResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.disconnect(String(args.channel_account_id)) }));
  register("get_message_rule_qr", "Devolve o link ig.me e sua imagem QR em PNG. Regra sem ref_link: 404 not_found. message-rules:read.",
    { channel_account_id: channelAccountId, rule_id: ruleId }, messageRuleQrResultSchema,
    async (client, args) => {
      const id = String(args.channel_account_id), rule = String(args.rule_id);
      const linked = await client.channelAccounts.getMessageRule(id, rule);
      const png = await client.channelAccounts.getMessageRuleQr(id, rule, { format: "png" });
      return imageToolResult({ data: { ref_link: linked.ref_link } }, png);
    });

  register(
    "list_comment_rules",
    "Lista as Regras de comentário de uma Conta do Instagram (paginação offset: { data, meta }). Cada regra manda um direct (`dm_text`) para quem comenta a palavra-chave no post indicado; `status` é active, inactive ou paused_plan (ativa, mas pausada pelo plano).",
    { channel_account_id: channelAccountId, page, per_page: perPage },
    listCommentRulesResultSchema,
    (client, args) =>
      client.channelAccounts.listCommentRules(String(args.channel_account_id), {
        page: args.page as number | undefined,
        per_page: args.per_page as number | undefined,
      }),
  );

  register(
    "get_comment_rule",
    "Busca uma Regra de comentário de uma Conta do Instagram. Retorna { data }.",
    { channel_account_id: channelAccountId, rule_id: ruleId },
    commentRuleResultSchema,
    async (client, args) => ({
      data: await client.channelAccounts.getCommentRule(String(args.channel_account_id), String(args.rule_id)),
    }),
  );

  register(
    "create_comment_rule",
    "Cria uma Regra de comentário numa Conta do Instagram: a partir dela, cada comentário que casar recebe um direct automático (efeito externo real). Sem palavra-chave e sem post, a regra vale para TODO comentário em TODO post — a resposta traz `notice` avisando. Exige plano com Regras de comentário (422 plan_restricted); a mesma palavra-chave no mesmo alvo é 409 duplicate_rule. Retorna { data }.",
    {
      channel_account_id: channelAccountId,
      dm_text: z.string().min(1).describe("Abertura: 1000 bytes sem botão; 640 caracteres com botão."),
      ...ruleFields,
    },
    commentRuleResultSchema,
    async (client, args) => {
      const { channel_account_id, ...body } = args;
      return {
        data: await client.channelAccounts.createCommentRule(
          String(channel_account_id),
          body as unknown as CreateCommentRuleParams,
        ),
      };
    },
  );

  register(
    "update_comment_rule",
    "Altera uma Regra de comentário (só os campos enviados mudam). `is_active: false` desliga a regra; delete_comment_rule exclui. Ativar exige plano com Regras de comentário (422 plan_restricted). Retorna { data }.",
    {
      channel_account_id: channelAccountId,
      rule_id: ruleId,
      dm_text: z.string().min(1).optional().describe("Abertura: 1000 bytes sem botão; 640 caracteres com botão."),
      ...ruleFields,
    },
    commentRuleResultSchema,
    async (client, args) => {
      const { channel_account_id, rule_id, ...body } = args;
      if (Object.keys(body).length === 0) {
        throw new Error("Informe ao menos um campo para alterar.");
      }
      return {
        data: await client.channelAccounts.updateCommentRule(
          String(channel_account_id),
          String(rule_id),
          body as UpdateCommentRuleParams,
        ),
      };
    },
  );

  register(
    "delete_comment_rule",
    "Exclui uma Regra de comentário do Instagram. Retorna { data: { id, deleted: true } }.",
    { channel_account_id: channelAccountId, rule_id: ruleId },
    deleteCommentRuleResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.deleteCommentRule(
      String(args.channel_account_id), String(args.rule_id),
    ) }),
  );

  register("get_comment_rule_metrics", "Resultados da Regra por período e post; touch_rate é razão (pode superar 1), null sem DM entregue. comment-rules:read; from < to, ISO 8601 com fuso.",
    { channel_account_id: channelAccountId, rule_id: ruleId, from: z.string(), to: z.string() },
    commentRuleMetricsResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.getCommentRuleMetrics(String(args.channel_account_id), String(args.rule_id),
      { from: String(args.from), to: String(args.to) }) }));
  register("list_message_rules", "Lista Regras de mensagem do Instagram (paginação offset); message-rules:read.",
    { channel_account_id: channelAccountId, page, per_page: perPage }, listMessageRulesResultSchema,
    (client, args) => client.channelAccounts.listMessageRules(String(args.channel_account_id),
      { page: args.page as number | undefined, per_page: args.per_page as number | undefined }));
  register("get_message_rule", "Busca uma Regra de mensagem do Instagram; message-rules:read.",
    { channel_account_id: channelAccountId, rule_id: ruleId }, messageRuleResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.getMessageRule(String(args.channel_account_id), String(args.rule_id)) }));
  register("create_message_rule", "Cria uma Regra de mensagem. A primeira que casar vence; pode enviar mensagem e encaminhar ao agente publicado (efeitos externos reais). message-rules:write. A API valida combinações; 422 invalid_request, 409 duplicate_ref.",
    { channel_account_id: channelAccountId, name: z.string(), trigger: messageRuleTriggerSchema, actions, ...messageRuleFields }, messageRuleResultSchema,
    async (client, args) => {
      const { channel_account_id, ...body } = args;
      return { data: await client.channelAccounts.createMessageRule(String(channel_account_id), body as unknown as CreateMessageRuleParams) };
    });
  register("update_message_rule", "PATCH parcial de Regra de mensagem; ausente preserva. A API valida o estado final; is_active false pausa. message-rules:write.",
    { channel_account_id: channelAccountId, rule_id: ruleId, name: z.string().optional(), trigger: messageRuleTriggerSchema.optional(), actions: actions.optional(), ...messageRuleFields }, messageRuleResultSchema,
    async (client, args) => {
      const { channel_account_id, rule_id, ...body } = args;
      if (!Object.keys(body).length) throw new Error("Informe ao menos um campo para alterar.");
      return { data: await client.channelAccounts.updateMessageRule(String(channel_account_id), String(rule_id), body as UpdateMessageRuleParams) };
    });
  register("delete_message_rule", "Exclui a Regra preservando Disparos e Eventos; message-rules:write.",
    { channel_account_id: channelAccountId, rule_id: ruleId }, deleteMessageRuleResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.deleteMessageRule(String(args.channel_account_id), String(args.rule_id)) }));

  register(
    "get_instagram_messenger_profile",
    "Lê o espelho salvo de Perguntas e menu do Instagram, sem consultar a Meta. Sem sandbox; messenger-profile:read.",
    { channel_account_id: channelAccountId },
    messengerProfileResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.getMessengerProfile(String(args.channel_account_id)) }),
  );
  register(
    "update_instagram_messenger_profile",
    "Salva/aplica Perguntas e menu do Instagram. PATCH parcial: seção ausente preserva; null ou [] remove. Até 4 perguntas (80 caracteres) e 5 itens (título 20, payload 1000, URL http/https 2000). Sem sandbox; messenger-profile:write. A API valida os limites e pode devolver 422; falhas de sincronização conservam o desejado para retry explícito.",
    {
      channel_account_id: channelAccountId,
      ice_breakers: z.array(instagramIceBreakerSchema).nullable().optional().describe("Perguntas {question,payload}; null ou [] remove."),
      persistent_menu: z.array(instagramMenuItemSchema).nullable().optional().describe("Itens postback {title,payload} ou web_url {title,url}; null ou [] remove."),
    },
    messengerProfileResultSchema,
    async (client, args) => {
      const { channel_account_id, ...patch } = args;
      if (Object.keys(patch).length === 0) throw new Error("Informe ice_breakers e/ou persistent_menu.");
      return { data: await client.channelAccounts.updateMessengerProfile(
        String(channel_account_id), patch as UpdateMessengerProfileParams,
      ) };
    },
  );
  register(
    "delete_instagram_messenger_profile",
    "Remove perguntas e menu do Instagram; conserva configuração vazia para retries. Retorna o snapshot. Sem sandbox; messenger-profile:write.",
    { channel_account_id: channelAccountId },
    messengerProfileResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.deleteMessengerProfile(String(args.channel_account_id)) }),
  );
  register(
    "sync_instagram_messenger_profile",
    "Verifica/reaplica explicitamente Perguntas e menu salvos do Instagram. Exige configuração salva; não é um job periódico. Sem sandbox; messenger-profile:write.",
    { channel_account_id: channelAccountId },
    messengerProfileResultSchema,
    async (client, args) => ({ data: await client.channelAccounts.syncMessengerProfile(String(args.channel_account_id)) }),
  );

}
