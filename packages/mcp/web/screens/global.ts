import type { Bridge } from '../panel.js';
import { mountReview } from '../panel.js';
import { call,type Row } from './screen-kit.js';
export type DeepLink={kind:'home'}|{kind:'conversa'|'pendencia';id:string;entity?:'opportunity'|'demand'};
/** Host already decodes the outer path query. Reject URLs, traversal and ambiguous routes. */
export function parseDeepLink(value:unknown):DeepLink|null {
  if(typeof value!=='string'||value.length>512||!value.startsWith('/')||value.startsWith('//')||value.includes('#')||value.includes('\\')||value.includes('%'))return null;
  if(value==='/')return {kind:'home'};
  const match=/^\/(conversa|pendencia)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\?type=(opportunity|demand))?$/i.exec(value);
  if(!match||match[1].toLowerCase()==='conversa'&&match[3])return null;
  return {kind:match[1].toLowerCase() as 'conversa'|'pendencia',id:match[2].toLowerCase(),...(match[1].toLowerCase()==='pendencia'?{entity:(match[3]?.toLowerCase()??'opportunity') as 'opportunity'|'demand'}:{})};
}
export function mountGlobal(root:HTMLElement,bridge:Bridge){
  root.id='global-container';
  for(const key of ['mode','focus','state','editing','conversationOpen','itemSelected','actionPlacement'])delete root.dataset[key];
  const surface=()=>{const el=document.createElement('div');el.id='app';root.replaceChildren(el);return el;};
  let current=surface();
  let review=mountReview(current,bridge),mode='inline',initial:Row|undefined,lastUrl:unknown,generation=0;
  function home(){current=surface();review=mountReview(current,bridge);review.setMode(mode==='fullscreen'?'fullscreen':'inline');if(initial)review.bootstrap(initial);}
  async function navigate(url:unknown){
    if(url===lastUrl)return;lastUrl=url;const token=++generation;const target=parseDeepLink(url);
    if(!target){const status=root.querySelector('#notice');if(status)status.textContent='Link inválido. Abra uma pendência no Radar.';return;}
    home();if(target.kind==='home')return;
    try{
      let id=target.id;
      if(target.kind==='pendencia'){
        const entity=target.entity==='demand'?'demand':'opportunity';await call(bridge,`get_${entity}`,{id});
        const links=await call(bridge,`list_${entity}_conversations`,{id,per_page:1});id=links.data?.[0]?.conversation_id;
        if(!parseDeepLink(`/conversa/${id}`))throw new Error('Pendência sem conversa disponível.');
      }
      const conversation=(await call(bridge,'get_conversation',{id})).data;
      if(conversation.id!==id||(!conversation.phone_number_id&&conversation.channel!=='instagram'))throw new Error('Conversa indisponível.');
      const number=(await call(bridge,conversation.channel==='instagram'?'get_channel_account':'get_phone_number',{id:conversation.channel==='instagram'?conversation.channel_account?.id:conversation.phone_number_id})).data;
      if(!number.customer_id)throw new Error('Negócio indisponível.');
      if(token!==generation)return;
      review.setMode(mode==='fullscreen'?'fullscreen':'inline');current.dataset.focus='conversation';
      // Existing review loads the authorized history and owns the shared fullscreen footer.
      review.bootstrap({structuredContent:{customer_id:number.customer_id,conversation,draft:{text:'',idempotency_key:crypto.randomUUID()}}});
    }catch{if(token!==generation)return;const notice=root.querySelector('#notice');if(notice)notice.textContent='Não foi possível abrir este link. Confira seu acesso ou escolha uma pendência no Radar.';}
  }
  return {setMode(next:string){mode=next;review.setMode(next==='fullscreen'?'fullscreen':'inline');},bootstrap(result:Row){initial=result;review.bootstrap(result);},hostContext(context:Row){if(context['openai/deepLink'])void navigate(context['openai/deepLink'].url);},connectionError(){review.connectionError();},dispose(){generation++;}};
}
