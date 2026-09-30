import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import type { Client } from "../client.js";
import { BotoZapError } from "../client.js";
import { registerScreenResource } from "./screen-resource.js";

const eventSchema = z.object({ id:z.string(), at:z.string(), kind:z.enum(["sent","delivered","read","typing","reply"]), text:z.string().optional() });
/** Never return the account-wide event payload. Join only to authorized conversation messages. */
export async function readLiveConversation(client: Client, id: string, after: string, messageId?: string) {
  const conversation = await client.conversations.get(id);
  if (conversation.id !== id) throw new BotoZapError("invalid_conversation", "Conversa não confirmada.",403);
  const messages = (await client.messages.list({conversation_id:id,limit:100})).data.filter(m=>m.conversation_id===id);
  const page = await client.events.list({after,limit:100});
  const events: Array<z.infer<typeof eventSchema>> = [];
  const receipt = messages.find(m=>m.direction==='outbound' && (m.id===messageId || m.wamid===messageId));
  for (const message of messages) {
    const at = message.created_at;
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) continue;
    if (message.direction==='inbound' && receipt?.created_at && at>=receipt.created_at) {
      const content = message.content as Record<string, any>;
      const text = message.revoked_at ? 'Mensagem removida pelo remetente' : content?.text?.body ?? content?.body;
      events.push({id:`${message.id}:reply`,at,kind:'reply',text:typeof text==='string'?text.slice(0,500):'Mensagem recebida'});
    }
    if (message===receipt) {
      const level=['sent','delivered','read'].indexOf(String(message.status));
      for (const kind of (['sent','delivered','read'] as const).slice(0,level+1)) events.push({id:`${message.id}:${kind}`,at,kind});
    }
  }
  for (const event of page.data) {
    const message = messages.find(m=>m.id===event.message_resource_id || (m.wamid && (m.wamid===event.message_id || m.wamid===event.external_id)));
    // Only explicit, conversation-scoped typing events have no message receipt.
    if (event.type.endsWith('.typing') && event.data.conversation_id===id) events.push({id:event.id,at:event.occurred_at,kind:'typing'});
    if (message===receipt && receipt && ['delivered','read'].some(s=>event.type.endsWith(`.${s}`))) {
      events.push({id:event.id,at:event.occurred_at,kind:event.type.endsWith('.read')?'read':'delivered'});
    }
  }
  return {conversation_id:id,contact_name:conversation.contact?.name??'Contato',session_active:conversation.status==='active',cursor:page.paging.cursor,has_more:page.paging.has_more,events:events.sort((a,b)=>a.at.localeCompare(b.at)).slice(-100)};
}
export function registerLivePanel(server:McpServer,register:Register) {
  registerScreenResource(server,register,'live');
  register('open_live_conversation','Acompanha uma conversa autorizada após um envio aceito. Leitura com cursor, sem envio ou credenciais na UI.',
    {conversation_id:z.string().uuid(),after:z.string().regex(/^\d+$/).max(20).default('0'),message_id:z.string().min(1).max(512).optional()},
    z.object({conversation_id:z.string().uuid(),contact_name:z.string(),session_active:z.boolean(),cursor:z.string().regex(/^\d+$/),has_more:z.boolean(),events:z.array(eventSchema)}),
    (client,args)=>readLiveConversation(client,String(args.conversation_id),String(args.after),args.message_id as string|undefined));
}
