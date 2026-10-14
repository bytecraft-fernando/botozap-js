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
  ListChannelAccountsParams,
  UpdateCommentRuleParams,
  UpdateMessengerProfileParams,
} from "@botozap/sdk";
import type { Register } from "../register.js";
import {
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
const ruleId = z.string().uuid().describe("UUID da Regra de comentário.");
const page = z.number().int().positive().optional().describe("Página (1-based).");
const perPage = z.number().int().positive().optional().describe("Itens por página (máx. 100).");

const ruleFields = {
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
      dm_text: z.string().min(1).describe("Direct enviado a quem comentou (até 1000 bytes)."),
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
      dm_text: z.string().min(1).optional().describe("Direct enviado a quem comentou (até 1000 bytes)."),
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
