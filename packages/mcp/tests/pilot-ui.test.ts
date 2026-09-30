// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
import {mountReview} from '../web/panel.js';
import {mountCarousel} from '../web/carousel.js';
import {mountCases} from '../web/screens/cases.js';
import {quantity,relative} from '../web/ui-helpers.js';
import {pendingUrl} from '../web/pending-link.js';
const customer='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
const meta={page:1,total_pages:1,total_count:1};
const bootstrap={account_id:'pilot',environment:'live',customers:{data:[{id:customer,name:'Ateliê'}],meta}};
const pending={id,entity_type:'appointment',kind:'meeting',title:'Reunião',next_step:'Registrar comparecimento',contact_name:'Marina'};
const data=(structuredContent:any)=>({structuredContent});
beforeEach(()=>{document.body.innerHTML='';for(const key of Object.keys(document.body.dataset))delete document.body.dataset[key];HTMLElement.prototype.scrollIntoView=vi.fn();});
it('one business auto-selects and loads Radar, with correct singular and useful inline summary',async()=>{
 const call=vi.fn(async()=>data({data:[pending],meta}));const screen=mountReview(document.body,{call,context:vi.fn(async()=>{})});screen.bootstrap(data(bootstrap));screen.setMode('inline');
 await vi.waitFor(()=>expect(document.querySelectorAll('.radar-item')).toHaveLength(1));expect((document.querySelector('#business') as HTMLSelectElement).value).toBe(customer);expect(call).toHaveBeenCalledWith('list_radar',{customer_id:customer,page:1,per_page:20});expect(document.querySelector('#count')?.textContent).toBe('1 item');expect(document.querySelector('#expand-pendings')?.textContent).toBe('Abrir em tela cheia');expect(document.body.dataset.conversationOpen).toBe('false');
 (document.querySelector('.radar-item') as HTMLButtonElement).click();await vi.waitFor(()=>expect(document.body.dataset.unlinked).toBe('true'));expect(document.querySelector('#pending-detail')?.textContent).toContain('Registrar comparecimento');expect(document.querySelector('#pending-detail a')?.getAttribute('href')).toContain('/agenda?appointment_id=');expect(call.mock.calls.every(([name])=>!['list_messages','reply_to_conversation'].includes(name as string))).toBe(true);
});
it('non-conversation carousel item opens the app rather than asking to send a reply',async()=>{
 const openExternal=vi.fn(async()=>{}),message=vi.fn();mountCarousel(document.body,{call:vi.fn(),context:vi.fn(async()=>{}),openExternal,message}).bootstrap(data({data:[pending]}));expect(document.querySelector('#carousel-count')?.textContent).toBe('1 pendência');expect(document.querySelector('h1')?.textContent).toBe('Pendências');expect(document.querySelector('.pending-card button')).toBeNull();(document.querySelector('.pending-card a') as HTMLElement).click();expect(openExternal).toHaveBeenCalledWith(pendingUrl(pending));expect(message).not.toHaveBeenCalled();
});
it('pluralization shares one helper including day counts',()=>{expect(quantity(0,'item','itens')).toBe('0 itens');expect(quantity(1,'item','itens')).toBe('1 item');expect(quantity(2,'pendência','pendências')).toBe('2 pendências');expect(relative(new Date(Date.now()-25*3600000).toISOString())).toBe('há 1 dia');});
it('critical alert remains visible with no open cases and only offers review or first-party navigation',async()=>{
 const message=vi.fn(async()=>{}),call=vi.fn();mountCases(document.body,{call,context:vi.fn(async()=>{}),message}).bootstrap(data({cases:{data:[],meta:{total_count:0}},alerts:{data:[{id,status:'open',severity:'critical',kind_label:'Tentativa de manipulação',conversation_id:id,detail:'Confira as instruções do contato.'}],meta:{total_count:1}},paused_available:false,can_update:true}));
 await vi.waitFor(()=>expect(document.body.dataset.state).toBe('Alerta crítico'));expect(document.body.textContent).toContain('Tentativa de manipulação');expect(document.body.textContent).not.toContain('Nenhum caso');expect(document.body.textContent).toContain('ainda não são listadas');expect(document.querySelectorAll('button')).toHaveLength(1);(document.querySelector('button') as HTMLElement).click();expect(message).toHaveBeenCalled();expect(call).not.toHaveBeenCalled();
});
it('switching from a loading case to an alert cannot expose stale case takeover controls',async()=>{
 let resolveHistory!:(value:any)=>void;const history=new Promise(resolve=>{resolveHistory=resolve;});
 const call=vi.fn(async()=>history),message=vi.fn(async()=>{});
 mountCases(document.body,{call,context:vi.fn(async()=>{}),message}).bootstrap(data({cases:{data:[{id:'case',status:'open',title:'Desconto',conversation_id:id,created_at:new Date().toISOString(),revision:1}],meta:{total_count:1}},alerts:{data:[{id:'alert',title:'Alerta crítico',severity:'critical',status:'open',conversation_id:id}],meta:{total_count:1}},can_update:true,user_id:'operator'}));
 await vi.waitFor(()=>expect(document.body.dataset.state).toBe('Alerta crítico'));const choices=[...document.querySelectorAll('.case-choices button')] as HTMLButtonElement[];expect(choices[0].textContent).toContain('Crítico');choices[1].click();expect(call).toHaveBeenCalled();choices[0].click();resolveHistory(data({data:[]}).structuredContent);await history;await new Promise(resolve=>setTimeout(resolve,0));expect(document.body.dataset.state).toBe('Alerta crítico');expect([...document.querySelectorAll('.actions button')].map(b=>b.textContent)).toEqual(['Revisar conversa']);
});
