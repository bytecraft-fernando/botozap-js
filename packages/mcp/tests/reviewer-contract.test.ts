import {afterEach,expect,it,vi} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildServer} from '../src/server.js';
import {fullAccessIdentity} from './helpers/identity.js';
import {reviewerContract as fixture} from './fixtures/app-reviewer.js';
vi.mock('node:fs/promises',async original=>({...await original<any>(),readFile:vi.fn(async()=>'<main id="app"></main>')}));
const sentByClient=new WeakMap<Client,any[]>();
const clients:Client[]=[];afterEach(async()=>{await Promise.all(clients.splice(0).map(c=>c.close()));});
async function connect(additive=false){
 const add=(r:any)=>additive?{...r,future_public_field:{enabled:true}}:r;
 const paging={cursors:{before:null,after:null},next:null,previous:null,...(additive?{future_cursor_field:true}:{})};
 const sends:any[]=[];
 const fetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const path=new URL(String(input)).pathname;
  if(path.endsWith('/messages')&&init?.method==='POST'){const payload=JSON.parse(String(init.body));sends.push({...payload,key:new Headers(init.headers).get('idempotency-key')});return Response.json({id:fixture.messages[0]!.id,wamid:'mid.fixture',to:payload.to,status:'accepted'});}
  if(path.endsWith('/me'))return Response.json({data:{...fullAccessIdentity,account_name:fixture.account_name}});
  if(path.includes('/channel_accounts/'))return Response.json({data:{id:fixture.contacts[10]!.channel_account!.id,channel:'instagram',customer_id:fixture.customers[0]!.id,display:'@negocio_revisor'}});
  if(path.endsWith('/messages'))return Response.json({data:fixture.messages,paging});
  if(path.endsWith('/customers'))return Response.json({data:fixture.customers.map(add),meta:add(fixture.meta)});
  if(path.includes('/contacts'))return Response.json(path.endsWith('/contacts')?{data:fixture.contacts.map(add),paging}:{data:add(fixture.contacts[0])});
  if(path.includes('/conversations'))return Response.json(path.endsWith('/conversations')?{data:fixture.conversations.map(c=>add({...c,contact:add(c.contact)})),paging}:{data:add({...fixture.conversations.find(c=>path.endsWith(c.id))??fixture.conversations[0],contact:add((fixture.conversations.find(c=>path.endsWith(c.id))??fixture.conversations[0])!.contact)})});
  if(path.includes('/phone_numbers/'))return Response.json({data:{id:fixture.conversations[0]!.phone_number_id,customer_id:fixture.customers[0]!.id}});
  if(path.endsWith('/radar'))return Response.json(add(fixture.radar));
  throw new Error('Unexpected '+path);
 });
 const server=await buildServer({apiKey:'bz_live_test',baseUrl:'https://api.test/v1',uiEnabled:true,fetch},{...fullAccessIdentity,account_name:fixture.account_name});
 const client=new Client({name:'reviewer-contract',version:'1'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}} as any});
 const [ct,st]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(st),client.connect(ct)]);clients.push(client);sentByClient.set(client,sends);return client;
}
const calls:[string,Record<string,unknown>][]=[['get_profile',{}],['get_channel_account',{id:fixture.contacts[10]!.channel_account!.id}],['list_messages',{}],['list_contacts',{}],['get_contact',{id:fixture.contacts[0]!.id}],['list_conversations',{}],['get_conversation',{id:fixture.conversations[0]!.id}],['list_customers',{}],['open_botozap',{}],['open_review_panel',{}],['list_radar',{customer_id:fixture.customers[0]!.id}],['stage_review_reply',{conversation_id:fixture.conversations[0]!.id,text:'Olá, posso ajudar?'}]];
it.each(calls)('SDK client validates actual serialized reviewer contract for %s',async(name,args)=>{const client=await connect();const result=await client.callTool({name,arguments:args});expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(result.structuredContent).toBeDefined();});
it.each(calls)('additive API fields do not break %s or its announced outputSchema',async(name,args)=>{const client=await connect(true);const result=await client.callTool({name,arguments:args});expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(JSON.stringify(result.structuredContent)).not.toContain('future_cursor_field');});

it.each([0,2,10])('reply review preserves real identity/channel for contact %s',async index=>{const client=await connect();const c=fixture.conversations[index]!;const result=await client.callTool({name:'stage_review_reply',arguments:{conversation_id:c.id,text:'Olá'}});expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(result.structuredContent).toMatchObject({conversation:{channel:c.channel,phone_number_id:c.phone_number_id,contact:{wa_id:c.contact.wa_id}}});});
it('Instagram template UI gives an explanation without a tool error',async()=>{const client=await connect();const result=await client.callTool({name:'stage_review_template',arguments:{conversation_id:fixture.conversations[10]!.id}});expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject({conversation:{channel:'instagram'}});});

it.each([0,2,10])('confirmed tool reply uses canonical recipient without requiring phone for contact %s',async index=>{const client=await connect();const c=fixture.conversations[index]!;const key='00000000-0000-4000-8000-000000000900';const result=await client.callTool({name:'reply_to_conversation',arguments:{conversation_id:c.id,text:{body:'Olá'},idempotency_key:key}});expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(sentByClient.get(client)).toEqual([{from:c.channel==='instagram'?c.channel_account!.id:c.phone_number_id,to:c.contact.wa_id,type:'text',text:{body:'Olá'},key}]);});
