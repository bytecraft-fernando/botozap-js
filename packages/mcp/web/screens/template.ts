import type { Bridge } from '../panel.js';
import { templateFields, supportedTemplate, fillTemplate, templateParameters } from '../../src/template-preview.js';
import { shell, node, button, field, call, ScreenError, skeleton, type Row } from './screen-kit.js';
export function mountTemplate(root: HTMLElement, bridge: Bridge, initial?: Row) {
  const ui=shell(root,'Fora da janela','Uma mensagem aprovada, com contexto');skeleton(ui.content);
  let context: Row, templates: Row[]=[], selected: Row, values: Record<string,string>={}, frozen=false, sending=false, key='', definition='', mode='draft';
  let destination='';
  const preview=node('section','','screen-preview');preview.setAttribute('aria-label','Prévia do template para o cliente');
  const selector=document.createElement('select');selector.id='approved-template';const label=node('label','Template aprovado');label.setAttribute('for',selector.id);
  const fields=node('div','','template-fields');const metadata=node('dl','','screen-metadata');
  function renderPreview() { preview.replaceChildren();for (const c of selected.components ?? []) { const section=String(c.type).toLowerCase();if(c.text) preview.append(node(section==='header'?'h2':'p',fillTemplate(c.text,values,section)));if(section==='buttons') (c.buttons??[]).forEach((b:Row,i:number)=>preview.append(node('div',String(b.text),'template-client-button'))); } }
  function canSend() { return !frozen && templateFields(selected).every(f=>values[f.key]?.trim()); }
  function renderActions() { ui.actions.replaceChildren();if(frozen) return;
    if(mode==='confirming') {ui.actions.append(button('Editar',()=>{mode='draft';ui.state('Rascunho');renderActions();}),button('Enviar template',()=>void send(),true));}
    else { const review=button('Revisar envio',()=>{ if(!canSend())return;mode='confirming';fields.querySelectorAll('input').forEach(i=>i.disabled=true);selector.disabled=true;ui.state('Confirmando','Confira De, Para e a prévia; Enviar template enviará esta mensagem ao cliente.');renderActions();if(root.dataset.mode==='fullscreen')ui.actions.scrollIntoView({block:'center'});},true);review.disabled=!canSend();ui.actions.append(review); }
    if(mode==='draft') {fields.querySelectorAll('input').forEach(i=>i.disabled=false);selector.disabled=false;}
  }
  async function selectTemplate() {
    selected=templates.find(t=>t.id===selector.value)!;if(!selected)return;key='';mode='draft';definition=JSON.stringify([selected.name,selected.language,selected.components]);values={};fields.replaceChildren();
    const name=context.conversation.contact?.name?.split(' ')[0] ?? '';
    for(const f of templateFields(selected)) {const component=selected.components.find((c:Row)=>String(c.type).toLowerCase()===f.section);const samples=component?.example?.body_text?.[0] ?? component?.example?.header_text ?? [];
      values[f.key]=f.section==='body'&&f.variable==='1'?name:String(samples[Number(f.variable)-1]??'');
      const input=field(`${f.section==='body'?'Corpo':f.section==='header'?'Cabeçalho':'Botão'} · ${f.variable}`,values[f.key],`variable-${f.key}`);input.input.oninput=()=>{if(frozen)return;values[f.key]=input.input.value;key='';renderPreview();renderActions();};fields.append(input.wrapper);
    }
    renderPreview();renderActions();if(root.dataset.mode==='fullscreen')ui.actions.scrollIntoView({block:'center'});ui.state('Rascunho','Valores sugeridos. Confira antes de enviar; template aprovado não elimina a necessidade de revisar o conteúdo.');
    const selectedId=selected.id;const suggested=JSON.stringify(values);
    try {const result=await call(bridge,'review_template_variables',{template_id:selectedId,variables:values});if(selected.id!==selectedId||mode!=='draft'||frozen||JSON.stringify(values)!==suggested)return;if(result.supported&&result.action==='accept'){values=result.variables;fields.querySelectorAll('input').forEach(input=>input.value=values[input.id.replace('variable-','')]??'');renderPreview();renderActions();ui.state('Rascunho','Valores revisados no formulário do ChatGPT. Confira a prévia antes do envio.');}} catch { /* Own accessible form remains available when native elicitation is unsupported. */ }
  }
  async function send() {
    if(sending||frozen||mode!=='confirming'||!canSend())return;sending=true;frozen=true;ui.state('Enviando','Enviando uma única tentativa…');renderActions();
    let attempted=false;
    try {
      const current=(await call(bridge,'get_conversation',{id:context.conversation.id})).data;
      if(JSON.stringify([current.id,current.contact_id,current.phone_number_id,current.contact?.wa_id,current.contact?.phone])!==destination) throw new ScreenError('O destinatário ou a origem mudou. Reabra a revisão.','rejected');
      const fresh=(await call(bridge,'get_template',{id:selected.id})).data;
      if(!supportedTemplate(fresh)||JSON.stringify([fresh.name,fresh.language,fresh.components])!==definition||context.number?.waba_connection_id&&fresh.waba_connection_id!==context.number.waba_connection_id) throw new ScreenError('O template mudou ou não está aprovado para este número. Reabra a revisão.','rejected');
      if(!key) key=(await call(bridge,'prepare_send_intent',{})).idempotency_key;
      const payload={to:current.contact?.wa_id||current.contact?.phone,from:current.phone_number_id,type:'template',template:{name:fresh.name,language:{code:fresh.language},components:templateParameters(fresh,values)},idempotency_key:key};
      attempted=true;const receipt=await call(bridge,'send_message',payload);
      if(!receipt.id&&!receipt.wamid)throw new ScreenError('Recibo incompleto. Confira o histórico.');
      ui.state('Aceito','Template aceito pelo BotoZap; isso não confirma entrega ou leitura.');
    } catch(error) {const e=error as ScreenError;if(!attempted||e.outcome==='rejected'){frozen=false;mode='draft';if(!attempted)key='';ui.state('Recusado',`${e.message} Revise os dados antes de uma nova confirmação.`);renderActions();}else ui.state('Incerto','Não foi possível confirmar o envio. Confira o histórico no painel BotoZap; repetir está bloqueado e a chave desta tentativa foi preservada.');}
    finally{sending=false;void bridge.context({conversation_id:context.conversation.id,template_id:selected.id,state:root.dataset.state}).catch(()=>{});}
  }
  async function load(data: Row) {
    context=data;destination=JSON.stringify([data.conversation.id,data.conversation.contact_id,data.conversation.phone_number_id,data.conversation.contact?.wa_id,data.conversation.contact?.phone]);skeleton(ui.content);
    try {
      if(!data.number) data.number=(await call(bridge,'get_phone_number',{id:data.conversation.phone_number_id})).data;
      templates=[];let page=1,total=1;do {const result=await call(bridge,'list_templates',{status:'APPROVED',phone_number_id:data.conversation.phone_number_id,per_page:100,page});templates.push(...result.data.filter(supportedTemplate));total=result.meta.total_pages;page++;}while(page<=total&&page<=10);
      if(!templates.length){ui.state('Sem templates','Nenhum template aprovado com prévia suportada neste número. Revise os templates no painel BotoZap.');ui.content.replaceChildren();return;}
      selector.replaceChildren(...templates.map(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=`${t.name} · ${t.language}`;return o;}));selector.onchange=()=>void selectTemplate();
      for(const [name,value] of [['De',data.number?.display_phone_number||data.conversation.display_phone_number||'Número de origem'],['Para',`${data.conversation.contact?.name??'Contato'} · ${data.conversation.contact?.phone??data.conversation.contact?.wa_id??''}`]]) metadata.append(node('dt',name),node('dd',value));
      ui.content.replaceChildren(metadata,label,selector,fields,preview);await selectTemplate();
    }catch(error){ui.content.replaceChildren();ui.state('Erro',(error as Error).message);}
  }
  if(initial)void load(initial);
  return {...ui,bootstrap(result:Row){if(result.isError){ui.state('Erro','Não foi possível abrir os templates. Confira seu acesso.');return;}void load(result.structuredContent);}};
}
