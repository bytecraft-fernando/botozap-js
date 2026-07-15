/** Ferramentas de webhooks (assinaturas de eventos de saída) e entregas. */
import { z } from "zod";
import type {
  CreateWebhookParams,
  CursorParams,
  ListWebhookDeliveriesParams,
} from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerWebhookTools(register: Register): void {
  register(
    "list_webhooks",
    "Lista os endpoints de webhook da conta (paginação por cursor: { data, paging }).",
    {
      limit: z.number().int().positive().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    },
    (client, args) => client.webhooks.list(args as CursorParams),
  );

  register(
    "get_webhook",
    "Busca um webhook pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do webhook (uuid interno).") },
    async (client, args) => ({ data: await client.webhooks.get(String(args.id)) }),
  );

  register(
    "create_webhook",
    "Cria um endpoint de webhook. `url` precisa ser https. `events` é a lista de tipos de evento assinados (ao menos um). Retorna { data }.",
    {
      url: z.string().describe("URL https do endpoint."),
      events: z.array(z.string()).describe("Tipos de evento assinados."),
      active: z.boolean().optional().describe("Ativo (default true)."),
    },
    async (client, args) => ({
      data: await client.webhooks.create(args as CreateWebhookParams),
    }),
  );

  register(
    "update_webhook",
    "Atualiza um webhook (url, events, active). Retorna { data }.",
    {
      id: z.string().describe("ID do webhook (uuid interno)."),
      url: z.string().optional(),
      events: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    },
    async (client, args) => {
      const { id, ...body } = args;
      return { data: await client.webhooks.update(String(id), body) };
    },
  );

  register(
    "delete_webhook",
    "Exclui um webhook pelo id (uuid interno).",
    { id: z.string().describe("ID do webhook (uuid interno).") },
    async (client, args) => {
      await client.webhooks.delete(String(args.id));
      return null;
    },
  );

  register(
    "test_webhook",
    "Dispara um evento de teste assinado para o endpoint de webhook informado. Retorna { data }.",
    { id: z.string().describe("ID do webhook (uuid interno).") },
    async (client, args) => ({ data: await client.webhooks.test(String(args.id)) }),
  );

  register(
    "list_webhook_deliveries",
    "Lista as entregas de webhook (tentativas de POST aos endpoints), com status e resposta. Paginação por cursor: { data, paging }.",
    {
      webhook_id: z.string().optional().describe("Filtra por endpoint (alias de endpoint_id na rota)."),
      status: z.string().optional().describe("Filtra por status da entrega (pending|success|failed|exhausted)."),
      event_type: z.string().optional().describe("Filtra pelo tipo de evento da entrega."),
      limit: z.number().int().positive().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    },
    (client, args) => client.webhookDeliveries.list(args as ListWebhookDeliveriesParams),
  );
}
