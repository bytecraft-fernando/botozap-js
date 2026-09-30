import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { listCustomersResultSchema } from "../schemas.js";
import { registerScreenResource, screenMetadata } from "./screen-resource.js";
export const globalToolMetadata=()=>({...screenMetadata('global'),"openai/ui":{entrypoints:[{type:"global"}]}});
export function registerGlobalPanel(server:McpServer,register:Register) {
  registerScreenResource(server,register,'global');
  register('open_botozap','Abre Pendências no BotoZap. Links de conversa são conferidos pelas tools autorizadas; não envia mensagens.',{},
    z.object({account_id:z.string(),environment:z.enum(['live','sandbox']),customers:listCustomersResultSchema}).strict(),
    async(client,_args,identity)=>({account_id:identity.account_id,environment:identity.environment,customers:await client.customers.list({per_page:100})}));
}
