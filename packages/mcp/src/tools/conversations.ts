/** Ferramentas de conversas: listar, ler e atualizar status. */
import { z } from "zod";
import type { ListConversationsParams } from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerConversationTools(register: Register): void {
  register(
    "list_conversations",
    "Lista conversas da conta (paginação por cursor: { data, paging }). Filtros opcionais por número e por busca textual de contato.",
    {
      phone_number_id: z.string().optional().describe("Filtra pelo phone_number_id (Meta)."),
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
    (client, args) => client.conversations.list(args as ListConversationsParams),
  );

  register(
    "get_conversation",
    "Busca uma conversa pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID da conversa (uuid interno).") },
    async (client, args) => ({ data: await client.conversations.get(String(args.id)) }),
  );

  register(
    "update_conversation",
    "Atualiza o status de uma conversa. status='ended' fecha a janela de 24h; status='active' é no-op idempotente (a janela só reabre com novo inbound do contato).",
    {
      id: z.string().describe("ID da conversa (uuid interno)."),
      status: z.enum(["active", "ended"]).describe("Novo status da conversa."),
    },
    async (client, args) => ({
      data: await client.conversations.update(String(args.id), { status: args.status }),
    }),
  );
}
