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
    async (client, args) => {
      const conversation = await client.conversations.get(String(args.conversation_id));
      if (!conversation.phone_number_id) throw new BotoZapError("unsupported_channel", "Selecione uma conversa WhatsApp.", 422);
      const number = await client.phoneNumbers.get(conversation.phone_number_id);
      const customer_id = typeof number.customer_id === "string" ? number.customer_id : null;
      if (!customer_id) throw new BotoZapError("missing_customer", "Negócio da conversa indisponível.", 422);
      const services = await client.appointments.services.list({ customer_id });
      const service = services.data.find(s => s.id === args.service_id && s.active);
      if (!service) throw new BotoZapError("invalid_service", "Selecione um serviço ativo deste negócio.", 422);
      const query = { customer_id, owner_user_id: String(args.owner_user_id), service_id: String(args.service_id), from: String(args.from), to: String(args.to) };
      return { conversation, customer_id, service, query, availability: await client.appointments.availability(query), meeting_requested: args.meeting_requested ?? false };
    });
}
