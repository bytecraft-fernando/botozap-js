import {reviewerContract} from '../../tests/fixtures/app-reviewer.js';
import { completeTemplates, completeTemplateOptions, completeTemplateContext } from './template-complete.js';
import { conversation,customerId } from '../demo-data.js';
export const templateScenarios = { kind:'template', options:[['template','4 · Template aprovado'],['template-rejected','4 · Template recusado'],['template-uncertain','4 · Template incerto'],['template-empty','4 · Sem templates'],['template-loading','4 · Carregando templates'],['template-error','4 · Erro de templates']] };
templateScenarios.options.push(...completeTemplateOptions,['template-reviewer','P5 · Confirmar pedido · janela aberta']);
export const number={id:'00000000-0000-4000-8000-000000000004',customer_id:customerId,display_phone_number:'+55 92 90000-0000',waba_connection_id:'00000000-0000-4000-8000-000000000060'};
export const approvedTemplates=[{id:'00000000-0000-4000-8000-000000000061',name:'retomar_orcamento',language:'pt_BR',status:'APPROVED',category:'UTILITY',waba_connection_id:number.waba_connection_id,components:[{type:'HEADER',format:'TEXT',text:'Seu orçamento está pronto'},{type:'BODY',text:'Olá, {{1}}! O orçamento de {{2}} ficou pronto no Ateliê das Águas. Podemos retomar a conversa?',example:{body_text:[['Marina','40 lembranças']]}},{type:'FOOTER',text:'Ateliê das Águas · atendimento com cuidado'},{type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'Quero conversar'},{type:'QUICK_REPLY',text:'Agora não'}]}]}, {id:'00000000-0000-4000-8000-000000000062',name:'pedido_pronto',language:'pt_BR',status:'APPROVED',category:'UTILITY',waba_connection_id:number.waba_connection_id,components:[{type:'BODY',text:'{{1}}, seu pedido {{2}} está pronto para retirada. Podemos combinar um horário?',example:{body_text:[['Marina','40 lembranças']]}}]}];
export const templateStage=(scenario='template')=>scenario==='template-reviewer'?{conversation:{...reviewerContract.conversations[0],status:'active',window_expires_at:new Date(Date.now()+14*3600000).toISOString()},customer_id:customerId,number:reviewerContract.number,preferred_template_id:'confirmacao_pedido',suggested_values:{confirmacao_pedido:{body_1:'Fernando',body_2:'12345',body_3:'amanhã',body_4:'Rua de teste'}}}:({conversation:conversation(true),customer_id:customerId,number,...completeTemplateContext(scenario)});
export async function templateTool(name:string,args:Record<string,any>,scenario:string) {
  if(scenario==='template-reviewer'&&name==='list_templates')return {structuredContent:{data:args.waba_connection_id===reviewerContract.number.waba_connection_id?reviewerContract.templates:[],meta:{total_pages:1}}};
  const catalog=[...approvedTemplates,...completeTemplates];
  if(name==='stage_review_template')return {structuredContent:{...templateStage(scenario), ...(args.template_id ? {preferred_template_id:args.template_id}:{}), ...(args.suggested_values ? {suggested_values:args.suggested_values}:{}), ...(args.media_metadata ? {media_metadata:args.media_metadata}:{})}};
  const page={page:1,per_page:100,total_pages:1,total_count:catalog.length};
  if(name==='get_phone_number')return {structuredContent:{data:number}};
  if(name==='list_templates'){if(scenario==='template-error')return {isError:true,structuredContent:{error:{message:'Não foi possível consultar os templates deste número.'}}};return {structuredContent:{data:scenario==='template-empty'?[]:catalog,meta:page}};}
  if(name==='get_template')return {structuredContent:{data:catalog.find(t=>t.id===args.id)}};
  if(name==='review_template_variables')return {structuredContent:{supported:false,action:'unsupported',variables:args.variables}};
  if(name==='prepare_send_intent')return {structuredContent:{idempotency_key:crypto.randomUUID()}};
  if(name==='send_message'){await new Promise(r=>setTimeout(r,500));if(scenario==='template-rejected')return {isError:true,structuredContent:{error:{outcome:'rejected',message:'O template foi pausado pelo provedor. Atualize a lista antes de revisar novamente.'}}};if(scenario==='template-uncertain')return {isError:true,structuredContent:{error:{outcome:'unknown',message:'Conexão perdida após o envio.'}}};return {structuredContent:{id:'00000000-0000-4000-8000-000000000063',wamid:'wamid.template.demo',status:'accepted'}};}
}

/** Model simulation belongs to the host, never to the actual template screen. */
if (typeof window !== 'undefined' && window === window.top && window.location.pathname === '/chat') {
  let snapshot: Record<string, any> | undefined;
  let appWindow: Window | undefined;
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.data?.method !== 'ui/update-model-context') return;
    try { const next = JSON.parse(event.data.params.content?.[0]?.text ?? '{}'); if (next.screen === 'template') { snapshot = next; appWindow = event.source as Window; } else if (next.conversation_id) snapshot = undefined; } catch { /* Ignore unrelated host context. */ }
  });
  document.addEventListener('submit', event => {
    if ((event.target as HTMLElement)?.id !== 'composer' || !snapshot || !appWindow || Array.from(document.querySelectorAll('iframe')).at(-1)?.contentWindow !== appWindow) return;
    const prompt = document.querySelector<HTMLTextAreaElement>('#prompt'); const text = prompt?.value.trim() ?? '';
    if (snapshot.review_state !== 'draft') return;
    if (!text || !/nome|mariana|imagem|coleção|colecao|quantidade/i.test(text)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const variables = { ...snapshot.suggested_values[snapshot.template_id] };
    const media = { ...snapshot.media_metadata };
    if (/nome|mariana/i.test(text)) for (const v of snapshot.variables) if (v.name === 'Nome do cliente') variables[v.key] = /mariana/i.test(text) ? 'Mariana' : text.match(/(?:para|por)\s+([\p{L}]+)/iu)?.[1] ?? variables[v.key];
    if (/imagem/i.test(text) && /segund|card 2/i.test(text)) { variables.card_1_header_media_id = '123456789012349'; delete variables.card_1_header_media; media.card_1_header = { filename: 'Coleção Floresta · nova imagem.jpg', file_size: 420 * 1024 }; }
    if (/quantidade/i.test(text)) for (const v of snapshot.variables) if (v.name.startsWith('Quantidade')) variables[v.key] = text.match(/\d+/)?.[0] ?? variables[v.key];
    const thread = document.querySelector('#thread');
    for (const [className, content] of [['host-user', text], ['host-assistant', 'Atualizei a prévia. Confira a mensagem antes de enviar.']]) { const message = document.createElement('article'); message.className = className; const p = document.createElement('p'); p.textContent = content; message.append(p); thread?.append(message); }
    if (prompt) prompt.value = '';
    void templateTool('stage_review_template', { conversation_id: snapshot.conversation_id, template_id: snapshot.template_id, suggested_values: { [snapshot.template_id]: variables }, media_metadata: media }, 'template').then(result => appWindow?.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], ...result } }, window.location.origin));
  }, true);
}
