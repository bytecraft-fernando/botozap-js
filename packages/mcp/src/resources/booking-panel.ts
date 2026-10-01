import {isToolAllowed,getToolPolicy} from '../permissions.js';
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { BotoZapError } from "../client.js";
import { registerScreenResource } from "./screen-resource.js";
export function registerBookingPanel(server: McpServer, register: Register) {
  registerScreenResource(server, register, "booking");
  register("stage_appointment_booking", "Prepara horários disponíveis para a conversa, serviço e responsável escolhidos. Não marca nem envia aviso.",
    { conversation_id: z.string().uuid(), service_id: z.string().uuid(), owner_user_id: z.string().uuid(), from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }), meeting_requested: z.boolean().optional() },
    z.object({ conversation: z.record(z.unknown()), customer_id: z.string(), service: z.record(z.unknown()), query: z.record(z.unknown()), availability: z.unknown(), meeting_requested: z.boolean() }),
    async (client, args, identity) => {
      const conversation = await client.conversations.get(String(args.conversation_id));
      if(conversation.channel==='instagram'&&!isToolAllowed(getToolPolicy('get_channel_account'),identity))throw new BotoZapError('forbidden_scope','Esta autorização não permite consultar a conta de canal.',403);
      const channelId=(conversation.channel_account as {id?:string}|null)?.id;
      const number = conversation.channel==='instagram' && channelId ? await client.requestItem<{customer_id:string}>('GET',`/channel_accounts/${encodeURIComponent(channelId)}`) : conversation.phone_number_id ? await client.phoneNumbers.get(conversation.phone_number_id) : null;
      if(!number)throw new BotoZapError('unsupported_channel','Conta de canal indisponível.',422);
      const customer_id = typeof number.customer_id === "string" ? number.customer_id : null;
      if (!customer_id) throw new BotoZapError("missing_customer", "Negócio da conversa indisponível.", 422);
      const services = await client.appointments.services.list({ customer_id });
      const service = services.data.find(s => s.id === args.service_id && s.active);
      if (!service) throw new BotoZapError("invalid_service", "Selecione um serviço ativo deste negócio.", 422);
      const query = { customer_id, owner_user_id: String(args.owner_user_id), service_id: String(args.service_id), from: String(args.from), to: String(args.to) };
      return { conversation, customer_id, service, query, availability: await client.appointments.availability(query), meeting_requested: args.meeting_requested ?? false };
    });
}
