import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildServer,refreshServerIdentity,type ApiIdentity} from '../src/server.js';
import {fullAccessIdentity} from './helpers/identity.js';
import {MCP_TOOL_POLICIES} from '../src/permissions.js';
import {ASSISTANT_TOOLS,parseClientProfiles} from '../src/catalog-profile.js';
import {requestAuthContext} from '../src/auth-context.js';
vi.mock('node:fs/promises',async original=>({...await original<any>(),readFile:vi.fn(async()=>'<main id="app"></main>')}));
const clientId='e948ea06-d925-41b6-980c-d7ea3538a4ac';
const otherId='1ec8fa7c-f51a-44dd-88b2-b5696bc0b627';
const routes=[...new Set(Object.values(MCP_TOOL_POLICIES).flatMap(p=>p.requiredRoutes??[]))];
const oauth:ApiIdentity={...fullAccessIdentity,auth_type:'oauth',client_id:clientId,user_id:'operator',grant_id:'grant',allowed_routes:routes};
const clients:Client[]=[];
afterEach(async()=>{await Promise.all(clients.splice(0).map(c=>c.close()));vi.unstubAllEnvs();});
async function connect(identity:ApiIdentity=oauth,ui=true) {
 const fetch=vi.fn(async()=>Response.json({data:[]}));
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:ui,fetch},identity);
 const client=new Client({name:'profile',version:'1'},{capabilities:ui?{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}} as any:{}});
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);clients.push(client);return {server,client,fetch};
}
it('API keys keep the full catalog and descriptors independently of OAuth mappings',async()=>{
 const before=await connect(fullAccessIdentity,false);const original=(await before.client.listTools()).tools;
 vi.stubEnv('BOTOZAP_MCP_OAUTH_CLIENT_PROFILES',`${clientId}:assistant`);
 const after=await connect({...fullAccessIdentity,auth_type:'api_key',client_id:clientId},false);
 expect((await after.client.listTools()).tools).toEqual(original);expect(original.length).toBeGreaterThan(200);expect(original.some(t=>t.name==='create_webhook')).toBe(true);
});
it.each(['mapped','unmapped'])('OAuth %s sees the assistant catalog, all UI tools, and no administration',async mode=>{
 vi.stubEnv('BOTOZAP_MCP_OAUTH_CLIENT_PROFILES',mode==='mapped'?`${clientId}:assistant`:`${otherId}:full`);
 const {client,fetch}=await connect();const tools=(await client.listTools()).tools;expect(new Set(tools.map(t=>t.name))).toEqual(ASSISTANT_TOOLS);
 for(const tool of tools){expect(tool.description?.trim(),tool.name).toBeTruthy();expect(tool.annotations).toMatchObject({readOnlyHint:expect.any(Boolean),destructiveHint:expect.any(Boolean),openWorldHint:expect.any(Boolean)});}
 for(const name of ['send_message','reply_to_conversation','control_conversation_agent','ai_cases_update'])expect(tools.find(t=>t.name===name)?.annotations).toMatchObject({readOnlyHint:false,destructiveHint:true,openWorldHint:true});
 expect(tools.find(t=>t.name==='list_users')?._meta?.ui).toEqual({visibility:['app']});
 const denied=await client.callTool({name:'create_webhook',arguments:{}});expect(denied.isError).toBe(true);expect(fetch).not.toHaveBeenCalled();
});
it('explicit full profile is available for a mapped OAuth client, and refresh removes administration',async()=>{
 vi.stubEnv('BOTOZAP_MCP_OAUTH_CLIENT_PROFILES',`${clientId}:full`);const {client,server,fetch}=await connect();expect((await client.listTools()).tools.some(t=>t.name==='create_webhook')).toBe(true);
 refreshServerIdentity(server,{...oauth,client_id:otherId});expect((await client.listTools()).tools.some(t=>t.name==='create_webhook')).toBe(false);
 expect((await client.callTool({name:'create_webhook',arguments:{}})).isError).toBe(true);expect(fetch).not.toHaveBeenCalled();
 refreshServerIdentity(server,oauth);expect((await client.listTools()).tools.some(t=>t.name==='create_webhook')).toBe(true);
});
it('per-request identity cannot invoke a full-catalog tool under an assistant grant',async()=>{
 const {client,fetch}=await connect(fullAccessIdentity);const result=await requestAuthContext.run({credential:'oauth-test',identity:oauth},()=>client.callTool({name:'list_webhooks',arguments:{}}));expect(result.isError).toBe(true);expect(JSON.stringify(result.content)).toContain('não permite');expect(fetch).not.toHaveBeenCalled();
});
it('profile cannot grant missing scopes or routes, nor enable UI without host negotiation',async()=>{
 const limited=await connect({...oauth,scopes:['customers:read'],allowed_routes:['GET /v1/customers']},false);
 expect((await limited.client.listTools()).tools.map(t=>t.name)).toEqual(['list_customers','get_profile']);
});
it('validates UUID mappings and rejects unknown profiles, duplicates or malformed entries',()=>{
 expect(parseClientProfiles(` ${clientId}:assistant, ${otherId}:full `).get(otherId)).toBe('full');
 for(const value of ['not-uuid:full',`${clientId}:admin`,`${clientId}:full:extra`,`${clientId}:full,${clientId}:assistant`])expect(()=>parseClientProfiles(value)).toThrow('BOTOZAP_MCP_OAUTH_CLIENT_PROFILES');
});
it('all literal and dynamic browser calls are included in the assistant profile',()=>{
 const root=new URL('../web/',import.meta.url);
 const files=[...readdirSync(root).filter(n=>n.endsWith('.ts')).map(n=>new URL(n,root)),...readdirSync(new URL('screens/',root)).filter(n=>n.endsWith('.ts')).map(n=>new URL('screens/'+n,root))];
 const source=files.map(p=>readFileSync(p,'utf8')).join('\n');
 const calls=[...source.matchAll(/(?:call\(bridge,\s*|(?:bridge\.)?call\()\s*['"]([a-z_]+)['"]/g)].map(m=>m[1]);
 for(const name of [...calls,'get_demand','get_opportunity','list_demand_conversations','list_opportunity_conversations'])expect(ASSISTANT_TOOLS.has(name!),name).toBe(true);
});
