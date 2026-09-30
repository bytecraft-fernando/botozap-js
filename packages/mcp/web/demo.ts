import { templateScenarios, templateTool, templateStage } from './scenarios/template.js';
import { caseScenarios, casesStage, casesTool } from './scenarios/cases.js';
import { bookingScenarios, bookingStage, bookingTool } from './scenarios/booking.js';
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { bootstrap, customerId, conversationId, conversation, radar, history, draftText, shortText } from './demo-data.js';
import './review.css';
import './host.css';

const params = new URLSearchParams(location.search);
let theme: 'light' | 'dark' = params.get('theme') === 'dark' ? 'dark' : 'light';
let scenario = params.get('scenario') ?? 'normal';
let body = draftText, selectedPerson = 0, receiptStatus = '', current: View | null = null;
let contextSnapshot: unknown = null, generation = 0;
type View = { bridge: AppBridge; iframe: HTMLIFrameElement; mount: HTMLElement; kind: string; fullscreen: boolean; generation: number; ready: boolean };
const views: View[] = [];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
app.innerHTML = `<div class="host-shell"><aside class="host-sidebar" aria-label="Barra lateral"><div class="host-sidebar-top"><span class="host-symbol" aria-hidden="true">◉</span><button id="sidebar-toggle" aria-label="Fechar barra lateral">◫</button></div><button id="new-chat" class="sidebar-action">↗ <span>Novo chat</span></button><div class="sidebar-action">⌕ <span>Buscar em chats</span></div><div class="sidebar-action">▤ <span>Biblioteca</span></div><p class="sidebar-section">Seus chats</p><p class="sidebar-chat active">Meu dia no BotoZap</p><p class="sidebar-chat">Ideias para a coleção de outubro</p><p class="sidebar-chat">Planejamento da semana</p><div class="host-profile"><span class="avatar" aria-hidden="true">FO</span><div>Fernando<small>Simulador local · dados fictícios</small></div></div></aside><div class="host-main"><header class="host-header"><button id="mobile-menu" aria-label="Abrir barra lateral">☰</button><span class="host-name">ChatGPT <span aria-hidden="true">⌄</span></span><div class="host-controls"><label class="sr-only" for="scenario">Cenário simulado</label><select id="scenario"><option value="normal">Roteiro completo</option><option value="closed">Janela fechada</option><option value="rejected">Recusado</option><option value="uncertain">Incerto</option><option value="empty">Sem pendências</option><option value="loading">Carregando</option><option value="error">Erro de consulta</option></select><button id="theme" aria-label="Alternar tema">◐</button><button id="replay">Reiniciar</button></div></header><main id="thread" class="host-thread" aria-label="Conversa com o ChatGPT"></main><div id="fullscreen-bar" hidden><span>Conversa · BotoZap</span><button id="close-fullscreen" aria-label="Voltar ao chat">✕</button></div><div id="composer-wrap" class="host-composer-wrap"><form id="composer" class="host-composer"><label class="sr-only" for="prompt">Mensagem para o ChatGPT</label><textarea id="prompt" rows="1" placeholder="Pergunte alguma coisa…"></textarea><div class="composer-tools"><span aria-hidden="true">＋</span><span class="composer-hint">BotoZap conectado</span><button type="submit" id="submit" aria-label="Enviar mensagem ao ChatGPT">↑</button></div></form><p class="host-disclaimer">Simulação local do ChatGPT. Mensagens e eventos do BotoZap são fictícios.</p></div></div></div>`;
for (const entry of [templateScenarios, caseScenarios, bookingScenarios]) { const group=document.createElement('optgroup');group.label=entry.kind;for(const [id,label] of entry.options){const option=document.createElement('option');option.value=id!;option.textContent=label!;group.append(option);} $('scenario').append(group); }
applyDocumentTheme(theme);
$('scenario').setAttribute('value', scenario); ($('scenario') as HTMLSelectElement).value = scenario;
function user(text: string) { const article = document.createElement('article'); article.className = 'host-user'; article.setAttribute('aria-label','Você'); article.textContent = text; $('thread').append(article); }
function assistant(text: string) { const article = document.createElement('article'); article.className = 'host-assistant'; article.setAttribute('aria-label','ChatGPT'); const p = document.createElement('p'); p.textContent = text; article.append(p); $('thread').append(article); return article; }
function hostContext(view: Pick<View, 'iframe' | 'fullscreen'>): McpUiHostContext {
  const bottom = Math.ceil($('composer-wrap').getBoundingClientRect().height) + 20;
  return { theme, displayMode: view.fullscreen ? 'fullscreen' : 'inline', availableDisplayModes: ['inline','fullscreen'], platform: innerWidth < 700 ? 'mobile' : 'web', locale: 'pt-BR', timeZone: 'America/Sao_Paulo', safeAreaInsets: { top: 0, right: 0, bottom: view.fullscreen ? bottom : 0, left: 0 }, containerDimensions: { width: view.iframe.clientWidth, maxHeight: view.fullscreen ? innerHeight-70 : 1000 } };
}
function sync(view: View) { if (view.ready) view.bridge.setHostContext(hostContext(view)); }
function display(view: View, fullscreen: boolean) {
  view.fullscreen = fullscreen; view.iframe.classList.toggle('is-fullscreen', fullscreen);
  document.body.classList.toggle('has-fullscreen', fullscreen); $('fullscreen-bar').hidden = !fullscreen;
  for (const message of Array.from($('thread').children)) (message as HTMLElement).inert = fullscreen && message !== view.mount;
  current = view; sync(view);
  if (!fullscreen) view.iframe.scrollIntoView({ block: 'end' });
}
async function createView(kind: 'carousel' | 'review' | 'template' | 'cases' | 'booking', result: Record<string, any>, tool: string, input?: Record<string, any>, introduction?: string) {
  const briefing = scenario === 'empty' ? 'Você está em dia. Nenhuma conversa está aguardando resposta agora.' : scenario === 'error' ? 'Não consegui consultar suas pendências. Peça para consultar novamente quando quiser.' : scenario === 'loading' ? 'Estou consultando suas conversas para organizar as prioridades.' : 'Separei as conversas que precisam de você hoje. Marina está esperando há 3 horas — eu começaria por ela.';
  const article = assistant(introduction ?? (kind === 'carousel' ? briefing : tool === 'open_review_panel' ? 'Este é seu Radar. Troque o negócio, escolha uma pendência e revise a conversa comigo antes de enviar.' : 'Preparei uma resposta com o prazo confirmado pela produção. Você pode ajustar comigo antes de enviar.'));
  const label = document.createElement('div'); label.className = 'host-app-label'; label.innerHTML = '<span aria-hidden="true">◈</span> BotoZap'; article.append(label);
  const iframe = document.createElement('iframe'); iframe.title = kind === 'carousel' ? 'BotoZap — pendências' : 'BotoZap — resposta e conversa'; iframe.className = 'host-app-frame'; iframe.setAttribute('sandbox','allow-scripts allow-same-origin'); article.append(iframe);
  const bridge = new AppBridge(null, { name: 'ChatGPT local simulator', version: '2.0.0' }, { serverTools: {}, updateModelContext: { text: {} }, message: { text: {} } }, { hostContext: hostContext({ iframe, fullscreen: false }) });
  const view: View = { bridge, iframe, mount: article, kind, fullscreen: false, generation, ready: false }; views.push(view); current = view;
  bridge.onsizechange = ({ height }) => { if (!view.fullscreen) { const next = `${Math.ceil(height ?? 350)}px`; const changed = iframe.style.height !== next; iframe.style.height = next; if (changed && current === view && kind !== 'carousel') iframe.scrollIntoView({ block: 'end' }); } };
  bridge.onupdatemodelcontext = async value => { contextSnapshot = value; document.documentElement.dataset.contextReceived = 'true'; return {}; };
  bridge.onrequestdisplaymode = async ({ mode }) => { display(view, mode === 'fullscreen'); return { mode: view.fullscreen ? 'fullscreen' : 'inline' }; };
  bridge.onmessage = async ({ content }) => {
    const text = content.filter(c => c.type === 'text').map(c => c.text).join(' ');
    if (text.includes('00000000-0000-4000-8000-000000000006')) selectedPerson = 1;
    else if (text.includes('00000000-0000-4000-8000-000000000007')) selectedPerson = 2;
    user(`Prepare uma resposta para ${conversation(false, selectedPerson).contact.name.split(' ')[0]}.`);
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
  const templateResult = await templateTool(name, args, scenario); if (templateResult) return templateResult;
  const caseResult = await casesTool(name, args, scenario); if (caseResult) return caseResult;
  const bookingResult = await bookingTool(name, args, scenario); if (bookingResult) return bookingResult;
  switch(name) {
    case 'get_contact': { const person = conversation(false, String(args.id).endsWith('012') ? 1 : String(args.id).endsWith('022') ? 2 : 0); return { structuredContent: { data: { id: args.id, display_name: person.contact.name, profile_name: person.contact.name } } }; }
    case 'get_customer': return { structuredContent: { data: bootstrap.customers.data.find(c => c.id === args.id) ?? bootstrap.customers.data[0] } };
    case 'open_review_panel': return { structuredContent: bootstrap };
    case 'list_radar': return { structuredContent: radar(scenario === 'empty') };
    case 'list_opportunity_conversations': case 'list_demand_conversations': return { structuredContent: { data: [{ conversation_id: conversationId }], meta: { page: 1, total_pages: 1 } } };
    case 'get_conversation': return { structuredContent: { data: conversation((scenario === 'closed' || scenario.startsWith('template')), String(args.id).endsWith('013') ? 1 : String(args.id).endsWith('023') ? 2 : selectedPerson) } };
    case 'list_messages': return { structuredContent: history(receiptStatus || undefined, body) };
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
  } else if (/radar|negócios/i.test(text)) { const view = await createView('review', { structuredContent: bootstrap }, 'open_review_panel'); display(view, true); }
  else if (/respond|marina/i.test(text)) await replyView();
  else await createView('carousel', scenario === 'error' ? { isError: true } : { structuredContent: radar(scenario === 'empty') }, 'list_radar');
}
async function reset() {
  generation++; receiptStatus = ''; body = draftText; selectedPerson = 0;
  for (const view of views.splice(0)) void view.bridge.close(); current = null;
  $('thread').replaceChildren(); $('thread').inert = false; document.body.classList.remove('has-fullscreen'); $('fullscreen-bar').hidden = true;
  if(scenario==='template-loading') { user('Consulte os templates aprovados para retomar a conversa.'); await createView('template',{structuredContent:templateStage()},'stage_review_template',{conversation_id:conversationId},'Estou consultando os templates aprovados deste número.'); }
  else if(scenario.startsWith('template')) { user('A janela da Marina fechou. Como retomo a conversa?'); await replyView(); }
  else if(scenario.startsWith('cases')) { user('Como foi o atendimento do agente hoje?'); await createView('cases',casesStage(scenario),'open_agent_cases',{customer_id:customerId},'O agente resolveu os atendimentos de rotina. Este pedido de desconto precisa da sua decisão.'); }
  else if(scenario.startsWith('booking')) { user('Marque um horário para a Marina escolher os acabamentos.'); await createView('booking',bookingStage(scenario),'stage_appointment_booking',{},'Encontrei estes horários com a Sofia no Ateliê das Águas. Escolha um para revisar antes de marcar e avisar a Marina.'); }
  else await prompt('O que tenho hoje no BotoZap?');
  document.documentElement.dataset.demoReady = 'true';
}
$('composer').onsubmit = event => { event.preventDefault(); const field = $('prompt') as HTMLTextAreaElement; const value = field.value; field.value = ''; void prompt(value); };
$('prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ($('composer') as HTMLFormElement).requestSubmit(); } };
$('theme').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; applyDocumentTheme(theme); views.forEach(sync); };
$('scenario').onchange = () => { scenario = ($('scenario') as HTMLSelectElement).value; void reset(); };
$('replay').onclick = () => void reset(); $('new-chat').onclick = () => void reset();
$('close-fullscreen').onclick = () => { if(current) display(current,false); };
$('mobile-menu').onclick = () => document.body.classList.add('sidebar-open'); $('sidebar-toggle').onclick = () => document.body.classList.remove('sidebar-open');
new ResizeObserver(() => views.forEach(sync)).observe($('composer-wrap'));
window.addEventListener('resize', () => views.forEach(sync));
// Expose read-only diagnostics, not shortcuts that bypass the app protocol.
Object.defineProperty(window, 'botozapHostDiagnostics', { get: () => ({ contextSnapshot, views: views.length, receiptStatus }) });
void reset();
