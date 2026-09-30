import {afterEach,expect,it,vi} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildServer} from '../src/server.js';
import {readLiveConversation} from '../src/resources/live-panel.js';
import {fullAccessIdentity} from './helpers/identity.js';
import {conversationId,conversation,customerId} from '../web/demo-data.js';
const clients:Client[]=[];
async function connect(enabled=true,ui=true,identity=fullAccessIdentity){
 const fetch=vi.fn(async()=>Response.json({data:[],meta:{page:1,per_page:100,total_count:0,total_pages:1}}));
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:enabled,fetch},identity);
 const client=new Client({name:'3b',version:'1'},{capabilities:ui?{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}}as any:{}});
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);clients.push(client);return {client,fetch};
}
afterEach(async()=>{vi.unstubAllEnvs();await Promise.allSettled(clients.splice(0).map(c=>c.close()));});
it('new tools and resources need flags, account and negotiated MCP Apps',async()=>{
 for(const [enabled,ui]of [[false,true],[true,false]]){const h=await connect(enabled,ui);expect((await h.client.listTools()).tools.map(t=>t.name)).not.toEqual(expect.arrayContaining(['open_live_conversation','open_botozap']));expect((await h.client.listResources()).resources.some(r=>r.uri.includes('/live/')||r.uri.includes('/global/'))).toBe(false);}
 const h=await connect();const tools=(await h.client.listTools()).tools;
 for(const name of ['open_live_conversation','open_botozap'])expect(tools.find(t=>t.name===name)?.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,openWorldHint:false});
 expect(tools.find(t=>t.name==='open_botozap')).toMatchObject({title:'Pendências',_meta:{'openai/ui':{entrypoints:[{type:'global'}]}}});
 expect((await h.client.callTool({name:'open_botozap',arguments:{}})).isError).not.toBe(true);
 vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS','other');const denied=await connect();expect((await denied.client.listTools()).tools.map(t=>t.name)).not.toContain('open_botozap');
});
it('event helper requires all exact OAuth read routes and scopes',async()=>{
 const h=await connect(true,true,{...fullAccessIdentity,auth_type:'oauth',allowed_routes:['GET /v1/customers'],user_id:customerId,client_id:'client',grant_id:'grant'} as any);
 const tools=(await h.client.listTools()).tools;expect(tools.map(t=>t.name)).not.toContain('open_live_conversation');expect(tools.map(t=>t.name)).toContain('open_botozap');
 const limited=await connect(true,true,{...fullAccessIdentity,scopes:fullAccessIdentity.scopes.filter(s=>s!=='events:read')});expect((await limited.client.listTools()).tools.map(t=>t.name)).not.toContain('open_live_conversation');
});
it('filters account-wide events and messages, retains stream cursor, ignores other receipts',async()=>{
 const at='2026-09-30T12:00:00Z',id='00000000-0000-4000-8000-000000000090';
 const client={conversations:{get:vi.fn(async()=>conversation())},messages:{list:vi.fn(async()=>({data:[{id,wamid:'wamid.mine',conversation_id:conversationId,direction:'outbound',status:'read',created_at:at},{id:'reply',conversation_id:conversationId,direction:'inbound',created_at:at,content:{text:{body:'<script>client</script>'}}},{id:'old',conversation_id:conversationId,direction:'inbound',created_at:'2020-01-01T00:00:00Z',content:{body:'old'}},{id:'other',conversation_id:customerId,direction:'inbound',created_at:at,content:{body:'secret'}}]}))},events:{list:vi.fn(async()=>({data:[{id:'other-event',type:'whatsapp.message.read',message_resource_id:'other',occurred_at:at,data:{secret:'leak'}},{id:'typing-other',type:'whatsapp.typing',occurred_at:at,data:{conversation_id:customerId}},{id:'typing',type:'whatsapp.typing',occurred_at:at,data:{conversation_id:conversationId}}],paging:{cursor:'900',has_more:true,next:'next'}}))}};
 const result=await readLiveConversation(client as any,conversationId,'42','wamid.mine');
 expect(result).toMatchObject({cursor:'900',has_more:true});expect(result.events.map(e=>e.kind)).toEqual(['sent','delivered','read','reply','typing']);expect(JSON.stringify(result)).not.toMatch(/secret|other-event|typing-other|old/);expect(client.events.list).toHaveBeenCalledWith({after:'42',limit:100});expect(client.messages.list).toHaveBeenCalledWith({conversation_id:conversationId,limit:100});
 client.conversations.get.mockRejectedValueOnce(new Error('forbidden'));await expect(readLiveConversation(client as any,conversationId,'0')).rejects.toThrow('forbidden');expect(client.events.list).toHaveBeenCalledTimes(1);
});
