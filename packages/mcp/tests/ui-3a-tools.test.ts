import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server.js';
import { fullAccessIdentity } from './helpers/identity.js';
import { approvedTemplates, templateStage } from '../web/scenarios/template.js';
import { service, ownerId, query, slots } from '../web/scenarios/booking.js';
const clients:Client[]=[];
const helpers=['stage_review_template','review_template_variables','open_agent_cases','stage_appointment_booking'];
const elicitation=vi.fn(async(request:any)=>({action:'accept',content:{body_1:'Marina revisada',body_2:'40 lembranças'}}));
async function connect(enabled=true,identity:any=fullAccessIdentity,native=false){
 const fetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const path=new URL(String(input)).pathname;
 const data=path.includes('/conversations/')?templateStage().conversation:path.includes('/phone_numbers/')?templateStage().number:path.includes('/templates/')?approvedTemplates[0]:path.endsWith('/appointments/services')?[service]:path.endsWith('/appointments/availability')?{slots,time_zone:'America/Manaus',schedule_published:true}:[];
 return Response.json({data,meta:{page:1,per_page:20,total_count:Array.isArray(data)?data.length:1,total_pages:1}});});
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:enabled,fetch},identity);
 const client=new Client({name:'3a-test',version:'1'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']},...(native?{'openai/elicitation':{form:{}}}:{})}} as any});
 if(native)client.setRequestHandler(z.object({method:z.literal('openai/elicitation/create'),params:z.any()}),elicitation);
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);clients.push(client);return {client,fetch};
}
afterEach(async()=>{vi.unstubAllEnvs();elicitation.mockClear();await Promise.allSettled(clients.splice(0).map(c=>c.close()));});
it('all new helpers are UI-only, read-only and never accept account_id',async()=>{
 const off=await connect(false);const names=(await off.client.listTools()).tools.map(t=>t.name);for(const name of helpers)expect(names).not.toContain(name);
 const on=await connect();const tools=(await on.client.listTools()).tools;for(const name of helpers){const tool=tools.find(t=>t.name===name)!;expect(tool).toBeDefined();expect(tool.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,openWorldHint:false});expect(tool.inputSchema.properties).not.toHaveProperty('account_id');}
});
it('pilot restriction hides all new helpers and resources for another account',async()=>{
 vi.stubEnv('BOTOZAP_MCP_UI_ACCOUNTS','not-this-account');const h=await connect();for(const name of helpers)expect((await h.client.listTools()).tools.map(t=>t.name)).not.toContain(name);expect((await h.client.listResources()).resources.some(r=>r.uri.startsWith('ui://'))).toBe(false);
});
it('OAuth allowed_routes exposes only helpers whose exact reads are granted',async()=>{
 const h=await connect(true,{...fullAccessIdentity,auth_type:'oauth',user_id:ownerId,client_id:'client',grant_id:'grant',allowed_routes:['GET /v1/templates/:id']});const tools=(await h.client.listTools()).tools.map(t=>t.name);expect(tools).toContain('review_template_variables');for(const name of helpers.filter(n=>n!=='review_template_variables'))expect(tools).not.toContain(name);
});
it('template staging derives business from origin and makes only GETs',async()=>{
 const h=await connect();const r=await h.client.callTool({name:'stage_review_template',arguments:{conversation_id:templateStage().conversation.id}});expect(r.isError,JSON.stringify(r)).not.toBe(true);expect(r.structuredContent).toMatchObject({customer_id:templateStage().customer_id});expect(h.fetch.mock.calls.map(([,init])=>init?.method??'GET')).toEqual(['GET','GET']);
});
it('unsupported host gets editable fallback values without sending',async()=>{
 const h=await connect();const r=await h.client.callTool({name:'review_template_variables',arguments:{template_id:approvedTemplates[0]!.id,variables:{body_1:'Marina',body_2:'40 lembranças',ignored:'unused'}}});expect(r.isError,JSON.stringify(r)).not.toBe(true);expect(r.structuredContent).toEqual({supported:false,action:'unsupported',variables:{body_1:'Marina',body_2:'40 lembranças'}});expect(h.fetch.mock.calls).toHaveLength(1);
});
it('native host receives x-openai-suggestions in a form and returns reviewed variables',async()=>{
 const h=await connect(true,fullAccessIdentity,true);const r=await h.client.callTool({name:'review_template_variables',arguments:{template_id:approvedTemplates[0]!.id,variables:{body_1:'Marina',body_2:'40 lembranças'}}});expect(r.isError,JSON.stringify(r)).not.toBe(true);expect(r.structuredContent).toMatchObject({supported:true,action:'accept',variables:{body_1:'Marina revisada'}});expect(elicitation).toHaveBeenCalledTimes(1);expect(elicitation.mock.calls[0]![0].params.requestedSchema.properties.body_1).toMatchObject({'x-openai-suggestions':[{const:'Marina',title:'Marina'}]});expect(h.fetch.mock.calls.map(([,init])=>init?.method??'GET')).toEqual(['GET']);
});
it('booking staging reads service and availability without creating or messaging',async()=>{
 const h=await connect();const r=await h.client.callTool({name:'stage_appointment_booking',arguments:{conversation_id:templateStage().conversation.id,service_id:service.id,owner_user_id:ownerId,from:query.from,to:query.to}});expect(r.isError,JSON.stringify(r)).not.toBe(true);expect(h.fetch.mock.calls).toHaveLength(4);expect(h.fetch.mock.calls.map(([,init])=>init?.method??'GET')).toEqual(['GET','GET','GET','GET']);
});
