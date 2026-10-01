import {isToolAllowed,getToolPolicy} from '../permissions.js';
import { uiContent, uiToolMetadata } from './versioned-ui.js';
import { registerLivePanel } from './live-panel.js';
import { registerGlobalPanel } from './global-panel.js';
import { registerTemplatePanel } from "./template-panel.js";
import { registerCasesPanel } from "./cases-panel.js";
import { registerBookingPanel } from "./booking-panel.js";
import { randomUUID } from "node:crypto";
/** Optional conversation review panel. No credential is embedded in its resource. */
import { registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OpenAIUiToolMetadata } from "@openai/mcp-extensions/server";
import { BotoZapError } from "../client.js";
import { z } from "zod";
import type { Register } from "../register.js";
import { conversationSchema, listCustomersResultSchema } from "../schemas.js";

export const radarToolMetadata = () => uiToolMetadata('radar-cards');
export const replyToolMetadata = () => uiToolMetadata('reply');
export const reviewToolMetadata = () => ({
  ...uiToolMetadata('review'),
  "openai/ui": { entrypoints: [{ type: "thread" }] } satisfies OpenAIUiToolMetadata,
});

export function registerReviewPanel(server: McpServer, register: Register): void {
  registerTemplatePanel(server, register);
  registerCasesPanel(server, register);
  registerBookingPanel(server, register);
  registerLivePanel(server, register);
  registerGlobalPanel(server, register);
  for (const view of ['review','reply','radar-cards'] as const) {
    const content=uiContent(view);
    const resource = registerAppResource(server, `botozap-${view}`, content.uri, {_meta:content._meta}, async () => {
      if (!register.uiEnabled) throw new BotoZapError("ui_not_allowed", "UI não habilitada para esta conta.", 403);
      return {contents:[content]};
    });
    register.onUiChange?.(enabled => {
      if (resource.enabled !== enabled) enabled ? resource.enable() : resource.disable();
    });
  }
  register('get_channel_account', 'Consulta a conta de canal autorizada para resolver o negócio de uma conversa.', {id:z.string().uuid()}, z.object({data:z.record(z.unknown())}), async(client,args)=>({data:await client.requestItem('GET',`/channel_accounts/${encodeURIComponent(String(args.id))}`)}));
  register(
    "stage_review_reply",
    "Prepara um rascunho editável no painel de revisão após confirmar acesso à conversa. Não envia mensagem.",
    { conversation_id: z.string().uuid(), text: z.string().min(1).max(4096) },
    z.object({
      customer_id: z.string().uuid(),
      conversation: conversationSchema,
      draft: z.object({ text: z.string(), idempotency_key: z.string().uuid() }).strict(),
    }).strict(),
    async (client, args, identity) => {
      const conversation = await client.conversations.get(String(args.conversation_id));
      if(conversation.channel==='instagram'&&!isToolAllowed(getToolPolicy('get_channel_account'),identity))throw new BotoZapError('forbidden_scope','Esta autorização não permite consultar a conta de canal.',403);
      const channelId=(conversation.channel_account as {id?:string}|null)?.id;
      const number = conversation.channel === 'instagram' && channelId
        ? await client.requestItem<{customer_id:string}>('GET', `/channel_accounts/${encodeURIComponent(channelId!)}`)
        : conversation.phone_number_id ? await client.phoneNumbers.get(conversation.phone_number_id) : null;
      if (!number) throw new BotoZapError('unsupported_channel', 'Conta de canal indisponível.', 422);
      if (!number.customer_id) throw new BotoZapError("missing_customer", "Não foi possível confirmar o cliente desta conversa.", 422);
      return { customer_id: number.customer_id, conversation, draft: { text: String(args.text), idempotency_key: randomUUID() } };
    },
  );
  register(
    "open_review_panel",
    "Abre o painel de revisão BotoZap e retorna a conta autorizada e uma página de clientes. Também pode ser usado sem interface visual.",
    {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
    },
    z.object({
      account_id: z.string(),
      account_name: z.string().optional(),
      environment: z.enum(["live", "sandbox"]),
      customers: listCustomersResultSchema,
    }).strict(),
    async (client, args, identity) => ({
      account_id: identity.account_id,
      ...(identity.account_name?{account_name:identity.account_name}:{}),
      environment: identity.environment,
      customers: await client.customers.list({
        page: args.page as number | undefined,
        per_page: args.per_page as number | undefined,
      }),
    }),
  );
}
