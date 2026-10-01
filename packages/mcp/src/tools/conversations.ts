import {BotoZapError} from '../client.js';
import { sendIntentKey } from "../send-intent.js";
/** Ferramentas de conversas: listar, ler e atualizar status. */
import { z } from "zod";
import type { ListConversationsParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import {
  conversationResultSchema,
  listConversationsResultSchema,
  sendMessageResultSchema,
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
    },
    sendMessageResultSchema,
    async (client, args) => {
      const id = String(args.conversation_id);
      const conversation = await client.conversations.get(id);
      const channelId=(conversation.channel_account as {id?:string}|null)?.id;
      const from=conversation.channel==='instagram'?channelId:conversation.phone_number_id;
      const to=conversation.contact?.wa_id||conversation.contact?.phone;
      if(!from||!to)throw new BotoZapError('conversation_recipient_unavailable','Conversa sem origem ou destinatário utilizável.',422);
      return client.messages.send({from,to,text:(args.text as {body:string}).body},{idempotencyKey:args.idempotency_key as string|undefined});
    },
  );

  register(
    "list_conversations",
    "Lista conversas da conta (paginação por cursor: { data, paging }). Filtros opcionais por número (ID Meta ou UUID interno), status e busca textual de contato.",
    {
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
}
