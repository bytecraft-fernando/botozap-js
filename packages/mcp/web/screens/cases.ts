import { messagePreview, alertCopy, groupInbox } from '../../src/agent-inbox.js';
import { externalLink } from '../pending-link.js';
import { mountReview, type Bridge } from '../panel.js';
import { relative, quantity, contactLabel, formatPhone } from '../ui-helpers.js';
import { shell,node,button,call,skeleton,type Row } from './screen-kit.js';
export function mountCases(root:HTMLElement,bridge:Bridge) {
  const ui=shell(root,'Atendimento com IA','O agente precisa de você');skeleton(ui.content);
  let context:Row, selected:Row, busy=false, blocked=false, selection=0;
  const settled=new Set<string>();
  function confirm(resume:boolean) { const id=selected.id; ui.state('Confirmando',resume?'Devolver retoma o agente e pode gerar uma resposta ao cliente.':'Assumir atribui este caso ao seu usuário.');ui.actions.replaceChildren(button('Cancelar',()=>renderActions()),button('Confirmar',()=>{if(selected.id===id)void act(resume);},true)); }
  function renderActions() { ui.actions.replaceChildren(); if(context.can_update) { if(context.user_id)ui.actions.append(button('Assumir',()=>confirm(false),true)); ui.actions.append(button('Devolver ao agente',()=>confirm(true))); } ui.state('Precisa de você'); }
  async function act(resume:boolean) {
    if(busy||blocked||!context.can_update||!resume&&!context.user_id)return;busy=true;ui.actions.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);ui.state('Atualizando');
    try {const result=await call(bridge,'ai_cases_update',{customer_id:selected.customer_id||context.customer_id,id:selected.id,expected_revision:selected.revision,...(resume?{assigned_user_id:null,resume_agent:true,status:'open',message:'Devolvido explicitamente ao agente pelo operador.'}:{assigned_user_id:context.user_id,status:'waiting',resume_agent:false,message:'Assumido pelo operador no MCP App.'})});selected=result.data;blocked=true;ui.actions.replaceChildren();ui.state(resume?'Devolvido':'Assumido',resume?'Caso devolvido. A retomada pode gerar uma resposta automática ao cliente.':'Caso atribuído a você. Continue a conversa pelo assistente ou pelo painel BotoZap.');}
    catch(error){blocked=true;ui.actions.replaceChildren();ui.state('Confira o caso',`${(error as Error).message} Releia o caso no painel antes de tentar outra ação; nenhuma repetição automática será feita.`);}finally{settled.add(selected.id);busy=false;void bridge.context({customer_id:context.customer_id,case_id:selected.id,state:root.dataset.state}).catch(()=>{});}
  }
  let mode='inline', activeReview:ReturnType<typeof mountReview>|undefined;
  const messageText=messagePreview;
  const name=(r:Row)=>contactLabel(r.contact??{name:r.contact_name})||(r.alerts?.length?alertCopy(r.alerts[0]).title:r.title)||'Contato';
  const reason=(r:Row)=>[...r.alerts.map((a:Row)=>`${alertCopy(a).title} · ${alertStatus(a)}`),...(r.agent_paused_at?['IA pausada']:[]),...r.cases.map((c:Row)=>c.blocker||c.title||'Caso aguardando decisão')].join(' · ');
  const since=(r:Row)=>relative(r.agent_paused_at||r.created_at);
  const alertStatus=(r:Row)=>r.status==='acknowledged'?'Reconhecido':'Aberto';
  async function review(row:Row){
    if(busy)return;busy=true;const token=++selection;
    ui.state('Abrindo conversa');
    try {
      const conversation=(await call(bridge,'get_conversation',{id:row.conversation_id})).data;
      if(token!==selection)return;
      if(conversation.id!==row.conversation_id||(!conversation.phone_number_id&&conversation.channel!=='instagram'))throw new Error('Conversa sem canal de revisão disponível.');
      const number=(await call(bridge,conversation.channel==='instagram'?'get_channel_account':'get_phone_number',{id:conversation.channel==='instagram'?conversation.channel_account?.id:conversation.phone_number_id})).data;
      if(token!==selection)return;
      if(!number.customer_id||!(row.customer_ids?.length?row.customer_ids:[context.customer_id]).includes(number.customer_id))throw new Error('Conversa fora do negócio selecionado.');
      delete root.dataset.actionPlacement;activeReview=mountReview(root,bridge);root.dataset.focus='conversation';activeReview.setMode('fullscreen');mode='fullscreen';
      activeReview.bootstrap({structuredContent:{customer_id:number.customer_id,conversation,draft:{text:'',idempotency_key:crypto.randomUUID()}}});
      const nav=node('div','','case-review-nav');nav.append(button('Voltar aos atendimentos',()=>{activeReview=undefined;void load({structuredContent:context});}));
      if(conversation.agent_paused_at&&context.can_resume){
        let resumeAttempted=false;
        const resume=button('Retomar IA',()=>{
          nav.replaceChildren(node('p','Retomar a IA pode gerar uma resposta automática ao cliente. Deseja continuar?'),button('Cancelar',()=>{nav.replaceChildren(resume);}),button('Confirmar retomada',()=>{
            if(resumeAttempted)return;resumeAttempted=true;
            nav.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);
            void (async()=>{try{await call(bridge,'control_conversation_agent',{conversation_id:conversation.id,action:'resume'});nav.replaceChildren(node('p','IA retomada. Confira as próximas mensagens no histórico.'));}catch(error){nav.replaceChildren(node('p',`${(error as Error).message} Confira o estado no BotoZap antes de tentar novamente.`));nav.append(externalLink('Abrir no BotoZap','https://botozap.com.br/painel',bridge));}})();
          },true));
        });nav.append(resume);
      }
      root.querySelector('main')!.prepend(nav);await bridge.displayMode?.('fullscreen');
    }catch(error){ui.state('Confira seu acesso',(error as Error).message);}finally{busy=false;}
  }
  async function load(result:Row) {
    if(result.isError){ui.content.replaceChildren();ui.state('Erro','Não foi possível consultar os atendimentos. Confira acesso e tente novamente.');return;}
    context=result.structuredContent;
    // Reinstall the original shell when returning from the shared conversation reviewer.
    if(activeReview)return;
    if(!ui.main.isConnected){const next=shell(root,'Atendimento com IA','O agente precisa de você');Object.assign(ui,next);}
    ui.setMode(mode);root.dataset.actionPlacement='flow';
    const rows=groupInbox(context);
    ui.actions.replaceChildren();
    if(!rows.length){ui.content.replaceChildren(node('h2','Tudo em dia'),node('p','Não há alertas não resolvidos, conversas pausadas ou casos abertos neste recorte.','muted'));ui.state('Tudo em dia');return;}
    const total=rows.length;ui.content.replaceChildren(node('p',`${total} precisa${total===1?'':'m'} de você`,'muted'));
    const unique=(context.usage?.data??context.usage)?.unique_contacts_today;
    if(Number.isInteger(unique)&&unique>=0)ui.content.append(node('p',unique===0?'Nenhum cliente atendido hoje':`${quantity(unique,'cliente','clientes')} atendido${unique===1?'':'s'} hoje`,'muted'));
    else if(context.usage?.handoff?.conversations)ui.content.append(node('p',`${quantity(context.usage.handoff.conversations,'conversa','conversas')} hoje (UTC)`,'muted'));
    if(mode==='inline')ui.content.append(button('Abrir em tela cheia',()=>void bridge.displayMode?.('fullscreen').then(()=>{mode='fullscreen';void load({structuredContent:context});})));
    const list=node('div','','case-list case-choices');ui.content.append(list);
    for(const row of (mode==='inline'?rows.slice(0,3):rows)){
      const item=button('',()=>void show(row));item.className='case-row';
      item.append(node('strong',`${row.severity==='critical'?'Crítico · ':''}${name(row)}`),node('span',`${reason(row)}`,'case-reason'),...(context.businesses?.length>1?[node('small',row.business_names.join(' · '),'case-business')]:[]),node('span',messageText(row.latest_customer_message).slice(0,160)||'Prévia não disponível. Abra o histórico para conferir.','case-preview'),node('small',`Aguardando ${since(row)||'horário não informado'}`));list.append(item);
    }
    if(context.paused?.paging?.next)ui.content.append(externalLink('Ver mais conversas pausadas no BotoZap','https://botozap.com.br/painel',bridge));
    const detail=node('section','','case-detail');ui.content.append(detail);
    async function show(row:Row){
      if(busy)return;const token=++selection;selected=row.primary_case||row;blocked=settled.has(selected.id);ui.actions.replaceChildren();
      detail.replaceChildren(node('h2',name(row)),node('p',row.alerts.length?row.alerts.map((a:Row)=>alertCopy(a).detail).join(' '):row.agent_paused_at?`IA pausada ${since(row)}. Aguardando atendimento humano.`:row.summary||row.blocker||row.title||'Caso aguardando decisão do operador.'));
      const latest=row.latest_customer_message;if(latest){const evidence=node('article','','screen-evidence');evidence.append(node('small',`Cliente · ${relative(latest.created_at)}`),node('p',messageText(latest).slice(0,280)));detail.append(evidence);}
      ui.state(row.item_type==='paused'?'Agente pausado':row.severity==='critical'?'Alerta crítico':'Precisa de você',`${row.alerts.length?row.alerts.map((a:Row)=>alertStatus(a)).join(' · ')+' · ':''}Aguardando ${since(row)||'horário não informado'}`);
      if(row.conversation_id)ui.actions.append(button('Revisar conversa',()=>void review(row),true));
      ui.actions.append(externalLink('Abrir no BotoZap','https://botozap.com.br/painel',bridge));
      if(!row.primary_case||blocked)return;
      try {const messages=await call(bridge,'list_messages',{conversation_id:row.conversation_id,limit:20});if(token!==selection)return;
        const ordered=[...messages.data].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));for(const m of [ordered.filter(m=>m.direction==='inbound').at(-1),ordered.filter(m=>m.direction==='outbound').at(-1)].filter(Boolean)){const evidence=node('article','','screen-evidence');evidence.append(node('small',`${m.direction==='inbound'?'Cliente':'Atendimento'} · ${relative(m.created_at)}`),node('p',messageText(m)));detail.append(evidence);}
      }catch{if(token!==selection)return;ui.status.textContent='A evidência não pôde ser lida. Confira o atendimento no BotoZap.';return;}
      if(context.can_update){if(context.user_id)ui.actions.append(button('Assumir',()=>confirm(false),true));ui.actions.append(button('Devolver ao agente',()=>confirm(true)));}else detail.append(node('p','Sua autorização não permite assumir ou devolver ao agente.','muted'));
    }
    await show(rows[0]);
  }
  return {...ui,setMode(next:string){mode=next;if(activeReview){if(next==='inline'){activeReview=undefined;void load({structuredContent:context});}else activeReview.setMode('fullscreen');}else void (context?load({structuredContent:context}):ui.setMode(next));},bootstrap(result:Row){void load(result);}};
}
