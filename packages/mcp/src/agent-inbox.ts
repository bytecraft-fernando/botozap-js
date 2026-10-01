/** Pure presentation contract shared by the MCP result and browser. */
type Row=Record<string,any>;
const media:Record<string,string>={audio:'Áudio',image:'Imagem',video:'Vídeo',document:'Documento',sticker:'Figurinha',location:'Localização',contacts:'Contato compartilhado',reaction:'Reação',interactive:'Mensagem interativa',template:'Template',unsupported:'Mensagem não suportada'};
export function messagePreview(message:Row|undefined|null):string {
 if(!message)return '';
 if(message.revoked_at)return 'Mensagem removida';
 const c=message.content;
 for(const value of [typeof c==='string'?c:null,c?.body,c?.text, c?.text?.body,c?.caption,c?.[message.type]?.caption,message.body])if(typeof value==='string'&&value.trim())return value.trim();
 return media[message.type||message.kind]||'Mensagem sem texto';
}
const reasons:Record<string,string>={authority_claim:'alegou ser o dono ou ter permissão especial',instruction_override:'tentou alterar as regras do atendimento',role_override:'tentou mudar o papel do agente',prompt_extraction:'pediu instruções internas do agente',secret_request:'pediu credenciais ou segredos',data_exfiltration:'tentou acessar dados de outras pessoas',fake_system_marker:'simulou uma instrução do sistema',encoded_payload:'enviou instruções disfarçadas ou codificadas'};
const kinds:Record<string,string>={manipulation_detected:'Tentativa de manipulação',guard_unavailable:'Verificação de segurança indisponível',evaluation_vetoed:'Resposta bloqueada pela avaliação',evaluation_unavailable:'Avaliação indisponível',urgent_contact:'Contato precisa de atenção urgente',eligibility_blocked:'Atendimento bloqueado pelo acesso',credential_unavailable:'Credencial da IA indisponível',credential_rejected:'Credencial recusada pelo provedor',token_budget_exhausted:'Limite de tokens atingido',plan_past_due:'Atendimento bloqueado por pagamento pendente',data_use_ack_required:'Confirmação de uso de dados pendente',approval_reply_held:'Resposta aprovada retida para revisão',reply_held:'Resposta retida para revisão',checkpoint_policy:'Execução aguardando revisão de segurança',secret_in_tool_plan:'Plano bloqueado por conter credenciais',plan_free_form_limit:'Limite de respostas do plano atingido'};
export function alertCopy(alert:Row){
 const title=kinds[alert.kind]||'Alerta aguardando revisão';
 if(alert.kind==='manipulation_detected'){
  const codes=[...(Array.isArray(alert.reasons)?alert.reasons:[]),...Object.keys(reasons).filter(code=>String(alert.detail||'').includes(code))];
  const labels=[...new Set(codes.map(code=>reasons[code]).filter(Boolean))];
  return {title,detail:labels.length?`O contato ${labels.join('; ')}. Revise a conversa antes de responder.`:'Uma mensagem foi retida por segurança. Revise a conversa antes de responder.'};
 }
 return {title,detail:`${title}. Confira o atendimento no BotoZap antes de agir.`};
}
export function groupInbox(context:Row):Row[]{
 const items=[...(context.alerts?.data||[]).filter((r:Row)=>['open','acknowledged'].includes(r.status)).map((r:Row)=>({...r,item_type:'alert'})),...(context.paused?.data||[]).filter((r:Row)=>r.agent_paused_at).map((r:Row)=>({...r,conversation_id:r.id,item_type:'paused'})),...(context.cases?.data||[]).filter((r:Row)=>['open','waiting'].includes(r.status)).map((r:Row)=>({...r,item_type:'case'}))];
 const groups=new Map<string,Row>();
 for(const item of items){const key=item.conversation_id||`${item.item_type}:${item.id}`;const group:Row=groups.get(key)??{...item,alerts:[],cases:[],customer_ids:[],business_names:[]};groups.set(key,group);
  if(item.customer_id&&!group.customer_ids.includes(item.customer_id))group.customer_ids.push(item.customer_id);
  if(item.customer_name&&!group.business_names.includes(item.customer_name))group.business_names.push(item.customer_name);
  if(item.item_type==='alert')group.alerts.push(item);if(item.item_type==='case')group.cases.push(item);
  if(item.agent_paused_at){group.agent_paused_at=item.agent_paused_at;group.contact=item.contact;}
  if(item.contact_name)group.contact_name=item.contact_name;
  if(item.latest_customer_message&&(!group.latest_customer_message||Date.parse(item.latest_customer_message.created_at)>Date.parse(group.latest_customer_message.created_at)))group.latest_customer_message=item.latest_customer_message;
 }
 for(const group of groups.values()){
  group.severity=group.alerts.some((a:Row)=>a.severity==='critical')?'critical':group.alerts[0]?.severity;
  group.item_type=group.alerts.length?'alert':group.cases.length?'case':'paused';
  group.primary_case=group.cases[0];
 }
 return [...groups.values()].sort((a,b)=>(a.severity==='critical'?0:a.alerts.length?1:a.agent_paused_at?2:3)-(b.severity==='critical'?0:b.alerts.length?1:b.agent_paused_at?2:3));
}
