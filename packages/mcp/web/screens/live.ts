import { formatPhone } from '../ui-helpers.js';
import type { Bridge } from '../panel.js';
import { shell,node,button,call,type Row } from './screen-kit.js';
import './live.css';
type LiveBridge=Bridge & { liveDisplayMode?(mode:'pip'|'inline'):Promise<unknown> };
export function mountLive(root:HTMLElement,bridge:LiveBridge) {
  const ui=shell(root,'Plantão ao vivo','Acompanhando a conversa', bridge);
  root.dataset.actionPlacement='flow';
  const timeline=node('ol','','live-timeline');timeline.setAttribute('aria-label','Eventos da conversa');ui.content.append(timeline);
  let id='',messageId='',cursor='0',empty='Aguardando eventos desta mensagem.',timer:ReturnType<typeof setTimeout>|undefined,closed=false,busy=false,idle=0,started=Date.now(),epoch=0;
  const seen=new Map<string,Row>();
  function stop(){closed=true;epoch++;clearTimeout(timer);timer=undefined;}
  function end(text:string){stop();ui.state('Encerrado',text);void bridge.liveDisplayMode?.('inline');}
  function render(){
    timeline.replaceChildren();let receipt=0;
    for(const event of [...seen.values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-8)){
      if(event.kind==='typing'&&(Date.now()-Date.parse(event.at)>12000||[...seen.values()].some(e=>e.kind==='reply'&&e.at>=event.at)))continue;
      const level=['sent','delivered','read'].indexOf(event.kind)+1;
      if(level&&level<=receipt)continue;receipt=Math.max(receipt,level);
      const labels:Row={sent:'Enviada ✓',delivered:'Entregue ✓✓',read:'Lida ✓✓',typing:'Digitando…',reply:'Resposta do cliente'};
      const item=node('li','','live-event');const time=node('time',new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(event.at)));time.setAttribute('datetime',event.at);
      item.append(node('strong',labels[event.kind]),time);if(event.text)item.append(node('p',event.text,'screen-preview'));timeline.append(item);
    }
    if(!timeline.childElementCount)timeline.append(node('li',empty));
    ui.state('Ao vivo',`Ao vivo há ${Math.max(1,Math.floor((Date.now()-started)/60000))} min`);
  }
  function apply(data:Row){
    if(data.conversation_id!==id)return;
    cursor=data.cursor;
    if(data.message_id)messageId=data.message_id;
    empty=data.receipt_found===false?'Nenhuma mensagem enviada foi encontrada nesta conversa. Acompanhar não envia mensagens.':data.receipt_status==='failed'?'O envio desta mensagem falhou.':data.receipt_status?'Mensagem aceita; aguardando confirmação de envio.':'Aguardando eventos desta mensagem.';
    const count=seen.size;for(const event of data.events??[]){if(!Number.isFinite(Date.parse(event.at)))continue;seen.set(event.id,event);}
    idle=seen.size>count?0:Math.min(idle+1,4);
    const sent=(data.events??[]).filter((e:Row)=>['sent','delivered','read'].includes(e.kind)).at(0);if(sent)started=Math.min(started,Date.parse(sent.at));
    const heading=ui.main.querySelector('h1')!;heading.textContent=formatPhone(data.contact_name)||'Conversa';render();
    if(!data.session_active)end('Esta conversa terminou. O acompanhamento foi encerrado.');
  }
  async function poll(){
    if(closed||busy)return;if(Date.now()-started>30*60000){end('O plantão terminou. Peça ao assistente para abrir um novo acompanhamento.');return;}
    if(document.hidden){timer=setTimeout(()=>void poll(),10000);return;}
    busy=true;const token=epoch;
    try{const data=await call(bridge,'open_live_conversation',{conversation_id:id,after:cursor,...(messageId?{message_id:messageId}:{})});if(closed||token!==epoch)return;apply(data);if(!closed)timer=setTimeout(()=>void poll(),data.has_more?1000:Math.min(2000*2**idle,30000));}
    catch{if(!closed&&token===epoch){stop();ui.state('Pausado','Não foi possível confirmar o acesso ou consultar os eventos. Peça ao assistente para reabrir o acompanhamento.');void bridge.liveDisplayMode?.('inline');}}
    finally{busy=false;}
  }
  ui.actions.append(button('Responder',async()=>{
    if(!id)return;
    try{await bridge.context({conversation_id:id,untrusted_contact_content:{latest_events:[...seen.values()].filter(e=>e.kind==='reply').slice(-1)}});await bridge.liveDisplayMode?.('inline');await bridge.message?.(`Prepare uma nova resposta para a conversa ${id} considerando a última mensagem recebida. Não envie sem confirmação.`);end('A nova resposta será preparada pelo assistente no chat.');}catch{ui.status.textContent='Peça uma nova resposta pelo compositor do assistente.';}
  },true));
  const pagehide=()=>stop();window.addEventListener('pagehide',pagehide);
  return {...ui,input(args:Row){id=String(args.conversation_id??'');messageId=String(args.message_id??'');},bootstrap(result:Row){if(closed)return;if(result.isError){stop();ui.state('Indisponível','Confira o acesso e reabra o acompanhamento pelo assistente.');return;}const data=result.structuredContent;if(!id)id=data.conversation_id;apply(data);if(!closed&&!timer&&!busy){timer=setTimeout(()=>void poll(),2000);}},dispose(){stop();window.removeEventListener('pagehide',pagehide);}};
}
