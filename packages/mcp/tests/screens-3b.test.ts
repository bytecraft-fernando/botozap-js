// @vitest-environment happy-dom
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {parseDeepLink,mountGlobal} from '../web/screens/global.js';
import {mountLive} from '../web/screens/live.js';
import {conversationId,conversation,bootstrap,customerId} from '../web/demo-data.js';
beforeEach(()=>{document.body.innerHTML='<div id="app"></div>';HTMLElement.prototype.scrollIntoView=vi.fn();});
afterEach(()=>vi.useRealTimers());
it('strictly parses home, UUID conversation and typed pending routes',()=>{
 expect(parseDeepLink('/')).toEqual({kind:'home'});expect(parseDeepLink(`/conversa/${conversationId}`)).toEqual({kind:'conversa',id:conversationId});expect(parseDeepLink(`/pendencia/${conversationId}?type=demand`)).toMatchObject({kind:'pendencia',entity:'demand'});
 for(const value of [undefined,'https://evil.test','//evil.test','/conversa/invalid',`/conversa/${conversationId}#fragment`,`/conversa/${conversationId}?type=demand`,`/CONVERSA/${conversationId}?type=demand`,`/conversa/${conversationId}?path=other`,`/%2e%2e/conversa/${conversationId}`,`/../conversa/${conversationId}`,`/conversa/${conversationId}?type=demand&type=opportunity`])expect(parseDeepLink(value)).toBeNull();
});
it('deep link authorization failure does not load history or stage a draft',async()=>{
 const call=vi.fn(async(name:string)=>{if(name==='get_conversation')return {isError:true};return {structuredContent:bootstrap};});
 const screen=mountGlobal(document.querySelector('#app')!,{call,context:vi.fn(async()=>{})});screen.bootstrap({structuredContent:bootstrap});screen.hostContext({'openai/deepLink':{url:`/conversa/${conversationId}`}});
 await vi.waitFor(()=>expect(document.body.textContent).toContain('Confira seu acesso'));expect(call.mock.calls.map(([name])=>name)).not.toContain('list_messages');screen.dispose();
});
it('invalid and missing deep links call no conversation tool',()=>{
 const call=vi.fn();const screen=mountGlobal(document.querySelector('#app')!,{call,context:vi.fn(async()=>{})});screen.hostContext({});screen.hostContext({'openai/deepLink':{url:'/conversa/not-uuid'}});expect(call).not.toHaveBeenCalled();screen.dispose();
});
it('polls adaptively, refuses foreign conversation results and stops on teardown',async()=>{
 vi.useFakeTimers();const call=vi.fn(async()=>({structuredContent:{conversation_id:conversationId,session_active:true,cursor:'2',events:[]}}));const mode=vi.fn(async()=>({mode:'inline'}));
 const live=mountLive(document.querySelector('#app')!,{call,context:vi.fn(async()=>{}),liveDisplayMode:mode});live.input({conversation_id:conversationId,message_id:'wamid.test'});live.bootstrap({structuredContent:{conversation_id:conversationId,session_active:true,cursor:'1',events:[]}});
 await vi.advanceTimersByTimeAsync(2000);expect(call).toHaveBeenCalledWith('open_live_conversation',{conversation_id:conversationId,message_id:'wamid.test',after:'1'});await vi.advanceTimersByTimeAsync(4000);expect(call).toHaveBeenCalledTimes(1);
 live.bootstrap({structuredContent:{conversation_id:customerId,session_active:false,cursor:'999',events:[]}});expect(document.body.textContent).not.toContain('Encerrado');live.dispose();await vi.advanceTimersByTimeAsync(60000);expect(call).toHaveBeenCalledTimes(1);
});
it('ends a session automatically and renders client text safely',()=>{
 const live=mountLive(document.querySelector('#app')!,{call:vi.fn(),context:vi.fn(async()=>{}),liveDisplayMode:vi.fn(async()=>({mode:'inline'}))});live.input({conversation_id:conversationId});live.bootstrap({structuredContent:{conversation_id:conversationId,session_active:false,cursor:'2',events:[{id:'reply',kind:'reply',at:new Date().toISOString(),text:'<img onerror=alert(1)>'}]}});expect(document.querySelector('img')).toBeNull();expect(document.body.textContent).toContain('Encerrado');live.dispose();
});

it('opens authorized history and handles a later host deep link without trusting the path',async()=>{
 const root=document.querySelector<HTMLElement>('#app')!;root.dataset.mode='inline';
 const call=vi.fn(async(name:string)=>({structuredContent:name==='get_conversation'?{data:conversation()}:name==='get_phone_number'?{data:{customer_id:customerId}}:name==='list_messages'?{data:[{id:'new',direction:'inbound',content:{text:{body:'Última resposta autorizada'}},created_at:new Date().toISOString()}],paging:{next:null}}:name==='list_radar'?{data:[],meta:{page:1,total_pages:1}}:bootstrap}));
 const screen=mountGlobal(root,{call,context:vi.fn(async()=>{})});expect(root.dataset.mode).toBeUndefined();screen.bootstrap({structuredContent:bootstrap});screen.setMode('fullscreen');screen.hostContext({'openai/deepLink':{url:`/conversa/${conversationId}`}});
 await vi.waitFor(()=>expect(document.querySelector('#history')?.textContent).toContain('Última resposta autorizada'));expect(call.mock.calls.map(([name])=>name)).toContain('get_phone_number');
 screen.hostContext({theme:'dark'});expect(document.querySelector('#history')?.textContent).toContain('Última resposta autorizada');screen.hostContext({'openai/deepLink':{url:'/'}});expect(document.querySelector('#history')?.textContent).not.toContain('Última resposta autorizada');screen.dispose();
});
