// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { mountTemplate } from '../web/screens/template.js';
import { mountBooking } from '../web/screens/booking.js';
import { mountCases } from '../web/screens/cases.js';
import { templateStage, templateTool, approvedTemplates } from '../web/scenarios/template.js';
import { bookingStage, bookingTool } from '../web/scenarios/booking.js';
import { casesStage, casesTool } from '../web/scenarios/cases.js';
import { conversation } from '../web/demo-data.js';
import { templateParameters, supportedTemplate } from '../src/template-preview.js';
const result=(structuredContent:unknown)=>({structuredContent});
const click=(text:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);expect(b, text).toBeDefined();b!.click();return b!;};
const state=async(text:string)=>vi.waitFor(()=>expect(document.body.dataset.state).toBe(text));
function harness(scenario:string,override?:(name:string,args:any)=>any) {
 const call=vi.fn(async(name:string,args:any)=>{const custom=override?.(name,args);if(custom!==undefined)return custom;
 return await templateTool(name,args,scenario)??await bookingTool(name,args,scenario)??await casesTool(name,args,scenario)??(name==='get_conversation'?result({data:conversation(scenario.startsWith('template'))}):name==='reply_to_conversation'?result({id:'notice',status:'accepted'}):(()=>{throw new Error(name);})());});
 return {call,context:vi.fn(async()=>{}),calls:(name:string)=>call.mock.calls.filter(([n])=>n===name)};
}
beforeEach(()=>{document.body.innerHTML='';HTMLElement.prototype.scrollIntoView=vi.fn();});
it('template: review has no side effect; explicit confirm sends exact approved parameters once',async()=>{
 const h=harness('template');mountTemplate(document.body,h,templateStage());await state('Rascunho');click('Revisar envio');expect(h.calls('send_message')).toHaveLength(0);
 const send=click('Enviar template');send.click();await state('Aceito');expect(h.calls('send_message')).toHaveLength(1);
 expect(h.calls('send_message')[0][1]).toMatchObject({type:'template',from:templateStage().conversation.phone_number_id,template:{name:'retomar_orcamento',language:{code:'pt_BR'},components:[{type:'body',parameters:[{type:'text',text:'Marina'},{type:'text',text:'40 lembranças'}]}]},idempotency_key:expect.stringMatching(/^[a-f0-9-]{36}$/)});
 expect(document.body.textContent).toContain('não confirma entrega');
});
it('template: uncertainty freezes fields and a stale confirm cannot repeat',async()=>{
 const h=harness('template-uncertain');mountTemplate(document.body,h,templateStage());await state('Rascunho');click('Revisar envio');const send=click('Enviar template');await state('Incerto');send.click();expect(h.calls('send_message')).toHaveLength(1);expect([...document.querySelectorAll('input')].every(i=>i.disabled)).toBe(true);expect(document.querySelectorAll('button')).toHaveLength(0);
});
it('template: confirmed rejection frees editing for a new explicit intent',async()=>{
 const h=harness('template-rejected');mountTemplate(document.body,h,templateStage());await state('Rascunho');click('Revisar envio');click('Enviar template');await state('Recusado');expect(document.querySelector('input')!.disabled).toBe(false);expect(h.calls('send_message')).toHaveLength(1);click('Revisar envio');click('Enviar template');await vi.waitFor(()=>expect(h.calls('send_message')).toHaveLength(2));await state('Recusado');expect(h.calls('send_message')[1][1].idempotency_key).toBe(h.calls('send_message')[0][1].idempotency_key);
});
it('template: approval/origin change blocks dispatch at preflight',async()=>{
 const h=harness('template',(n)=>n==='get_template'?result({data:{...approvedTemplates[0],status:'PAUSED'}}):undefined);mountTemplate(document.body,h,templateStage());await state('Rascunho');click('Revisar envio');click('Enviar template');await state('Recusado');expect(h.calls('send_message')).toHaveLength(0);
});
it('template: named/header/button values are serialized without interpolating HTML',()=>{
 const t={status:'APPROVED',components:[{type:'HEADER',format:'TEXT',text:'{{title}}'},{type:'BODY',text:'{{1}}'},{type:'BUTTONS',buttons:[{type:'URL',text:'Ver',url:'https://example.test/{{1}}'}]}]};
 expect(templateParameters(t,{header_title:'<img>',body_1:'Marina',button_0_1:'123'})).toEqual([{type:'header',parameters:[{type:'text',text:'<img>',parameter_name:'title'}]},{type:'body',parameters:[{type:'text',text:'Marina'}]},{type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:'123'}]}]);
 expect(supportedTemplate({...t,status:'REJECTED'})).toBe(false);expect(()=>templateParameters(t,{})).toThrow();
});
it('booking: selection is read-only; confirmation creates once and then sends one notice',async()=>{
 const h=harness('booking');mountBooking(document.body,h).bootstrap(bookingStage('booking'));await state('Disponível');click('Marcar');expect(h.calls('create_appointment')).toHaveLength(0);const confirm=click('Confirmar');confirm.click();await state('Marcado');expect(h.calls('create_appointment')).toHaveLength(1);expect(h.calls('reply_to_conversation')).toHaveLength(1);expect(h.calls('create_appointment')[0][1]).toMatchObject({status:'confirmed',meeting_requested:true,idempotency_key:expect.stringMatching(/^[a-f0-9-]{36}$/)});
});
it('booking: slot lost before confirmation never creates an appointment',async()=>{
 const h=harness('booking-rejected');mountBooking(document.body,h).bootstrap(bookingStage('booking'));await state('Disponível');click('Marcar');click('Confirmar');await state('Recusado');expect(h.calls('create_appointment')).toHaveLength(0);
});
it('booking: uncertainty blocks repeating even through the stale confirmation button',async()=>{
 const h=harness('booking-uncertain');mountBooking(document.body,h).bootstrap(bookingStage('booking'));await state('Disponível');click('Marcar');const confirm=click('Confirmar');await state('Incerto');confirm.click();expect(h.calls('create_appointment')).toHaveLength(1);expect(h.calls('reply_to_conversation')).toHaveLength(0);
});
it('booking: notice failure after creation cannot create the same appointment again',async()=>{
 const h=harness('booking',n=>n==='reply_to_conversation'?{isError:true,structuredContent:{error:{outcome:'unknown',message:'Timeout'}}}:undefined);mountBooking(document.body,h).bootstrap(bookingStage('booking'));await state('Disponível');click('Marcar');const confirm=click('Confirmar');await state('Marcado · confira o aviso');confirm.click();expect(h.calls('create_appointment')).toHaveLength(1);expect(h.calls('reply_to_conversation')).toHaveLength(1);
});
it('cases: assume only after confirming, with identity and revision CAS',async()=>{
 const h=harness('cases');mountCases(document.body,h).bootstrap(casesStage('cases'));await vi.waitFor(()=>expect(document.querySelectorAll('button')).toHaveLength(2));click('Assumir');expect(h.calls('ai_cases_update')).toHaveLength(0);click('Confirmar');await state('Assumido');expect(h.calls('ai_cases_update')[0][1]).toMatchObject({expected_revision:4,status:'waiting',resume_agent:false,assigned_user_id:expect.any(String)});
});
it('cases: returning explicitly confirms resumption of automatic replies',async()=>{
 const h=harness('cases');mountCases(document.body,h).bootstrap(casesStage('cases'));await vi.waitFor(()=>expect(document.querySelectorAll('button')).toHaveLength(2));click('Devolver ao agente');expect(document.body.textContent).toContain('pode gerar uma resposta');click('Confirmar');await state('Devolvido');expect(h.calls('ai_cases_update')[0][1]).toMatchObject({expected_revision:4,status:'open',resume_agent:true,assigned_user_id:null});
});
it('cases: read-only identity has evidence and no mutating actions',async()=>{
 const h=harness('cases-permission');mountCases(document.body,h).bootstrap(casesStage('cases-permission'));await vi.waitFor(()=>expect(document.body.textContent).toContain('autorização não permite'));expect(document.querySelectorAll('button')).toHaveLength(0);expect(h.calls('ai_cases_update')).toHaveLength(0);
});
it('cases: unreadable evidence blocks actions instead of allowing a blind takeover',async()=>{
 const h=harness('cases',n=>n==='list_messages'?{isError:true}:undefined);mountCases(document.body,h).bootstrap(casesStage('cases'));await vi.waitFor(()=>expect(document.body.textContent).toContain('evidência não pôde'));expect(document.querySelectorAll('button')).toHaveLength(0);
});
