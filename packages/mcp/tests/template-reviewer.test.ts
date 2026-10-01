// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
import {reviewerContract as fixture} from './fixtures/app-reviewer.js';
import {mountTemplate} from '../web/screens/template.js';
import {templateFields,templateParameters} from '../src/template-preview.js';
beforeEach(()=>{document.body.innerHTML='<div id="app"></div>';HTMLElement.prototype.scrollIntoView=vi.fn();});
for(const [index,variables] of [[0,{body_1:'Fernando',body_2:'12345',body_3:'amanhã',body_4:'Rua de teste'}],[1,{body_nome:'Fernando',body_pedido:'12345',body_data:'amanhã',body_endereco:'Rua de teste'}]] as const){
 it(`real serialized ${index?'NAMED':'POSITIONAL'} catalogue resolves the origin WABA and requested template with four suggestions`,async()=>{
  const template=fixture.templates[index];const conversation={...fixture.conversations[0],status:'active',window_expires_at:new Date(Date.now()+14*3600000).toISOString()};
  const call=vi.fn(async(name:string,args:any)=>({structuredContent:name==='list_templates'?{data:args.waba_connection_id===fixture.number.waba_connection_id||args.phone_number_id===fixture.number.phone_number_id?[...fixture.templates,{...template,id:'foreign',waba_connection_id:'other'}]:[],meta:{total_pages:1}}:{}}));
  const root=document.querySelector<HTMLElement>('#app')!;mountTemplate(root,{call,context:vi.fn(async()=>{})},{conversation,number:fixture.number,customer_id:fixture.number.customer_id,preferred_template_id:template.name,suggested_values:{[template.name]:variables}});
  await vi.waitFor(()=>expect(root.dataset.state).toBe('Rascunho'));
  expect(call).toHaveBeenCalledWith('list_templates',{status:'APPROVED',waba_connection_id:fixture.number.waba_connection_id,per_page:100,page:1});
  expect(root.textContent).toContain('Janela aberta');expect(root.textContent).not.toContain('Fora da janela');
  expect(root.querySelector<HTMLSelectElement>('#approved-template')?.value).toBe(template.id);expect(root.querySelectorAll('option').length).toBeGreaterThan(1);expect(root.querySelector('option[value=foreign]')).toBeNull();
  for(const [key,value] of Object.entries(variables))expect(root.querySelector<HTMLInputElement>(`#variable-${key}`)?.value).toBe(value);
  expect(templateFields(template)).toHaveLength(4);
  const params=templateParameters(template,variables as Record<string,string>)[0]!.parameters;
  expect(params.map((p:any)=>p.text)).toEqual(['Fernando','12345','amanhã','Rua de teste']);
  expect(params.map((p:any)=>p.parameter_name)).toEqual(index?['nome','pedido','data','endereco']:[undefined,undefined,undefined,undefined]);
  expect(call.mock.calls.every(([name])=>name==='list_templates')).toBe(true);
 });
}
