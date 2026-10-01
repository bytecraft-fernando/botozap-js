// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
import {mountReview} from '../web/panel.js';
import {contactLabel,contactAddress,formatPhone} from '../web/ui-helpers.js';
import {reviewerContract as fixture} from './fixtures/app-reviewer.js';
beforeEach(()=>{document.body.innerHTML='';HTMLElement.prototype.scrollIntoView=vi.fn();});
it('prefers name, username and formatted phone without displaying BSUID or IGSID as phone',()=>{
 expect(contactLabel({name:'Sâmia',username:'samia',phone:'5511989669559'})).toBe('Sâmia');
 expect(contactLabel({name:'BR.188abc',username:'samia'})).toBe('@samia');
 expect(contactLabel({phone:'5511989669559'})).toBe('+55 11 98966-9559');
 expect(contactAddress({wa_id:'BR.188abc'})).toBe('');expect(formatPhone('1784000000000000')).toBe('');
});
it.each([0,2,10])('review of identity %s never sends before explicit confirmation',async index=>{
 const c={...fixture.conversations[index]!,status:'active',window_expires_at:new Date(Date.now()+3600000).toISOString()};
 const call=vi.fn(async(name:string)=>({structuredContent:name==='get_conversation'?{data:c}:name==='open_review_panel'?{account_id:'reviewer',environment:'live',customers:{data:fixture.customers,meta:fixture.meta}}:name==='list_messages'?{data:[fixture.messages[index]],paging:{next:null}}:name==='list_radar'?{data:[],meta:fixture.meta}:{id:fixture.messages[index]!.id,wamid:'mid.fixture',status:'accepted'}}));
 const screen=mountReview(document.body,{call,context:vi.fn(async()=>{})});screen.bootstrap({structuredContent:{customer_id:fixture.customers[0]!.id,conversation:c,draft:{text:'Olá, posso ajudar?',idempotency_key:'00000000-0000-4000-8000-000000000900'}}});
 await vi.waitFor(()=>expect((document.querySelector('#draft') as HTMLTextAreaElement).disabled).toBe(false));
 expect(document.querySelector('#contact-phone')?.textContent).not.toContain('BR.');
 if(c.channel==='instagram'){expect(document.querySelector('#contact-phone')?.textContent).toContain('Instagram');expect((document.querySelector('#use-template') as HTMLButtonElement).hidden).toBe(true);}
 (document.querySelector('#review') as HTMLButtonElement).click();expect(call.mock.calls.some(([name])=>name==='reply_to_conversation')).toBe(false);
 const consent=document.querySelector('#consent') as HTMLInputElement;consent.checked=true;consent.dispatchEvent(new Event('change'));(document.querySelector('#send') as HTMLButtonElement).click();
 await vi.waitFor(()=>expect(call.mock.calls.filter(([name])=>name==='reply_to_conversation')).toHaveLength(1));
});
