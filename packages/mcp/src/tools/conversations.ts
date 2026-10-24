import {BotoZapError} from '../client.js';
import { sendIntentKey } from "../send-intent.js";
/** Ferramentas de conversas: listar, ler e atualizar status. */
import { z } from "zod";
import type { ListConversationsParams, RequestConsentParams } from "@botozap/sdk";
import { emptyOperationResult, type Register } from "../register.js";
import {
  consentRequestResultSchema,
  conversationResultSchema,
  emptyOperationResultSchema,
  conversationReadResultSchema,
  conversationTypingResultSchema,
  listConversationsResultSchema,
  fullSendMessageResultSchema,
} from "../schemas.js";

export function registerConversationTools(register: Register): void {
  register(
    "reply_to_conversation",
    "Recomendado: use prepare_send_intent uma vez e reutilize idempotency_key em retries. Recusas confirmadas liberam a chave; após aguardar/corrigir, repita com a mesma chave. Resultado desconhecido exige conferir o histórico. Chamadas sem chave continuam aceitas, com o comportamento anterior sem deduplicação. Responde uma Conversa com texto. Informe o UUID da Conversa e o corpo; o BotoZap resolve Contato e Número, e a API revalida Conta, ambiente, janela de 24h, quota e billing. Exige scopes conversations:read e messages:send.",
    {
      idempotency_key: sendIntentKey.optional(),
      conversation_id: z
        .string()
        .uuid()
        .describe("UUID interno da Conversa no BotoZap."),
      text: z
        .object({
          body: z.string().describe("Corpo da resposta de texto."),
        })
        .describe("Conteúdo da resposta."),
      reply_to_message_id: z
        .string()
        .trim()
        .min(1)
        .max(512)
        .optional()
        .describe("Responde citando esta mensagem da conversa: UUID interno ou wamid/mid da citada."),
    },
    fullSendMessageResultSchema,
    async (client, args) => {
      const id = String(args.conversation_id);
      const conversation = await client.conversations.get(id);
      const channelId=(conversation.channel_account as {id?:string}|null)?.id;
      const from=conversation.channel==='instagram'?channelId:conversation.phone_number_id;
      const to=conversation.contact?.wa_id||conversation.contact?.phone;
      if(!from||!to)throw new BotoZapError('conversation_recipient_unavailable','Conversa sem origem ou destinatário utilizável.',422);
      const quote=typeof args.reply_to_message_id==='string'?{reply_to:{message_id:args.reply_to_message_id}}:{};
      return client.messages.send({from,to,text:(args.text as {body:string}).body,...quote},{idempotencyKey:args.idempotency_key as string|undefined});
    },
  );

  register(
    "list_conversations",
    "Lista conversas da conta (paginação por cursor: { data, paging }). Filtros opcionais por número (ID Meta ou UUID interno), status e busca textual de contato.",
    {
      ig_follows_business: z.boolean().optional().describe("Filtra seguidores do Instagram; apenas valores conhecidos, null fica fora."),
      phone_number_id: z.string().optional().describe("Filtra pelo ID Meta ou UUID interno do número."),
      status: z.string().optional().describe("Filtra por status (active|ended)."),
      // A rota (/v1/conversations) casa por `contact`/`phone_number` (busca parcial
      // em nome/username/telefone/wa_id, INNER join em contacts). Não existe filtro
      // `contact_id` — por isso ele não é exposto aqui.
      contact: z.string().optional().describe("Busca parcial: nome, @username, telefone ou wa_id do contato."),
      phone_number: z.string().optional().describe("Alias de busca por contato (usado quando 'contact' não é informado)."),
      limit: z.number().int().positive().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    },
    listConversationsResultSchema,
    (client, args) => client.conversations.list(args as ListConversationsParams),
  );

  register(
    "get_conversation",
    "Busca uma conversa pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID da conversa (uuid interno).") },
    conversationResultSchema,
    async (client, args) => ({ data: await client.conversations.get(String(args.id)) }),
  );

  register(
    "update_conversation",
    "Atualiza o status de uma conversa. status='ended' fecha a janela de 24h; status='active' é no-op idempotente (a janela só reabre com novo inbound do contato).",
    {
      id: z.string().describe("ID da conversa (uuid interno)."),
      status: z.enum(["active", "ended"]).describe("Novo status da conversa."),
    },
    conversationResultSchema,
    async (client, args) => ({
      data: await client.conversations.update(String(args.id), { status: args.status }),
    }),
  );

  register(
    "conversation_typing",
    "Mostra \"digitando…\" ao contato enquanto você prepara a resposta, como o atendente digitando no painel. O sinal vai na última mensagem recebida do contato, que fica como lida (tiques azuis no WhatsApp, \"visto\" no Instagram); a Meta tira o indicador quando a resposta sai ou em cerca de 25 s. Repetir em menos de 20 s não chama a Meta de novo (repeated: true); numa resposta demorada, chame de novo a cada 20 s. Só existe em resposta a uma mensagem do contato com a janela de 24h aberta. Recusas: no_inbound_message (409, a conversa não tem mensagem recebida: template e primeira mensagem não têm), outside_window (WhatsApp) ou window_closed (Instagram) com a janela fechada, not_connected (409), meta_error (a resposta em si pode ser enviada normalmente). Exige scope messages:send. Retorna { data } com conversation_id, channel, typing e repeated.",
    { conversation_id: z.string().uuid().describe("UUID interno da Conversa.") },
    conversationTypingResultSchema,
    async (client, args) => ({ data: await client.conversations.typing(String(args.conversation_id)) }),
  );

  register(
    "mark_conversation_read",
    "Marca a conversa como lida, como abrir a conversa no painel: grava last_read_at (deixa de aparecer como não lida) e a última mensagem recebida fica como lida para o contato (tiques azuis no WhatsApp, \"visto\" no Instagram). A mesma mensagem não é marcada duas vezes na Meta; o aviso ao contato é de melhor esforço (canal desconectado ou recusa da Meta não mudam a resposta). No sandbox grava sem avisar a Meta. Exige scope conversations:write. Retorna { data } com conversation_id e last_read_at.",
    { conversation_id: z.string().uuid().describe("UUID interno da Conversa.") },
    conversationReadResultSchema,
    async (client, args) => ({ data: await client.conversations.markRead(String(args.conversation_id)) }),
  );

  register(
    "request_consent",
    "Envia ao contato o pedido de consentimento da conversa (o 'Pedir consentimento' do composer): botões no WhatsApp e respostas rápidas no Instagram. Vale para os dois canais; a resposta traz `channel`. Só funciona com a janela de 24h aberta e sai também para quem recusou marketing, que é o caminho de volta: o toque do contato grava o aceite (origem conversation_button). Envia uma mensagem real a uma pessoa: confirme com o usuário antes. Recusas: outside_window (WhatsApp) ou window_closed (Instagram) com a janela fechada; channel_not_supported (canal sem botões); not_connected (número desconectado); no_phone; invalid_recipient; account_deletion_in_progress. Se vier warnings com send_unrecorded, a Meta aceitou e o registro falhou: NÃO reenvie, o pedido já saiu. Não há chave de idempotência: em resultado incerto, confira o histórico da conversa antes de repetir. Exige scope messages:send. Retorna { data }.",
    {
      conversation_id: z.string().uuid().describe("UUID interno da Conversa."),
      purposes: z
        .array(z.enum(["marketing", "utility"]))
        .min(1)
        .optional()
        .describe("Finalidades pedidas ao contato. Padrão: [\"marketing\"]."),
      body: z
        .string()
        .min(1)
        .max(1024)
        .optional()
        .describe("Texto do pedido (até 1024 caracteres). Padrão: o texto padrão do BotoZap."),
    },
    consentRequestResultSchema,
    async (client, args) => {
      const { conversation_id, ...body } = args;
      return {
        data: await client.conversations.requestConsent(
          String(conversation_id),
          body as RequestConsentParams,
        ),
      };
    },
  );

  register(
    "delete_conversation",
    "Exclui a conversa SEM VOLTA e com efeito imediato: apaga as mensagens, as notas, as atribuições, os vínculos com oportunidades e demandas e o que a IA guardou dela, e apaga os arquivos de mídia que só ela usava. O contato fica, com a recusa e o consentimento. Ação destrutiva e irreversível: só execute com pedido explícito do usuário e confirmação. Só Administrador (no acesso por OAuth, o papel de administrador). Id inexistente, de outra Conta ou já excluído responde not_found. Exige scope conversations:write. Retorna { success: true }.",
    {
      id: z.string().uuid().describe("UUID interno da Conversa a excluir."),
    },
    emptyOperationResultSchema,
    async (client, args) => {
      await client.conversations.delete(String(args.id));
      return emptyOperationResult();
    },
  );
}
