import {afterEach,expect,it,vi} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildServer} from '../src/server.js';
import {fullAccessIdentity} from './helpers/identity.js';
import {uiDescription} from '../src/ui-routing.js';
vi.mock('node:fs/promises',async(importOriginal)=>({...await importOriginal<any>(),readFile:vi.fn(async()=>'<main id="app"></main>')}));
const clients:Client[]=[];
async function connect(enabled=true, identity:any=fullAccessIdentity){
 const fetch=vi.fn(async(input:RequestInfo|URL)=>{const path=new URL(String(input)).pathname;const rows=path.endsWith('/alerts')?[{id:'alert',status:'open',severity:'critical',kind:'manipulation_detected'}]:[];return Response.json({data:rows,meta:{page:1,per_page:100,total_count:rows.length,total_pages:1}});});
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:enabled,fetch},identity);
 const client=new Client({name:'pilot',version:'1'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}} as any});
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);clients.push(client);return {client,fetch};
}
afterEach(async()=>{await Promise.allSettled(clients.splice(0).map(c=>c.close()));vi.unstubAllEnvs();});
it('every UI resource carries standard and ChatGPT CSP with only first-party redirects',async()=>{
 const {client}=await connect();const resources=(await client.listResources()).resources.filter(r=>r.uri.startsWith('ui://'));expect(resources).toHaveLength(8);
 for(const resource of resources){const result=await client.readResource({uri:resource.uri});for(const content of result.contents){expect(content._meta?.ui).toMatchObject({csp:{connectDomains:[],resourceDomains:[],frameDomains:[]}});expect(content._meta?.['openai/widgetCSP']).toEqual({connect_domains:[],resource_domains:[],frame_domains:[],redirect_domains:['https://botozap.com.br']});}}
});
it('UI invocation labels are Portuguese and within the host limit',async()=>{
 const {client}=await connect();for(const tool of (await client.listTools()).tools.filter(t=>(t._meta?.ui as any)?.resourceUri||t.name==='review_template_variables')){
  for(const key of ['openai/toolInvocation/invoking','openai/toolInvocation/invoked']){expect(typeof tool._meta?.[key],tool.name).toBe('string');expect(String(tool._meta?.[key]).length).toBeLessThanOrEqual(64);expect(tool._meta?.[key]).not.toMatch(/Opened|Opening/);}
 }
});
it('routing guidance exists only for negotiated pilot UI and preserves direct template creation',async()=>{
 const on=await connect(),off=await connect(false);const tools=(await on.client.listTools()).tools,plain=(await off.client.listTools()).tools;
 for(const name of ['send_message','reply_to_conversation','create_appointment','create_template','list_radar']){
  const current=tools.find(t=>t.name===name)!,original=plain.find(t=>t.name===name)!;expect(current.description).toContain('Pedido completo e explícito');expect(original.description).not.toContain('Pedido completo e explícito');expect(uiDescription(name,original.description!,false)).toBe(original.description);
 }
 expect(tools.find(t=>t.name==='create_template')?.description).toContain('continua direta');
 vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS','another-account');const blocked=await connect();expect((await blocked.client.listTools()).tools.find(t=>t.name==='send_message')?.description).toBe(plain.find(t=>t.name==='send_message')?.description);
});
it('agent inbox reads open alerts and all open cases without assuming paused conversations are enumerable',async()=>{
 const {client,fetch}=await connect();const result=await client.callTool({name:'open_agent_cases',arguments:{customer_id:'00000000-0000-4000-8000-000000000001'}});
 expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(result.structuredContent).toMatchObject({alerts:{data:[{kind:'manipulation_detected'}]},paused_available:false});
 const urls=fetch.mock.calls.map(([input])=>new URL(String(input)));expect(urls.some(u=>u.pathname.endsWith('/alerts')&&u.searchParams.get('status')==='open')).toBe(true);expect(urls.find(u=>u.pathname.endsWith('/cases'))?.searchParams.has('source')).toBe(false);
});
it('OAuth cannot expose agent inbox without the alerts route',async()=>{
 const {client}=await connect(true,{...fullAccessIdentity,auth_type:'oauth',user_id:'user',client_id:'client',grant_id:'grant',allowed_routes:['GET /v1/ai/cases']});expect((await client.listTools()).tools.some(t=>t.name==='open_agent_cases')).toBe(false);
});
