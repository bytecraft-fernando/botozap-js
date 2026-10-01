// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
import {mountCases} from '../web/screens/cases.js';
import {casesStage} from '../web/scenarios/cases.js';
import {conversation,customerId,bootstrap,history} from '../web/demo-data.js';
import {formatPhone} from '../web/ui-helpers.js';
beforeEach(()=>{document.body.replaceChildren();for(const k of Object.keys(document.body.dataset))delete document.body.dataset[k];HTMLElement.prototype.scrollIntoView=vi.fn();});
const click=(label:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(b,label).toBeDefined();b.click();return b;};
it('acknowledged critical alert and eight paused conversations populate compact inline and full lists',async()=>{
 const screen=mountCases(document.body,{call:vi.fn(),context:vi.fn(async()=>{})});screen.bootstrap(casesStage('cases-p2'));
 await vi.waitFor(()=>expect(document.body.dataset.state).toBe('Alerta crítico'));
 expect(document.body.textContent).toContain('Reconhecido');expect(document.body.textContent).toContain('8 precisam de você');expect(document.querySelectorAll('.case-row')).toHaveLength(3);expect(document.body.textContent).toContain('+55 11 98966-9559');expect(document.body.textContent).toContain('Preciso remarcar');
 screen.setMode('fullscreen');await vi.waitFor(()=>expect(document.querySelectorAll('.case-row')).toHaveLength(8));expect(document.querySelector('.case-row')?.textContent).toContain('Crítico');expect(document.body.textContent).not.toContain('Confira o contexto');
});
it('opens authorized history/composer and resumes only after explicit confirmation, once',async()=>{
 const conv={...conversation(),agent_paused_at:new Date().toISOString()},message=vi.fn();
 const call=vi.fn(async(name:string)=>({structuredContent:name==='get_conversation'?{data:conv}:name==='get_phone_number'?{data:{customer_id:customerId}}:name==='open_review_panel'?bootstrap:name==='list_messages'?history():name==='list_radar'?{data:[],meta:{page:1,total_pages:1,total_count:0}}:name==='control_conversation_agent'?{data:{conversation_id:conv.id,paused:false}}:{data:{id:customerId,name:'Negócio'}}}));
 const screen=mountCases(document.body,{call,context:vi.fn(async()=>{}),displayMode:vi.fn(async()=>({mode:'fullscreen'})),message});screen.bootstrap(casesStage('cases-p2'));click('Revisar conversa');
 await vi.waitFor(()=>expect((document.querySelector('#draft') as HTMLTextAreaElement)?.disabled).toBe(false));expect(document.querySelector('#history')?.textContent).toContain('São 40 lembranças');expect(message).not.toHaveBeenCalled();expect(call.mock.calls.some(([n])=>['reply_to_conversation','control_conversation_agent'].includes(n))).toBe(false);
 click('Retomar IA');expect(document.body.textContent).toContain('pode gerar uma resposta automática');expect(call.mock.calls.some(([n])=>n==='control_conversation_agent')).toBe(false);const confirm=click('Confirmar retomada');await vi.waitFor(()=>expect(document.body.textContent).toContain('IA retomada'));confirm.click();expect(call.mock.calls.filter(([n])=>n==='control_conversation_agent')).toHaveLength(1);expect(call).toHaveBeenCalledWith('control_conversation_agent',{conversation_id:conv.id,action:'resume'});screen.setMode('inline');await vi.waitFor(()=>expect(document.querySelectorAll('.case-row')).toHaveLength(3));
});
it('failed conversation authorization leaves the inbox and never mutates',async()=>{
 const call=vi.fn(async()=>({isError:true,structuredContent:{error:{message:'Sem permissão'}}}));mountCases(document.body,{call,context:vi.fn(async()=>{})}).bootstrap(casesStage('cases-p2'));click('Revisar conversa');await vi.waitFor(()=>expect(document.body.textContent).toContain('Sem permissão'));expect(document.querySelector('#draft')).toBeNull();expect(call).toHaveBeenCalledOnce();
});
it('formats phones centrally without modifying other identities',()=>{expect(formatPhone('+5511989669559')).toBe('+55 11 98966-9559');expect(formatPhone('551132345678')).toBe('+55 11 3234-5678');expect(formatPhone('Marina Oliveira')).toBe('Marina Oliveira');expect(formatPhone('@samia')).toBe('@samia');expect(formatPhone('+12025550123')).toBe('+12025550123');});
it.each([0,1,2])('daily customer count %s is human and hides timezone identifiers',async count=>{
 const stage=casesStage('cases-p3');stage.structuredContent.usage={unique_contacts_today:count,timezone:'America/Sao_Paulo'};mountCases(document.body,{call:vi.fn(),context:vi.fn(async()=>{})}).bootstrap(stage);
 await vi.waitFor(()=>expect(document.body.textContent).toContain(count===0?'Nenhum cliente atendido hoje':count===1?'1 cliente atendido hoje':'2 clientes atendidos hoje'));
 expect(document.body.textContent).not.toContain('America/Sao_Paulo');expect(document.body.textContent).not.toContain('authority_claim');expect([...document.querySelectorAll('.screen-evidence p')].every(p=>p.textContent?.trim())).toBe(true);
});
it('an empty serialized text becomes a label rather than an empty customer balloon',async()=>{
 const stage=casesStage('cases-p3');stage.structuredContent.paused.data=[];mountCases(document.body,{call:vi.fn(),context:vi.fn(async()=>{})}).bootstrap(stage);await vi.waitFor(()=>expect(document.querySelector('.screen-evidence p')?.textContent).toBe('Mensagem sem texto'));
});
it('an aggregated inbox identifies the business on every unique row',async()=>{
 const stage=casesStage('cases-p3');stage.structuredContent.businesses=[{id:'a',name:'Ateliê'},{id:'b',name:'Café'}];for(const row of [...stage.structuredContent.alerts.data,...stage.structuredContent.paused.data]){row.customer_id='a';row.customer_name='Ateliê';}stage.structuredContent.paused.data[1].customer_id='b';stage.structuredContent.paused.data[1].customer_name='Café';mountCases(document.body,{call:vi.fn(),context:vi.fn(async()=>{})}).bootstrap(stage);await vi.waitFor(()=>expect(document.querySelectorAll('.case-business')).toHaveLength(3));expect(document.body.textContent).toContain('Café');
});
