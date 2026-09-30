import type { Bridge } from '../panel.js';
import { relative } from '../ui-helpers.js';
import { shell,node,button,call,skeleton,type Row } from './screen-kit.js';
export function mountCases(root:HTMLElement,bridge:Bridge) {
  const ui=shell(root,'Atendimento com IA','O agente precisa de você');skeleton(ui.content);
  let context:Row, selected:Row, busy=false, blocked=false;
  function confirm(resume:boolean) { ui.state('Confirmando',resume?'Devolver retoma o agente e pode gerar uma resposta ao cliente.':'Assumir atribui este caso ao seu usuário.');ui.actions.replaceChildren(button('Cancelar',()=>renderActions()),button('Confirmar',()=>void act(resume),true)); }
  function renderActions() { ui.actions.replaceChildren(); if(context.can_update) { if(context.user_id)ui.actions.append(button('Assumir',()=>confirm(false),true)); ui.actions.append(button('Devolver ao agente',()=>confirm(true))); } ui.state('Precisa de você'); }
  async function act(resume:boolean) {
    if(busy||blocked||!context.can_update||!resume&&!context.user_id)return;busy=true;ui.actions.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);ui.state('Atualizando');
    try {const result=await call(bridge,'ai_cases_update',{customer_id:context.customer_id,id:selected.id,expected_revision:selected.revision,...(resume?{assigned_user_id:null,resume_agent:true,status:'open',message:'Devolvido explicitamente ao agente pelo operador.'}:{assigned_user_id:context.user_id,status:'waiting',resume_agent:false,message:'Assumido pelo operador no MCP App.'})});selected=result.data;blocked=true;ui.actions.replaceChildren();ui.state(resume?'Devolvido':'Assumido',resume?'Caso devolvido. A retomada pode gerar uma resposta automática ao cliente.':'Caso atribuído a você. Continue a conversa pelo assistente ou pelo painel BotoZap.');}
    catch(error){blocked=true;ui.actions.replaceChildren();ui.state('Confira o caso',`${(error as Error).message} Releia o caso no painel antes de tentar outra ação; nenhuma repetição automática será feita.`);}finally{busy=false;void bridge.context({customer_id:context.customer_id,case_id:selected.id,state:root.dataset.state}).catch(()=>{});}
  }
  async function load(result:Row) {
    if(result.isError){ui.content.replaceChildren();ui.state('Erro','Não foi possível consultar os casos. Confira acesso e tente uma nova consulta pelo assistente.');return;}
    context=result.structuredContent;const rows=(context.cases?.data??[]).filter((c:Row)=>['open','waiting'].includes(c.status));
    if(!rows.length){ui.content.replaceChildren(node('h2','Nenhum caso precisa de você'),node('p','O agente segue atendendo. Você pode consultar novamente quando quiser.','muted'));ui.state('Tudo em dia');return;}
    selected=rows[0];const count=context.usage?.handoff?.conversations;const unique=context.usage?.unique_contacts_today??context.usage?.handoff?.unique_contacts_today;const timezone=context.usage?.timezone??context.usage?.handoff?.timezone;let validTimezone=false;try{if(typeof timezone==='string'){new Intl.DateTimeFormat('pt-BR',{timeZone:timezone}).format();validTimezone=true;}}catch{}const metric=Number.isInteger(unique)&&unique>=0&&validTimezone?`${unique} clientes hoje`:typeof count==='number'?`${count} conversas hoje (UTC)`:null;const total=context.cases.meta?.total_count??rows.length;
    const summary=node('p',`${metric?`O agente atendeu ${metric} · `:''}${total} precisa${total===1?'':'m'} de você`,'muted');
    ui.content.replaceChildren(summary,node('h2',selected.contact_name||selected.title),node('p',selected.blocker||selected.summary));
    ui.state('Precisa de você',`Caso aberto ${relative(selected.created_at)}.${Number.isInteger(unique)&&validTimezone?` Dia no fuso ${timezone}.`:''}`);
    try {const messages=await call(bridge,'list_messages',{conversation_id:selected.conversation_id,limit:20});
      const ordered=[...messages.data].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));const evidenceRows=[ordered.filter(m=>m.direction==='inbound').at(-1),ordered.filter(m=>m.direction==='outbound').at(-1)].filter(Boolean);
      for(const m of evidenceRows){const evidence=node('article','','screen-evidence '+(m.direction==='outbound'||m.role==='assistant'?'agent':''));evidence.append(node('small',`${m.direction==='outbound'||m.role==='assistant'?'Atendimento':'Cliente'} · ${relative(m.created_at)}`),node('p',typeof m.content==='string'?m.content:m.content?.text?.body??m.body??'Mensagem sem texto'));ui.content.append(evidence);}
    }catch{ui.content.append(node('p','A evidência não pôde ser lida. Confira o histórico no painel antes de agir.','muted'));return;}
    if(context.can_update){if(context.user_id)ui.actions.append(button('Assumir',()=>confirm(false),true));else ui.content.append(node('p','Assumir exige um usuário identificado nesta sessão. Use o painel BotoZap.','muted'));ui.actions.append(button('Devolver ao agente',()=>confirm(true)));ui.content.append(node('p','Devolver retoma a automação e pode gerar uma resposta ao cliente.','caption'));}
    else ui.content.append(node('p','Você pode ler este caso, mas sua autorização não permite assumir ou devolver ao agente.','muted'));
  }
  return {...ui,bootstrap(result:Row){void load(result);}};
}
