import {reviewerContract} from '../tests/fixtures/app-reviewer.js';
import { liveScenarios,liveStage,liveTool,resetLive,liveReply } from './scenarios/live.js';
import { globalScenarios,globalLink } from './scenarios/global.js';
import { hostStyles, hostLabel, plainToolResponse, type DemoHost } from './scenarios/hosts.js';
import { applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { templateScenarios, templateTool, templateStage } from './scenarios/template.js';
import { caseScenarios, casesStage, casesTool } from './scenarios/cases.js';
import { bookingScenarios, bookingStage, bookingTool } from './scenarios/booking.js';
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { bootstrap, customerId, conversationId, conversation as baseConversation, radar, history, draftText, shortText } from './demo-data.js';
import './review.css';
import './host.css';

const params = new URLSearchParams(location.search);
let theme: 'light' | 'dark' = params.get('theme') === 'dark' ? 'dark' : 'light';
let scenario = params.get('scenario') ?? 'normal';
function conversation(closed=false,selected=0):any {return scenario==='instagram'?{...reviewerContract.conversations[10],id:conversationId,window_expires_at:new Date(Date.now()+120*60000).toISOString(),status:'active'}:baseConversation(closed,selected);}
let body = draftText, selectedPerson = 0, receiptStatus = '', current: View | null = null;
let contextSnapshot: unknown = null, generation = 0;
type View = { bridge: AppBridge; iframe: HTMLIFrameElement; mount: HTMLElement; kind: string; fullscreen: boolean; generation: number; ready: boolean; deepLink?: string };
const views: View[] = [];
let host=(params.get('host')??'chatgpt') as DemoHost;
let appliedHostVariables:string[]=[];function applyDemoStyles(){for(const key of appliedHostVariables)document.documentElement.style.removeProperty(key);applyDocumentTheme(theme);const vars=hostStyles(host,theme)?.variables??{} as any;applyHostStyleVariables(vars);appliedHostVariables=Object.keys(vars);}
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
app.innerHTML = `<div class="host-shell"><aside class="host-sidebar" aria-label="Barra lateral"><div class="host-sidebar-top"><span class="host-symbol" aria-hidden="true">◉</span><button id="sidebar-toggle" aria-label="Fechar barra lateral">◫</button></div><button id="new-chat" class="sidebar-action">↗ <span>Novo chat</span></button><div class="sidebar-action">⌕ <span>Buscar em chats</span></div><div class="sidebar-action">▤ <span>Biblioteca</span></div><p class="sidebar-section">Seus chats</p><p class="sidebar-chat active">Meu dia no BotoZap</p><p class="sidebar-chat">Ideias para a coleção de outubro</p><p class="sidebar-chat">Planejamento da semana</p><div class="host-profile"><span class="avatar" aria-hidden="true">FO</span><div>Fernando<small>Simulador local · dados fictícios</small></div></div></aside><div class="host-main"><header class="host-header"><button id="mobile-menu" aria-label="Abrir barra lateral">☰</button><span class="host-name">ChatGPT <span aria-hidden="true">⌄</span></span><div class="host-controls"><label class="sr-only" for="scenario">Cenário simulado</label><select id="scenario"><option value="normal">Roteiro completo</option><option value="closed">Janela fechada</option><option value="rejected">Recusado</option><option value="uncertain">Incerto</option><option value="empty">Sem pendências</option><option value="loading">Carregando</option><option value="error">Erro de consulta</option></select><button id="theme" aria-label="Alternar tema">◐</button><button id="replay">Reiniciar</button></div></header><main id="thread" class="host-thread" aria-label="Conversa com o ChatGPT"></main><div id="fullscreen-bar" hidden><span>Conversa · BotoZap</span><button id="close-fullscreen" aria-label="Voltar ao chat">✕</button></div><div id="composer-wrap" class="host-composer-wrap"><form id="composer" class="host-composer"><label class="sr-only" for="prompt">Mensagem para o ChatGPT</label><textarea id="prompt" rows="1" placeholder="Pergunte alguma coisa…"></textarea><div class="composer-tools"><span aria-hidden="true">＋</span><span class="composer-hint">BotoZap conectado</span><button type="submit" id="submit" aria-label="Enviar mensagem ao ChatGPT">↑</button></div></form><p class="host-disclaimer">Simulação local do ChatGPT. Mensagens e eventos do BotoZap são fictícios.</p></div></div></div>`;
for (const entry of [templateScenarios, caseScenarios, bookingScenarios, liveScenarios, globalScenarios,{kind:'Piloto real',options:[['pilot-global','P1 · Pendências · negócio único'],['pilot-unlinked','P1 · Agendamento sem conversa'],['pilot-alerts','P1 · Alerta crítico sem casos'],['cases-p2','P2 · Reconhecido + 8 pausadas'],['cases-p3','P3 · Conversas agrupadas'],['instagram','Instagram · Revisar resposta']]}]) { const group=document.createElement('optgroup');group.label=entry.kind;for(const [id,label] of entry.options){const option=document.createElement('option');option.value=id!;option.textContent=label!;group.append(option);} $('scenario').append(group); }
const hostSelect=document.createElement('select');hostSelect.id='host';hostSelect.setAttribute('aria-label','Host simulado');for(const [id,label]of [['chatgpt','ChatGPT'],['generic','Genérico MCP Apps'],['none','Sem UI']]){const o=document.createElement('option');o.value=id!;o.textContent=label!;hostSelect.append(o);}hostSelect.value=host;hostSelect.onchange=()=>{host=hostSelect.value as DemoHost;applyDemoStyles();void reset();};document.querySelector('.host-controls')!.prepend(hostSelect);
applyDemoStyles();
$('scenario').setAttribute('value', scenario); ($('scenario') as HTMLSelectElement).value = scenario;
function user(text: string) { const article = document.createElement('article'); article.className = 'host-user'; article.setAttribute('aria-label','Você'); article.textContent = text; $('thread').append(article); }
function assistant(text: string) { const article = document.createElement('article'); article.className = 'host-assistant'; article.setAttribute('aria-label',hostLabel(host)); const p = document.createElement('p'); p.textContent = text; article.append(p); $('thread').append(article); return article; }
function hostContext(view: Pick<View, 'iframe' | 'fullscreen'>): McpUiHostContext {
  const bottom = Math.ceil($('composer-wrap').getBoundingClientRect().height) + 20;
  return { theme, styles:hostStyles(host,theme), userAgent:hostLabel(host), displayMode: view.fullscreen ? 'fullscreen' : 'inline', availableDisplayModes: ['inline','fullscreen'], platform: innerWidth < 700 ? 'mobile' : 'web', locale: 'pt-BR', timeZone: 'America/Sao_Paulo', safeAreaInsets: { top: 0, right: 0, bottom: view.fullscreen ? bottom : 0, left: 0 }, containerDimensions: { width: view.iframe.clientWidth, maxHeight: view.fullscreen ? innerHeight-70 : 1000 } };
}
function sync(view: View) { if (view.ready) view.bridge.setHostContext({...hostContext(view),...(host==='chatgpt'&&view.deepLink?{'openai/deepLink':{url:view.deepLink}}:{})}); }
function display(view: View, fullscreen: boolean) {
  view.fullscreen = fullscreen; view.iframe.classList.toggle('is-fullscreen', fullscreen);
  document.body.classList.toggle('has-fullscreen', fullscreen); $('fullscreen-bar').hidden = !fullscreen;
  for (const message of Array.from($('thread').children)) (message as HTMLElement).inert = fullscreen && message !== view.mount;
  current = view; sync(view);
  if(fullscreen)window.scrollTo({top:0,left:0});
  if (!fullscreen) view.iframe.scrollIntoView({ block: 'end' });
}
async function createView(kind: 'carousel' | 'review' | 'template' | 'cases' | 'booking' | 'live' | 'global', result: Record<string, any>, tool: string, input?: Record<string, any>, introduction?: string, deepLink?: string) {
  const briefing = scenario === 'empty' ? 'Você está em dia. Nenhuma conversa está aguardando resposta agora.' : scenario === 'error' ? 'Não consegui consultar suas pendências. Peça para consultar novamente quando quiser.' : scenario === 'loading' ? 'Estou consultando suas conversas para organizar as prioridades.' : 'Separei as conversas que precisam de você hoje. Marina está esperando há 3 horas — eu começaria por ela.';
  const article = assistant(introduction ?? (kind === 'carousel' ? briefing : tool === 'open_review_panel' ? 'Este é seu Radar. Troque o negócio, escolha uma pendência e revise a conversa comigo antes de enviar.' : 'Preparei uma resposta com o prazo confirmado pela produção. Você pode ajustar comigo antes de enviar.'));
  if(host==='none'){const text=document.createElement('pre');text.className='plain-tool-response';text.textContent=plainToolResponse(kind,tool==='open_review_panel'?{structuredContent:radar()}:result,tool);article.append(text);article.scrollIntoView({block:'start'});return null as unknown as View;}
  const label = document.createElement('div'); label.className = 'host-app-label'; label.innerHTML = '<span aria-hidden="true">◈</span> BotoZap'; article.append(label);
  const iframe = document.createElement('iframe'); iframe.title = kind === 'carousel' ? 'BotoZap — pendências' : 'BotoZap — resposta e conversa'; iframe.className = 'host-app-frame'; iframe.setAttribute('sandbox','allow-scripts allow-same-origin'); article.append(iframe);
  const bridge = new AppBridge(null, { name: `${hostLabel(host)} local simulator`, version: '2.0.0' }, { serverTools: {}, updateModelContext: { text: {} }, message: { text: {} } }, { hostContext: {...hostContext({ iframe, fullscreen: false }),...(host==='chatgpt'&&deepLink?{'openai/deepLink':{url:deepLink}}:{})} });
  const view: View = { bridge, iframe, mount: article, kind, fullscreen: false, generation, ready: false, deepLink }; views.push(view); current = view;
  bridge.onsizechange = ({ height }) => { if (!view.fullscreen) { const next = `${Math.ceil(height ?? 350)}px`; const changed = iframe.style.height !== next; iframe.style.height = next; if (changed && current === view && kind !== 'carousel') iframe.scrollIntoView({ block: 'end' }); } };
  bridge.onopenlink = async ({url}) => { if(new URL(url).origin!=='https://botozap.com.br')throw new Error('Destino não autorizado');assistant('O host abriria o BotoZap em uma nova aba: '+url);return {}; };
  bridge.onupdatemodelcontext = async value => { contextSnapshot = value; document.documentElement.dataset.contextReceived = 'true'; return {}; };
  bridge.onrequestdisplaymode = async ({ mode }) => { if(mode==='inline'&&current!==view&&!view.fullscreen){sync(view);return {mode:'inline'};}display(view, mode === 'fullscreen'); return { mode: view.fullscreen ? 'fullscreen' : 'inline' }; };
  bridge.onmessage = async ({ content }) => {
    const text = content.filter(c => c.type === 'text').map(c => c.text).join(' ');
    if (text.includes('00000000-0000-4000-8000-000000000006')) selectedPerson = 1;
    else if (text.includes('00000000-0000-4000-8000-000000000007')) selectedPerson = 2;
    user(`Prepare uma resposta para ${conversation(false, selectedPerson).contact.name.split(' ')[0]}.`);
    if(view.kind==='live'){body='Claro, Marina! Vamos embalar cada lembrança separadamente.';await replyView();return {};}
    body = draftText.replaceAll('Marina', conversation(false, selectedPerson).contact.name.split(' ')[0]); await replyView(); return {};
  };
  bridge.oncalltool = async ({ name, arguments: args }) => {
    const data = await fakeTool(name, args ?? {}, view);
    return { content: [{ type: 'text', text: JSON.stringify(data.structuredContent ?? {}) }], ...data };
  };
  const ready = new Promise<void>(resolve => {
    bridge.oninitialized = () => { view.ready = true; void (async () => {
      await bridge.sendToolInput({ arguments: input ?? (tool === 'list_radar' ? { customer_id: customerId } : { conversation_id: conversationId, text: body }) });
      if (scenario !== 'loading' && !scenario.endsWith('-loading')) await bridge.sendToolResult({ content: [], ...result });
      resolve();
    })(); };
  });
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  iframe.src = `/app?view=${kind}`;
  await ready; (kind !== 'carousel' ? iframe : article).scrollIntoView({ block: kind !== 'carousel' ? 'end' : 'start' });
  return view;
}
async function fakeTool(name: string, args: Record<string, unknown>, view: View): Promise<Record<string, any>> {
  const liveResult=liveTool(name);if(liveResult)return liveResult;
  const templateResult = await templateTool(name, args, scenario); if (templateResult) return templateResult;
  const caseResult = await casesTool(name, args, scenario); if (caseResult) return caseResult;
  const bookingResult = await bookingTool(name, args, scenario); if (bookingResult) return bookingResult;
  switch(name) {
    case 'get_contact': { const person = conversation(false, String(args.id).endsWith('012') ? 1 : String(args.id).endsWith('022') ? 2 : 0); return { structuredContent: { data: { id: args.id, display_name: person.contact.name, profile_name: person.contact.name } } }; }
    case 'get_phone_number':return {structuredContent:{data:{id:args.id,customer_id:customerId}}};
    case 'get_customer': return { structuredContent: { data: bootstrap.customers.data.find(c => c.id === args.id) ?? bootstrap.customers.data[0] } };
    case 'open_review_panel': return { structuredContent: pilotBootstrap() };
    case 'list_radar': return { structuredContent: pilotRadar() };
    case 'list_opportunity_conversations': case 'list_demand_conversations': return { structuredContent: { data: [{ conversation_id: conversationId }], meta: { page: 1, total_pages: 1 } } };
    case 'get_conversation': {const data=conversation((scenario === 'closed' || scenario.startsWith('template')), String(args.id).endsWith('013') ? 1 : String(args.id).endsWith('023') ? 2 : selectedPerson);if(scenario.startsWith('cases-p'))Object.assign(data,{id:args.id,agent_paused_at:new Date(Date.now()-12*60000).toISOString()});if(scenario==='global'||liveReply())data.last_message_at=new Date().toISOString();return {structuredContent:{data}};}
    case 'list_messages': {const data=history(receiptStatus || undefined,body);const reply=liveReply();if(scenario==='live'&&reply)data.data.push(reply);if(scenario==='global')data.data.push({id:'latest',conversation_id:conversationId,direction:'inbound',content:{text:{body:'Pode confirmar! Vocês conseguem embalar cada lembrança separadamente?'}},created_at:new Date().toISOString()});return {structuredContent:data};}
    case 'reply_to_conversation': {
      await new Promise(resolve => setTimeout(resolve, 600));
      if (scenario === 'rejected') return { isError: true, structuredContent: { error: { outcome: 'rejected', retry: 'backoff', message: 'O número de origem está temporariamente indisponível. Aguarde antes de revisar novamente.' } } };
      if (scenario === 'uncertain') return { isError: true, structuredContent: { error: { outcome: 'unknown', message: 'A conexão caiu depois da solicitação de envio.' } } };
      body = String((args.text as { body?: string })?.body ?? body); receiptStatus = 'accepted';
      // Host simulates delivery events separately from the acceptance receipt.
      setTimeout(() => { if (view.generation !== generation) return; receiptStatus = 'delivered'; void view.bridge.sendToolResult({ content: [], structuredContent: history(receiptStatus, body) }); }, 4500);
      setTimeout(() => { if (view.generation !== generation) return; receiptStatus = 'read'; void view.bridge.sendToolResult({ content: [], structuredContent: history(receiptStatus, body) }); }, 8500);
      if (view.fullscreen) setTimeout(() => { if (view.generation === generation) display(view, false); }, 850);
      return { structuredContent: { id: '00000000-0000-4000-8000-000000000090', wamid: 'wamid.demo', status: 'accepted' } };
    }
    default: return { isError: true, structuredContent: { error: { outcome: 'rejected', message: 'Ferramenta não simulada neste roteiro.' } } };
  }
}
async function replyView() { return createView('review', { structuredContent: { customer_id: customerId, conversation: conversation((scenario === 'closed' || scenario.startsWith('template')), selectedPerson), draft: { text: body, idempotency_key: crypto.randomUUID() } } }, 'stage_review_reply'); }
async function prompt(value: string) {
  const text = value.trim(); if (!text) return; user(text);
  if (/curt|resum/i.test(text) && current?.kind === 'review') {
    let snapshot: Record<string, any> = {}; try { snapshot = JSON.parse((contextSnapshot as { content?: Array<{ text?: string }> })?.content?.[0]?.text ?? '{}'); } catch {}
    if (receiptStatus || ['sending','uncertain','accepted','delivered','read'].includes(snapshot.review_state)) { assistant('Esta mensagem já foi enviada. Para uma nova resposta, peça outro rascunho.'); return; }
    body = shortText.replaceAll('Marina', conversation(false, selectedPerson).contact.name.split(' ')[0]); assistant('Deixei mais direto, mantendo a quantidade e o prazo. O rascunho foi atualizado na conversa.');
    await current.bridge.sendToolResult({ content: [], structuredContent: { customer_id: customerId, conversation: conversation((scenario === 'closed' || scenario.startsWith('template')), selectedPerson), draft: { text: body, idempotency_key: crypto.randomUUID() } } });
    if (!current.fullscreen) current.iframe.scrollIntoView({ block: 'end' });
  } else if (/plantão|ao vivo/i.test(text)) {if(!receiptStatus){assistant('Primeiro confirme o envio; depois posso abrir o acompanhamento.');return;}resetLive();await createView('live',liveStage(),'open_live_conversation',{conversation_id:conversationId,message_id:'wamid.demo'},'O envio foi aceito. Vou acompanhar os eventos desta conversa. PiP ainda não está disponível no ChatGPT; o plantão permanece inline.');}
  else if (/radar|negócios/i.test(text)) { const view = await createView('review', { structuredContent: bootstrap }, 'open_review_panel');  }
  else if (/respond|marina/i.test(text)) await replyView();
  else await createView('carousel', scenario === 'error' ? { isError: true } : { structuredContent: radar(scenario === 'empty') }, 'list_radar');
}
function pilotBootstrap(){return scenario.startsWith('pilot-')?{...bootstrap,customers:{data:bootstrap.customers.data.slice(0,1),meta:{...bootstrap.customers.meta,total_count:1}}}:bootstrap;}
function pilotRadar(){if(scenario==='pilot-unlinked')return {data:[{id:'00000000-0000-4000-8000-000000000081',customer_id:customerId,entity_type:'appointment',kind:'meeting',title:'Reunião com Marina',contact_name:'Marina Oliveira',next_step:'Registrar comparecimento',bucket:'scheduled'}],meta:{page:1,total_pages:1,total_count:1}};return radar(scenario==='empty');}
async function reset() {
  const link=document.getElementById('demo-deep-link');if(link)link.hidden=host!=='chatgpt'||scenario!=='global';
  const sidebar=document.getElementById('open-botozap');if(sidebar)sidebar.hidden=host!=='chatgpt';
  document.querySelector('.host-name')!.textContent=hostLabel(host);$('thread').setAttribute('aria-label',`Conversa com ${hostLabel(host)}`);document.querySelector('label[for=prompt]')!.textContent=`Mensagem para ${host==='chatgpt'?'o ChatGPT':hostLabel(host)}`;$('submit').setAttribute('aria-label',`Enviar mensagem ${host==='chatgpt'?'ao ChatGPT':`a ${hostLabel(host)}`}`);document.querySelector('.host-disclaimer')!.textContent=`Simulação local de ${hostLabel(host)}. Mensagens e eventos do BotoZap são fictícios.`;
  generation++; receiptStatus = ''; body = draftText; selectedPerson = 0;
  for (const view of views.splice(0)) void view.bridge.close(); current = null;
  $('thread').replaceChildren(); $('thread').inert = false; document.body.classList.remove('has-fullscreen'); $('fullscreen-bar').hidden = true;
  resetLive();
  if(scenario==='pilot-global'){user('O que tenho pendente?');const view=await createView('global',{structuredContent:pilotBootstrap()},'open_botozap',{},'Estas são suas pendências.');}
  else if(scenario==='pilot-unlinked'){user('O que tenho pendente?');await createView('carousel',{structuredContent:pilotRadar()},'list_radar',{customer_id:customerId},'Há um comparecimento para registrar.');}
  else if(scenario==='pilot-alerts'){user('O agente precisa de mim?');await createView('cases',{structuredContent:{customer_id:customerId,cases:{data:[],meta:{total_count:0}},alerts:{data:[{id:'00000000-0000-4000-8000-000000000082',status:'open',severity:'critical',kind:'manipulation_detected',kind_label:'Tentativa de manipulação',title:'Tentativa de manipulação',detail:'O contato tentou alterar as instruções do agente.',conversation_id:conversationId}],meta:{total_count:1}},paused:{data:[{id:conversationId,contact:{name:'Marina Oliveira'},agent_paused_at:new Date(Date.now()-12*60000).toISOString()}],paging:{next:null}},can_update:false}},'open_agent_cases',{},'Encontrei um alerta crítico aberto.');}
  else if(scenario==='global') {user(host==='chatgpt'?'Abrir BotoZap pela barra lateral, no link da conversa.':'Abra minhas pendências no BotoZap.');const view=await createView('global',{structuredContent:bootstrap},'open_botozap',{},host==='chatgpt'?'Abri a conversa indicada no link. O histórico é consultado com suas permissões.':'Neste host, consulte as pendências pelo Radar; links OpenAI são opcionais.',globalLink.url);}
  else if(scenario==='instagram'){body='Olá! Posso ajudar com esse pedido?';user('Prepare uma resposta para o contato no Instagram.');await replyView();}
  else if(scenario==='live'){user('Prepare uma resposta para Marina.');await replyView();}
  else if(scenario==='template-reviewer'){user('Prepare confirmacao_pedido para Fernando, pedido 12345, entrega amanhã na Rua de teste.');await createView('template',{structuredContent:templateStage(scenario)},'stage_review_template',{conversation_id:reviewerContract.conversations[0].id,template_id:'confirmacao_pedido'},'Preparei o template aprovado. A janela está aberta; confira os quatro campos antes de enviar.');}
  else if(scenario==='template-loading') { user('Consulte os templates aprovados para retomar a conversa.'); await createView('template',{structuredContent:templateStage(scenario)},'stage_review_template',{conversation_id:conversationId},'Estou consultando os templates aprovados deste número.'); }
  else if(scenario.startsWith('template')) { user('A janela da Marina fechou. Como retomo a conversa?'); await replyView(); }
  else if(scenario.startsWith('cases')) { user('Como foi o atendimento do agente hoje?'); await createView('cases',casesStage(scenario),'open_agent_cases',{customer_id:customerId},scenario.startsWith('cases-p')?'Há 1 alerta crítico reconhecido, 8 conversas pausadas aguardando humano e 0 casos abertos.':'O agente resolveu os atendimentos de rotina. Este pedido de desconto precisa da sua decisão.'); }
  else if(scenario.startsWith('booking')) { user('Marque um horário para a Marina escolher os acabamentos.'); await createView('booking',bookingStage(scenario),'stage_appointment_booking',{},'Encontrei estes horários com a Sofia no Ateliê das Águas. Escolha um para revisar antes de marcar e avisar a Marina.'); }
  else await prompt('O que tenho hoje no BotoZap?');
  document.documentElement.dataset.demoReady = 'true';
}
$('composer').onsubmit = event => { event.preventDefault(); const field = $('prompt') as HTMLTextAreaElement; const value = field.value; field.value = ''; void prompt(value); };
$('prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ($('composer') as HTMLFormElement).requestSubmit(); } };
$('theme').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; applyDemoStyles(); views.forEach(sync); };
$('scenario').onchange = () => { scenario = ($('scenario') as HTMLSelectElement).value; void reset(); };
$('replay').onclick = () => void reset(); $('new-chat').onclick = () => void reset();
$('close-fullscreen').onclick = () => { if(current) display(current,false); };
const alertLink=document.createElement('button');alertLink.id='demo-deep-link';alertLink.className='sidebar-action';alertLink.textContent='Marina respondeu · abrir link';alertLink.onclick=()=>{document.body.classList.remove('sidebar-open');if(current?.kind==='global'){current.deepLink=globalLink.url;sync(current);}};document.querySelector('.host-sidebar-top')!.after(alertLink);alertLink.hidden=host!=='chatgpt'||scenario!=='global';
const sidebar=document.createElement('button');sidebar.id='open-botozap';sidebar.className='sidebar-action';sidebar.textContent='◈ BotoZap · Pendências';sidebar.onclick=async()=>{document.body.classList.remove('sidebar-open');const view=await createView('global',{structuredContent:bootstrap},'open_botozap',{},'Suas pendências no BotoZap.');};document.querySelector('.host-sidebar-top')!.after(sidebar);sidebar.hidden=host!=='chatgpt';
$('mobile-menu').onclick = () => document.body.classList.add('sidebar-open'); $('sidebar-toggle').onclick = () => document.body.classList.remove('sidebar-open');
new ResizeObserver(() => views.forEach(sync)).observe($('composer-wrap'));
window.addEventListener('resize', () => views.forEach(sync));
// Expose read-only diagnostics, not shortcuts that bypass the app protocol.
Object.defineProperty(window, 'botozapHostDiagnostics', { get: () => ({ contextSnapshot, views: views.length, receiptStatus }) });
void reset();
