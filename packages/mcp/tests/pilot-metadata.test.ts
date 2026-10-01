import {afterEach,expect,it,vi} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildServer} from '../src/server.js';
import {fullAccessIdentity} from './helpers/identity.js';
import {uiDescription} from '../src/ui-routing.js';
vi.mock('node:fs/promises',async(importOriginal)=>({...await importOriginal<any>(),readFile:vi.fn(async()=>'<main id="app"></main>')}));
const clients:Client[]=[];
async function connect(enabled=true, identity:any=fullAccessIdentity){
 const fetch=vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input)),path=url.pathname;const rows=path.endsWith('/alerts')?[{id:'alert-'+url.searchParams.get('status'),status:url.searchParams.get('status')||'open',severity:'critical',kind:'manipulation_detected'}]:path.endsWith('/conversations')?[{id:'paused',contact:{name:'Marina'},agent_paused_at:'2026-09-30T12:00:00Z'}]:path.endsWith('/messages')?[{id:'latest',direction:'inbound',content:'Aguardando sua resposta',created_at:'2026-09-30T12:00:00Z'}]:[];return Response.json({data:rows,...(['/conversations','/messages'].some(s=>path.endsWith(s))?{paging:{next:null,previous:null}}:{}),meta:{page:1,per_page:100,total_count:rows.length,total_pages:1}});});
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:enabled,fetch},identity);
 const client=new Client({name:'pilot',version:'1'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}} as any});
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);clients.push(client);return {client,fetch};
}
afterEach(async()=>{await Promise.allSettled(clients.splice(0).map(c=>c.close()));vi.unstubAllEnvs();});
it('monitoring guidance is read-only on all relevant tools and absent without negotiated UI',async()=>{
 const {client}=await connect();const tools=(await client.listTools()).tools;
 for(const name of ['open_live_conversation','send_message','reply_to_conversation','stage_review_reply']){
  expect(tools.find(t=>t.name===name)?.description).toContain('usam SOMENTE open_live_conversation');
  expect(tools.find(t=>t.name===name)?.description).toContain('nunca enviar, reenviar ou preparar nova mensagem');
  expect(tools.find(t=>t.name===name)?.description).toContain('message_id é opcional');
  expect(uiDescription(name,'original',false)).toBe('original');
 }
});
it('negotiated follow-up tools describe one pending screen followed by the reply card, without empty-screen detours',async()=>{
 const {client}=await connect();const tools=(await client.listTools()).tools;
 for(const name of ['open_botozap','list_radar','open_review_panel','stage_review_reply']){
  const description=tools.find(t=>t.name===name)?.description;
  expect(description,name).toContain('open_botozap e list_radar são alternativas: nunca chame ambas na mesma resposta');
  expect(description,name).toContain('no máximo uma tela de Pendências e depois use stage_review_reply');
  expect(description,name).toContain('pedido principal é preparar resposta e o radar está vazio, vá direto a stage_review_reply');
  expect(description,name).toContain('list_customers, list_contacts ou list_conversations sem UI');
  expect(description,name).toContain('nem acrescente open_review_panel como tela de Pendências duplicada');
 }
});
it('follow-up guidance preserves original descriptions without UI and outside the pilot account',async()=>{
 for(const name of ['open_botozap','list_radar','open_review_panel','stage_review_reply'])expect(uiDescription(name,'Descrição original',false)).toBe('Descrição original');
 const off=await connect(false);const plain=(await off.client.listTools()).tools.find(t=>t.name==='list_radar')!.description;
 expect(plain).not.toContain('são alternativas');
 vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS','another-account');const blocked=await connect();
 expect((await blocked.client.listTools()).tools.find(t=>t.name==='list_radar')!.description).toBe(plain);
});
it('every UI resource carries standard and ChatGPT CSP with only first-party redirects',async()=>{
 const {client}=await connect();const resources=(await client.listResources()).resources.filter(r=>r.uri.startsWith('ui://'));expect(resources).toHaveLength(8);
 for(const resource of resources){expect(resource._meta?.['openai/ui']).toMatchObject({preferredDisplayMode:'inline'});const result=await client.readResource({uri:resource.uri});for(const content of result.contents){expect(content.text).toContain('data-initial-mode="inline"');expect(content._meta?.ui).toMatchObject({csp:{connectDomains:[],resourceDomains:[],frameDomains:[]}});expect(content._meta?.['openai/widgetCSP']).toEqual({connect_domains:[],resource_domains:[],frame_domains:[],redirect_domains:['https://botozap.com.br']});}}
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
it('agent inbox reads alerts, open cases and paused conversations scoped to the business',async()=>{
 const {client,fetch}=await connect();const result=await client.callTool({name:'open_agent_cases',arguments:{customer_id:'00000000-0000-4000-8000-000000000001'}});
 expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(result.structuredContent).toMatchObject({summary:{alerts_unresolved:2,alerts_by_status:{open:1,acknowledged:1},paused_conversations:1,open_cases:0},paused:{data:[{id:'paused',agent_paused_at:'2026-09-30T12:00:00Z'}]}});expect(JSON.parse((result.content as any)[0].text).summary.alerts_by_status.acknowledged).toBe(1);
 const urls=fetch.mock.calls.map(([input])=>new URL(String(input)));for(const status of ['open','acknowledged'])expect(urls.some(u=>u.pathname.endsWith('/alerts')&&u.searchParams.get('status')===status)).toBe(true);expect(urls.find(u=>u.pathname.endsWith('/cases'))?.searchParams.has('source')).toBe(false);
 const paused=urls.find(u=>u.pathname.endsWith('/conversations'))!;expect(paused.searchParams.get('agent_paused')).toBe('true');expect(paused.searchParams.get('customer_id')).toBe('00000000-0000-4000-8000-000000000001');expect(paused.searchParams.get('limit')).toBe('100');expect(result.structuredContent).toMatchObject({paused:{data:[{latest_customer_message:{content:'Aguardando sua resposta'}}]}});const preview=urls.find(u=>u.pathname.endsWith('/messages'))!;expect(preview.searchParams.get('direction')).toBe('inbound');expect(preview.searchParams.get('limit')).toBe('1');
});
it('OAuth cannot expose agent inbox without the alerts route',async()=>{
 const {client}=await connect(true,{...fullAccessIdentity,auth_type:'oauth',user_id:'user',client_id:'client',grant_id:'grant',allowed_routes:['GET /v1/ai/cases']});expect((await client.listTools()).tools.some(t=>t.name==='open_agent_cases')).toBe(false);
});
it('versioned tool URIs and compatibility aliases match only current registered resources',async()=>{
 const {client}=await connect();const resources=(await client.listResources()).resources.filter(r=>r.uri.startsWith('ui://'));const uris=new Set(resources.map(r=>r.uri));expect(uris.size).toBe(8);
 for(const resource of resources){expect(resource.uri).toMatch(/^ui:\/\/botozap\/[^/]+\/[a-f0-9]{10}\.html$/);expect(resource._meta?.['openai/widgetCSP']).toBeDefined();expect(resource._meta?.ui).toMatchObject({csp:{connectDomains:[],resourceDomains:[]}});const read=await client.readResource({uri:resource.uri});expect(read.contents[0].uri).toBe(resource.uri);expect(read.contents[0]._meta).toEqual(resource._meta);}
 for(const tool of (await client.listTools()).tools){const uri=(tool._meta?.ui as any)?.resourceUri;if(uri){expect(uris.has(uri),tool.name).toBe(true);expect(tool._meta?.['openai/outputTemplate']).toBe(uri);}}
 for(const view of ['review','reply','radar-cards','template','cases','booking','live','global'])await expect(client.readResource({uri:`ui://botozap/${view}/v1.html`})).rejects.toThrow();
});

it('agent inbox requires both conversations route and scope, in addition to alerts and cases',async()=>{
 const routes=['GET /v1/ai/cases','GET /v1/ai/alerts'];const oauth={...fullAccessIdentity,auth_type:'oauth',user_id:'user',client_id:'client',grant_id:'grant',allowed_routes:routes};
 const missingRoute=await connect(true,oauth),missingScope=await connect(true,{...oauth,allowed_routes:[...routes,'GET /v1/conversations','GET /v1/customers'],scopes:['agents:read']});
 for(const {client} of [missingRoute,missingScope])expect((await client.listTools()).tools.some(t=>t.name==='open_agent_cases')).toBe(false);
 const permitted=await connect(true,{...oauth,allowed_routes:[...routes,'GET /v1/conversations','GET /v1/customers'],scopes:['agents:read','conversations:read','customers:read']});expect((await permitted.client.listTools()).tools.some(t=>t.name==='open_agent_cases')).toBe(true);
});

it('read-only agent identity cannot expose resume and does not read unauthorized message previews',async()=>{const {client,fetch}=await connect(true,{...fullAccessIdentity,scopes:['agents:read','conversations:read','customers:read']});const result=await client.callTool({name:'open_agent_cases',arguments:{customer_id:'00000000-0000-4000-8000-000000000001'}});expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject({can_resume:false});expect(fetch.mock.calls.some(([input])=>new URL(String(input)).pathname.endsWith('/messages'))).toBe(false);});
