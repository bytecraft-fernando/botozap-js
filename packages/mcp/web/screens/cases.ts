import { externalLink } from '../pending-link.js';
import type { Bridge } from '../panel.js';
import { relative, quantity } from '../ui-helpers.js';
import { shell,node,button,call,skeleton,type Row } from './screen-kit.js';
export function mountCases(root:HTMLElement,bridge:Bridge) {
  const ui=shell(root,'Atendimento com IA','O agente precisa de você');skeleton(ui.content);
  let context:Row, selected:Row, busy=false, blocked=false, selection=0;
  const settled=new Set<string>();
  function confirm(resume:boolean) { const id=selected.id; ui.state('Confirmando',resume?'Devolver retoma o agente e pode gerar uma resposta ao cliente.':'Assumir atribui este caso ao seu usuário.');ui.actions.replaceChildren(button('Cancelar',()=>renderActions()),button('Confirmar',()=>{if(selected.id===id)void act(resume);},true)); }
  function renderActions() { ui.actions.replaceChildren(); if(context.can_update) { if(context.user_id)ui.actions.append(button('Assumir',()=>confirm(false),true)); ui.actions.append(button('Devolver ao agente',()=>confirm(true))); } ui.state('Precisa de você'); }
  async function act(resume:boolean) {
    if(busy||blocked||!context.can_update||!resume&&!context.user_id)return;busy=true;ui.actions.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);ui.state('Atualizando');
    try {const result=await call(bridge,'ai_cases_update',{customer_id:context.customer_id,id:selected.id,expected_revision:selected.revision,...(resume?{assigned_user_id:null,resume_agent:true,status:'open',message:'Devolvido explicitamente ao agente pelo operador.'}:{assigned_user_id:context.user_id,status:'waiting',resume_agent:false,message:'Assumido pelo operador no MCP App.'})});selected=result.data;blocked=true;ui.actions.replaceChildren();ui.state(resume?'Devolvido':'Assumido',resume?'Caso devolvido. A retomada pode gerar uma resposta automática ao cliente.':'Caso atribuído a você. Continue a conversa pelo assistente ou pelo painel BotoZap.');}
    catch(error){blocked=true;ui.actions.replaceChildren();ui.state('Confira o caso',`${(error as Error).message} Releia o caso no painel antes de tentar outra ação; nenhuma repetição automática será feita.`);}finally{settled.add(selected.id);busy=false;void bridge.context({customer_id:context.customer_id,case_id:selected.id,state:root.dataset.state}).catch(()=>{});}
  }
  async function load(result:Row) {
    if(result.isError){ui.content.replaceChildren();ui.state('Erro','Não foi possível consultar os casos. Confira acesso e tente uma nova consulta pelo assistente.');return;}
    context=result.structuredContent;
    const rows=[...(context.alerts?.data??[]).filter((a:Row)=>a.status==='open').map((a:Row)=>({...a,item_type:'alert'})),...(context.paused?.data??[]).filter((c:Row)=>c.agent_paused_at).map((c:Row)=>({...c,item_type:'paused',conversation_id:c.id,contact_name:c.contact?.name||c.contact?.phone||'Conversa pausada'})),...(context.cases?.data??[]).filter((c:Row)=>['open','waiting'].includes(c.status)).map((c:Row)=>({...c,item_type:'case'}))].sort((a:Row,b:Row)=>(a.item_type==='alert'?(a.severity==='critical'?0:1):a.item_type==='paused'?2:3)-(b.item_type==='alert'?(b.severity==='critical'?0:1):b.item_type==='paused'?2:3));
    if(!rows.length){ui.content.replaceChildren(node('h2','Nenhum caso precisa de você'),node('p','Não há alertas, conversas pausadas ou casos abertos neste recorte.','muted'));ui.actions.replaceChildren();ui.state('Tudo em dia');return;}
    selected=rows[0];const count=context.usage?.handoff?.conversations;const unique=context.usage?.unique_contacts_today??context.usage?.handoff?.unique_contacts_today;const timezone=context.usage?.timezone??context.usage?.handoff?.timezone;let validTimezone=false;try{if(typeof timezone==='string'){new Intl.DateTimeFormat('pt-BR',{timeZone:timezone}).format();validTimezone=true;}}catch{}const metric=Number.isInteger(unique)&&unique>=0&&validTimezone?`${quantity(unique, 'cliente', 'clientes')} hoje`:typeof count==='number'?`${quantity(count, 'conversa', 'conversas')} hoje (UTC)`:null;const total=(context.cases?.meta?.total_count??context.cases?.data?.length??0)+(context.alerts?.meta?.total_count??context.alerts?.data?.length??0)+(context.paused?.data?.filter((c:Row)=>c.agent_paused_at).length??0);
    const summary=node('p',`${metric?`O agente atendeu ${metric} · `:''}${total} precisa${total===1?'':'m'} de você`,'muted');
    ui.actions.replaceChildren();
    ui.content.replaceChildren(summary);
    if(context.paused?.paging?.next)ui.content.append(externalLink('Ver mais conversas pausadas no BotoZap','https://botozap.com.br/painel',bridge));
    if(rows.length>1){const choices=node('div','','case-choices');for(const row of rows)choices.append(button(row.item_type==='alert'?`${row.severity==='critical'?'Crítico · ':''}${row.kind_label||row.title||'Alerta aberto'}`:row.contact_name||row.title||'Caso aberto',()=>void show(row)));ui.content.append(choices);}
    const detail=node('section','','case-detail');ui.content.append(detail);
    async function show(row:Row){if(busy)return;const token=++selection;selected=row;blocked=settled.has(row.id);ui.actions.replaceChildren();detail.replaceChildren(node('h2',selected.contact_name||selected.title||selected.kind_label||'Conversa pausada'),node('p',selected.blocker||selected.summary||selected.detail||selected.message||selected.guidance||'Confira o contexto deste atendimento.'));
    if(blocked){ui.state('Confira o caso','Uma ação já foi solicitada nesta sessão. Reabra o atendimento para conferir o resultado.');ui.actions.append(externalLink('Abrir no BotoZap','https://botozap.com.br/painel',bridge));return;}
    if(['alert','paused'].includes(selected.item_type)){
      ui.state(selected.item_type==='paused'?'Agente pausado':selected.severity==='critical'?'Alerta crítico':'Alerta aberto',selected.item_type==='paused'?`Aguardando humano · pausado ${relative(selected.agent_paused_at)}.`:selected.guidance||'Revise o atendimento antes de agir.');
      if(selected.conversation_id && bridge.message)ui.actions.append(button('Revisar conversa',()=>void bridge.message!(selected.item_type==='paused'?`Revise a conversa ${selected.conversation_id}, com agente pausado aguardando humano, sem enviar mensagem nem retomar o agente automaticamente.`:`Revise a conversa ${selected.conversation_id} relacionada ao alerta ${selected.id}, sem enviar mensagem automaticamente.`),true));
      ui.actions.append(externalLink('Abrir no BotoZap','https://botozap.com.br/painel',bridge));return;
    }
    ui.state('Precisa de você',`Caso aberto ${relative(selected.created_at)}.${Number.isInteger(unique)&&validTimezone?` Dia no fuso ${timezone}.`:''}`);
    try {const messages=await call(bridge,'list_messages',{conversation_id:selected.conversation_id,limit:20});
      if(token!==selection)return;
      const ordered=[...messages.data].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));const evidenceRows=[ordered.filter(m=>m.direction==='inbound').at(-1),ordered.filter(m=>m.direction==='outbound').at(-1)].filter(Boolean);
      for(const m of evidenceRows){const evidence=node('article','','screen-evidence '+(m.direction==='outbound'||m.role==='assistant'?'agent':''));evidence.append(node('small',`${m.direction==='outbound'||m.role==='assistant'?'Atendimento':'Cliente'} · ${relative(m.created_at)}`),node('p',typeof m.content==='string'?m.content:m.content?.text?.body??m.body??'Mensagem sem texto'));detail.append(evidence);}
    }catch{if(token!==selection)return;ui.content.append(node('p','A evidência não pôde ser lida. Confira o histórico no painel antes de agir.','muted'));return;}
    if(context.can_update){if(context.user_id)ui.actions.append(button('Assumir',()=>confirm(false),true));else ui.content.append(node('p','Assumir exige um usuário identificado nesta sessão. Use o painel BotoZap.','muted'));ui.actions.append(button('Devolver ao agente',()=>confirm(true)));ui.content.append(node('p','Devolver retoma a automação e pode gerar uma resposta ao cliente.','caption'));}
    else detail.append(node('p','Você pode ler este caso, mas sua autorização não permite assumir ou devolver ao agente.','muted'));
    }
    await show(selected);
  }
  return {...ui,bootstrap(result:Row){void load(result);}};
}
