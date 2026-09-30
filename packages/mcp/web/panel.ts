import { initials, maskedPhone, relative, bucketLabel } from './ui-helpers.js';
type Row = Record<string, any>;
export interface Bridge {
  call(name: string, args: Record<string, unknown>): Promise<any>;
  context(value: unknown): Promise<unknown>;
  message?(text: string): Promise<unknown>;
  displayMode?(mode: 'inline' | 'fullscreen'): Promise<unknown>;
}
class BridgeError extends Error {
  constructor(message: string, readonly outcome?: 'rejected' | 'unknown', readonly retry?: string) { super(message); }
}
function decode(result: any): Row {
  if (result.isError) {
    const error = result.structuredContent?.error;
    const outcome = error?.outcome === 'rejected' || error?.outcome === 'unknown' ? error.outcome : undefined;
    throw new BridgeError(typeof error?.message === 'string' ? error.message : 'Não foi possível acessar estes dados. Confira as permissões e reabra o painel.', outcome, typeof error?.retry === 'string' ? error.retry : undefined);
  }
  if (result.structuredContent) return result.structuredContent;
  for (const block of result.content ?? []) if (block.type === 'text') {
    try { return JSON.parse(block.text); } catch { /* A response must contain structured data. */ }
  }
  throw new Error('O servidor não retornou os dados esperados. Reabra o painel.');
}
const text = (value: unknown) => typeof value === 'string' ? value : '';
const date = (value: unknown) => {
  const d = new Date(text(value));
  return Number.isNaN(d.valueOf()) ? '' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
};
export function mountReview(root: HTMLElement, bridge: Bridge) {
  root.innerHTML = `<main class="workspace"><header><div><p class="eyebrow">PENDÊNCIAS</p><h1>Radar</h1><p class="muted">Escolha o negócio, leia o histórico e confirme o envio.</p></div><span class="badge" id="environment">Conectando…</span></header><p id="identity" class="identity"></p><div id="notice" role="status" aria-live="polite"></div><section class="toolbar"><label for="business">Negócio</label><select id="business" disabled><option value="">Selecione um negócio</option></select><button id="more-business" hidden>Mais negócios</button></section><div class="columns"><section class="panel radar"><div class="section-title"><h2>Pendências</h2><span id="count" class="muted"></span></div><div id="radar-list" class="items"><p class="empty">Selecione um negócio para consultar o Radar.</p></div><button id="more-radar" hidden>Carregar mais</button></section><section class="panel detail"><div class="inline-heading"><div class="person-heading"><span id="avatar" class="avatar" aria-hidden="true"></span><div><p class="eyebrow">Resposta pronta</p><h1 id="contact-name">Conversa</h1><p id="contact-phone" class="muted"></p></div></div><span id="card-state" class="badge" role="status" aria-live="polite">Rascunho</span></div><div id="card-summary" class="card-summary"></div><p id="conversation-urgency" class="conversation-urgency"></p><div class="draft-bubble"><p id="card-preview" class="preview"></p><span id="bubble-status" class="bubble-status">Rascunho · ainda não enviado</span></div><div class="section-title"><h2>Histórico e resposta</h2><span id="window" class="badge"></span></div><p id="recipient" class="muted">Abra um item do Radar.</p><div id="conversations"></div><div id="history" class="history"><p class="empty">O histórico aparecerá aqui.</p></div><button id="more-history" hidden>Mensagens anteriores</button><p class="caption">Mensagens exibidas na ordem em que foram recebidas.</p><label class="draft-label" for="draft">Sua resposta</label><textarea id="draft" rows="5" maxlength="4096" disabled placeholder="Escreva a resposta que deseja revisar…"></textarea><div class="draft-footer" id="draft-controls"><span id="length" class="muted">0 / 4096</span><div class="actions"><button id="edit-draft" class="inline-only">Editar</button><button id="review" class="primary" disabled>Revisar envio</button></div></div><section id="confirmation" class="confirmation" hidden><h3>Confira antes de enviar</h3><dl id="summary"></dl><p id="preview" class="preview"></p><label class="check"><input id="consent" type="checkbox">Conferi o destinatário, o canal e a mensagem.</label><div class="actions"><button id="edit">Editar</button><button id="send" class="primary" disabled>Enviar</button></div></section></section></div></main>`;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  el('card-summary').after(el('notice'));
  el('contact-phone').after(el('conversation-urgency'));
  const business = el<HTMLSelectElement>('business'), draft = el<HTMLTextAreaElement>('draft');
  root.dataset.mode = root.dataset.initialMode === 'inline' ? 'inline' : 'fullscreen'; root.dataset.state = 'draft';
  let account = '', environment = '', customers: Row[] = [], entries: Row[] = [], customerPage = 1, customerPages = 1, radarPage = 1, radarPages = 1;
  let selected: Row | null = null, conversation: Row | null = null, messages: Row[] = [], historyCursor: string | undefined;
  let acceptedId = '', draftVersion = 0;
  let generation = 0, sending = false, locked = false, reviewBody = '', stageGeneration = 0;
  type Intent = { body: string; key: string; uncertain: boolean; destination: string; firstAttemptAt?: number };
  const intents = new Map<string, Intent>();
  const expired = (intent: Intent | undefined) => !!intent?.uncertain && intent.firstAttemptAt !== undefined && Date.now() - intent.firstAttemptAt >= 24 * 60 * 60 * 1000;
  const expiredNotice = () => notice('O prazo de proteção desta tentativa expirou. Confira o histórico no painel BotoZap antes de decidir sobre outro envio. Esta tentativa não será repetida.', 'warning');
  const destination = (c: Row) => JSON.stringify([c.id, c.contact_id, c.phone_number_id, c.channel, c.channel_account?.id, c.contact?.wa_id, c.contact?.phone]);
  const setState = (state: string) => { root.dataset.state = state; el('card-state').textContent = ({ draft: 'Rascunho', confirming: 'Confirmando', sending: 'Enviando', accepted: 'Aceito', delivered: 'Entregue', read: 'Lido', rejected: 'Recusado', uncertain: 'Incerto', closed: 'Janela fechada' } as Row)[state] ?? state; el('bubble-status').textContent = ({ draft: 'Rascunho · ainda não enviado', confirming: 'Confira antes de enviar', sending: 'Enviando…', accepted: '✓ Aceito · aguardando confirmação de entrega', delivered: '✓✓ Entregue · confirmação recebida', read: '✓✓ Lido · confirmação recebida', rejected: 'Não enviado', uncertain: 'Resultado não confirmado', closed: 'Janela de texto fechada' } as Row)[state] ?? ''; context(); };
  const setMode = (mode: 'inline' | 'fullscreen') => { root.dataset.mode = mode; if (mode === 'inline') delete root.dataset.focus; el('review').textContent = mode === 'inline' ? 'Enviar' : 'Revisar envio'; };
  function card() {
    const c = conversation; if (!c) return;
    el('card-summary').replaceChildren();
    const name = text(c.contact?.name) || 'Contato';
    el('avatar').textContent = initials(name); el('contact-name').textContent = name;
    el('contact-phone').textContent = `WhatsApp · ${maskedPhone(text(c.contact?.phone) || text(c.contact?.wa_id))}`;
    const minutes = Math.max(0, Math.ceil((Date.parse(c.window_expires_at ?? '')-Date.now())/60000));
    const window = isOpen() ? `Janela fecha em ${minutes >= 60 ? `${Math.ceil(minutes/60)}h` : `${minutes} min`}` : 'Janela fechada';
    const chips = [customers.find(r => r.id === business.value)?.name || business.value, `Origem ${text(c.display_phone_number) || text(c.channel_account?.display) || c.phone_number_id}`, window];
    chips.forEach((value, index) => { const span = document.createElement('span'); span.className = `chip ${index === 2 && minutes <= 60 ? 'window-warning' : ''}`; span.textContent = value; el('card-summary').append(span); });
    const wait = relative(c.last_message_at || messages.filter(m => m.direction === 'inbound').at(-1)?.created_at);
    el('conversation-urgency').textContent = selected?.bucket ? `${bucketLabel(selected.bucket)} · ${wait ? `Esperando ${wait}` : 'Aguardando resposta'}` : wait ? `Esperando ${wait}` : '';
    el('card-preview').textContent = draft.value || 'Prepare uma resposta nesta conversa.';
  }
  const notice = (message: string, kind = '') => { el('notice').textContent = message; el('notice').className = kind ? `notice ${kind}` : ''; };
  const call = async (name: string, args: Record<string, unknown>) => decode(await bridge.call(name, args));
  const isOpen = () => conversation?.status === 'active' && (!conversation.channel || conversation.channel === 'whatsapp') && Date.parse(conversation.window_expires_at ?? '') > Date.now();
  const canAttempt = () => {
    if (!conversation || (conversation.channel && conversation.channel !== 'whatsapp')) return false;
    const intent = intents.get(conversation.id);
    if (expired(intent)) return false;
    if (root.dataset.mode === 'inline' && intent?.uncertain) return false;
    return isOpen() || (!!intent?.uncertain && intent.destination === destination(conversation));
  };
  const resetDraft = () => { el('card-summary').replaceChildren(); el('card-preview').textContent = ''; root.dataset.editing = 'false'; draft.value = ''; draft.disabled = true; el('length').textContent = '0 / 4096'; el<HTMLButtonElement>('review').disabled = true; el('confirmation').hidden = true; el<HTMLInputElement>('consent').checked = false; reviewBody = ''; };
  const context = () => {
    // Context is scoped to the authorized selection. Contact strings remain explicitly untrusted.
    const payload = { account_id: account, customer_id: business.value || null, entity: selected ? { id: selected.id, type: selected.entity_type } : null, conversation_id: conversation?.id ?? null, review_state: root.dataset.state, untrusted_contact_content: conversation ? { draft: draft.value, contact: conversation.contact, messages: messages.slice(0,20).map(m => ({ direction: m.direction, body: messageBody(m), at: m.created_at })) } : null };
    void bridge.context(payload).catch(() => { /* Context support is optional; sending does not depend on it. */ });
  };
  function messageBody(m: Row) {
    if (m.revoked_at) return 'Mensagem removida pelo remetente';
    if (typeof m.content === 'string') return m.content;
    return text(m.content?.text?.body) || text(m.content?.body) || `[${text(m.type) || 'Mensagem sem texto'}]`;
  }
  function renderHistory() {
    el('history').replaceChildren();
    if (!messages.length) { el('history').textContent = 'Nenhuma mensagem disponível nesta conversa.'; el('more-history').hidden = !historyCursor; context(); return; }
    for (const m of [...messages].sort((a, b) => text(a.created_at).localeCompare(text(b.created_at)))) {
      const article = document.createElement('article'); article.className = `message ${m.direction === 'outbound' ? 'outbound' : ''}`;
      const meta = document.createElement('small'); meta.textContent = `${m.direction === 'outbound' ? 'Equipe' : 'Contato'} · ${relative(m.created_at) || date(m.created_at)}`;
      const body = document.createElement('p'); body.textContent = messageBody(m); article.append(meta, body); el('history').append(article);
    }
    el('more-history').hidden = !historyCursor; context();
  }
  function renderRadar() {
    el('radar-list').replaceChildren(); el('count').textContent = `${entries.length} itens`;
    if (!entries.length) el('radar-list').textContent = 'Nenhum item neste recorte do Radar.';
    const labels: Row = { opportunity: 'Oportunidade', demand: 'Demanda', return: 'Retorno', appointment: 'Agendamento', critical: 'Crítico', at_risk: 'Atenção', scheduled: 'Programado' };
    for (const entry of entries) {
      const button = document.createElement('button'); button.className = 'radar-item'; button.setAttribute('aria-pressed', String(selected?.id === entry.id)); button.disabled = sending;
      const title = document.createElement('strong'); title.textContent = text(entry.title) || labels[entry.entity_type];
      const meta = document.createElement('span'); meta.textContent = `${labels[entry.bucket] ?? 'Acompanhamento'}${relative(entry.last_message_at || entry.created_at) ? ` · Esperando ${relative(entry.last_message_at || entry.created_at)}` : ''}`;
      const next = document.createElement('small'); next.textContent = text(entry.next_step) || 'Próximo passo não definido'; button.append(title, meta, next); button.onclick = () => void selectEntry(entry); el('radar-list').append(button);
    }
    el('more-radar').hidden = radarPage >= radarPages;
  }
  async function loadRadar(append = false) {
    const token = generation, customer = business.value;
    notice('Consultando o Radar…');
    try {
      const data = await call('list_radar', { customer_id: customer, page: append ? radarPage + 1 : 1, per_page: 20 });
      if (token !== generation) return;
      entries = append ? [...entries, ...data.data] : data.data; radarPage = data.meta.page; radarPages = data.meta.total_pages; renderRadar(); notice('');
    } catch (error) { if (token === generation) notice((error as Error).message, 'error'); }
  }
  async function selectEntry(entry: Row) {
    if (sending) return;
    ++stageGeneration;
    const token = ++generation; selected = entry; conversation = null; messages = []; locked = false; resetDraft(); context(); renderRadar(); el('history').textContent = 'Carregando o histórico…'; el('recipient').textContent = text(entry.title); el('window').textContent = ''; el('conversations').replaceChildren(); el('more-history').hidden = true;
    try {
      let ids: string[] = [];
      if (entry.entity_type === 'opportunity' || entry.entity_type === 'demand') {
        const linked = await call(`list_${entry.entity_type}_conversations`, { id: entry.id, page: 1 });
        ids = linked.data.map((row: Row) => row.conversation_id);
        if (linked.meta.total_pages > 1) notice('Mostrando as primeiras 20 conversas vinculadas. Consulte as demais no painel BotoZap.');
      } else if (entry.conversation_id) ids = [entry.conversation_id];
      if (token !== generation) return;
      if (!ids.length) { el('history').textContent = 'Este item não tem conversa vinculada. Abra o painel BotoZap para vincular uma conversa.'; return; }
      if (ids.length > 1) {
        const label = document.createElement('label'); label.textContent = 'Conversa vinculada'; const select = document.createElement('select'); label.append(select);
        const initial = document.createElement('option'); initial.value = ''; initial.textContent = 'Selecione uma conversa'; select.append(initial);
        ids.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = id; select.append(o); });
        select.onchange = () => {
          ++stageGeneration;
          if (select.value) void loadConversation(select.value);
          else { ++generation; conversation = null; messages = []; locked = false; resetDraft(); context(); el('recipient').textContent = ''; el('window').textContent = ''; el('history').textContent = 'Selecione a conversa que deseja responder.'; el('more-history').hidden = true; }
        }; el('conversations').append(label); el('history').textContent = 'Selecione a conversa que deseja responder.';
      } else await loadConversation(ids[0]);
    } catch (error) { if (token === generation) { el('history').textContent = 'Histórico indisponível.'; notice((error as Error).message, 'error'); } }
  }
  async function loadConversation(id: string) {
    const token = ++generation; conversation = null; messages = []; locked = false; resetDraft(); context(); el('history').textContent = 'Carregando mensagens…';
    try {
      const detail = await call('get_conversation', { id });
      if (token !== generation) return;
      if (detail.data.contact_id !== selected?.contact_id) throw new Error('A conversa não corresponde ao contato selecionado. Reabra o painel.');
      const history = await call('list_messages', { conversation_id: id, limit: 20 });
      if (token !== generation) return;
      conversation = detail.data; messages = history.data; historyCursor = history.paging?.next ? history.paging.cursors.after : undefined;
      const c = conversation!; el('recipient').textContent = `${text(c.contact?.name)} · ${text(c.contact?.phone) || text(c.contact?.wa_id) || text(c.contact?.username)} · ${text(c.channel) || 'WhatsApp'} · ${text(c.channel_account?.display) || text(c.display_phone_number) || c.phone_number_id}`;
      el('window').textContent = isOpen() ? `Janela aberta até ${date(c.window_expires_at)}` : 'Janela fechada'; el('window').className = `badge ${isOpen() ? 'success' : 'warning'}`;
      const pending = intents.get(id);
      locked = false; draft.disabled = !isOpen() || !!pending?.uncertain; renderHistory(); card(); setState(pending?.uncertain ? 'uncertain' : isOpen() ? 'draft' : 'closed');
      if (pending?.uncertain) { draft.value = pending.body; reviewBody = pending.body; el('length').textContent = `${draft.value.length} / 4096`; el<HTMLButtonElement>('review').disabled = !canAttempt(); el('review').textContent = 'Revisar tentativa pendente'; notice(root.dataset.mode === 'inline' ? 'O resultado da tentativa anterior está incerto. Confira o histórico no painel BotoZap. Novos envios estão bloqueados.' : 'O resultado da tentativa anterior está incerto. Confira o histórico antes de repetir explicitamente a mesma tentativa com proteção contra duplicidade.', 'warning'); }
      else el('review').textContent = root.dataset.mode === 'inline' ? 'Enviar' : 'Revisar envio';
      if (pending?.uncertain && pending.destination !== destination(c)) { locked = true; el<HTMLButtonElement>('review').disabled = true; notice('O destino da tentativa pendente mudou. Confira o resultado no painel BotoZap antes de enviar outra resposta.', 'warning'); }
      if (expired(pending)) { locked = true; el<HTMLButtonElement>('review').disabled = true; expiredNotice(); }
      if (!isOpen() && !pending?.uncertain) notice(c.channel && c.channel !== 'whatsapp' ? 'Este painel envia respostas de texto pelo WhatsApp. Continue esta conversa no painel BotoZap.' : 'A janela para resposta de texto está fechada. Abra o painel BotoZap para avaliar um template aprovado.', 'warning');
      card();
    } catch (error) { if (token === generation) { el('history').textContent = 'Não foi possível carregar esta conversa.'; notice((error as Error).message, 'error'); } }
  }
  business.onchange = () => { ++stageGeneration; ++generation; selected = null; conversation = null; entries = []; messages = []; locked = false; resetDraft(); el('history').textContent = 'Abra um item do Radar.'; el('recipient').textContent = ''; el('window').textContent = ''; el('conversations').replaceChildren(); el('more-history').hidden = true; context(); renderRadar(); if (business.value) void loadRadar(); };
  el('edit-draft').onclick = () => { if (locked || draft.disabled) return; void (async () => { const result = await bridge.displayMode?.('fullscreen') as { mode?: string } | undefined; const expanded = result?.mode === 'fullscreen'; if (expanded) { setMode('fullscreen'); root.dataset.focus = 'conversation'; } root.dataset.editing = 'true'; if (expanded && business.value) void call('list_radar', { customer_id: business.value, per_page: 20 }).then(data => { const pending = data.data.find((entry: Row) => entry.contact_id === conversation?.contact_id); if (pending && selected) { selected = { ...selected, bucket: pending.bucket, next_step: pending.next_step }; card(); } }).catch(() => {}); if (expanded) el('draft-controls').scrollIntoView({ block: 'center' }); draft.focus({ preventScroll: expanded }); })().catch(() => { root.dataset.editing = 'true'; draft.focus(); }); };
  draft.oninput = () => { acceptedId = ''; card(); context(); setState('draft'); ++stageGeneration; if (conversation) { const intent = intents.get(conversation.id); if (intent && !intent.uncertain && intent.body !== draft.value) intents.delete(conversation.id); } el('length').textContent = `${draft.value.length} / 4096`; el<HTMLButtonElement>('review').disabled = !draft.value.trim() || locked || !isOpen(); el('confirmation').hidden = true; };
  el('review').onclick = () => {
    if (conversation && expired(intents.get(conversation.id))) { expiredNotice(); return; }
    if (!conversation || !canAttempt() || locked || !draft.value.trim()) return;
    root.dataset.editing = 'false'; setState('confirming');
    reviewBody = draft.value; el('preview').textContent = reviewBody; el('summary').replaceChildren();
    const existing = intents.get(conversation.id);
    if (!existing || existing.body !== reviewBody || existing.destination !== destination(conversation)) intents.set(conversation.id, { body: reviewBody, key: crypto.randomUUID(), uncertain: false, destination: destination(conversation) });
    el('send').textContent = intents.get(conversation.id)?.uncertain ? 'Repetir a mesma tentativa' : 'Enviar';
    el<HTMLButtonElement>('edit').disabled = !!intents.get(conversation.id)?.uncertain;
    const c = conversation; const pairs = [['Negócio', customers.find(r => r.id === business.value)?.name || business.value], ['Destinatário', `${text(c.contact?.name)} · ${text(c.contact?.phone) || text(c.contact?.wa_id) || text(c.contact?.username)}`], ['Canal', `${text(c.channel) || 'WhatsApp'} · ${text(c.channel_account?.display) || text(c.display_phone_number) || c.phone_number_id}`]];
    for (const [key, value] of pairs) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; el('summary').append(dt, dd); }
    el<HTMLInputElement>('consent').checked = false; el<HTMLButtonElement>('send').disabled = true; el('confirmation').hidden = false; if (root.dataset.mode === 'fullscreen') el('confirmation').scrollIntoView({ block: 'center' }); el<HTMLInputElement>('consent').focus({ preventScroll: true });
  };
  el('edit').onclick = () => { setState('draft'); root.dataset.editing = 'true'; el('confirmation').hidden = true; draft.focus(); };
  el<HTMLInputElement>('consent').onchange = () => { el<HTMLButtonElement>('send').disabled = !el<HTMLInputElement>('consent').checked || locked || sending; };
  el('send').onclick = async () => {
    if (conversation && expired(intents.get(conversation.id))) { el<HTMLButtonElement>('send').disabled = true; expiredNotice(); return; }
    if (sending || locked || !conversation || !canAttempt() || reviewBody !== draft.value || !el<HTMLInputElement>('consent').checked) return;
    const id = conversation.id, intent = intents.get(conversation.id);
    if (!intent || intent.body !== reviewBody || intent.destination !== destination(conversation)) return;
    let posted = false;
    setState('sending'); sending = true; locked = true; business.disabled = true; draft.disabled = true; el<HTMLButtonElement>('send').disabled = true; el<HTMLButtonElement>('review').disabled = true; el('conversations').querySelectorAll('select').forEach(s => s.disabled = true); renderRadar(); notice('Enviando a resposta…');
    try {
      const fresh = (await call('get_conversation', { id })).data;
      const original = conversation;
      const matches = fresh.contact_id === original.contact_id && fresh.phone_number_id === original.phone_number_id && fresh.channel === original.channel && JSON.stringify(fresh.contact) === JSON.stringify(original.contact) && JSON.stringify(fresh.channel_account) === JSON.stringify(original.channel_account) && fresh.display_phone_number === original.display_phone_number;
      if (!matches || (!intent.uncertain && (fresh.status !== 'active' || Date.parse(fresh.window_expires_at ?? '') <= Date.now()))) {
        setState('closed'); notice('Os dados da conversa ou a janela de envio mudaram. Reabra a conversa e revise novamente antes de enviar.', 'warning'); el('confirmation').hidden = true; return;
      }
      if (expired(intent)) { expiredNotice(); return; }
      intent.firstAttemptAt ??= Date.now();
      posted = true;
      const result = await call('reply_to_conversation', { conversation_id: id, text: { body: intent.body }, idempotency_key: intent.key });
      if (!text(result.id) && !text(result.wamid)) throw new Error('Resultado sem confirmação');
      acceptedId = text(result.id) || text(result.wamid); setState('accepted'); notice(`Resposta aceita pelo BotoZap. Aceite não confirma entrega nem leitura.${text(result.status) ? ` Status: ${text(result.status)}.` : ''} ID: ${text(result.id) || text(result.wamid)}`, 'success');
      intents.delete(id); locked = false; draft.value = ''; draft.disabled = !isOpen(); el('length').textContent = '0 / 4096'; el('confirmation').hidden = true; el('review').textContent = root.dataset.mode === 'inline' ? 'Enviar' : 'Revisar envio';
    } catch (error) {
      locked = false; el<HTMLInputElement>('consent').checked = false;
      if ((posted && error instanceof BridgeError && error.outcome === 'rejected') || (!posted && !intent.uncertain)) {
        setState('rejected'); intent.uncertain = false; intent.firstAttemptAt = undefined;
        draft.disabled = !isOpen(); el<HTMLButtonElement>('review').disabled = !isOpen() || !draft.value.trim(); el<HTMLButtonElement>('edit').disabled = false; el('confirmation').hidden = true; el('review').textContent = root.dataset.mode === 'inline' ? 'Enviar' : 'Revisar envio'; el('send').textContent = 'Enviar';
        const message = error instanceof BridgeError ? error.message : 'Não foi possível consultar a conversa. Confira seu acesso e tente novamente.';
        const next = error instanceof BridgeError && error.retry === 'backoff' ? 'Aguarde o prazo indicado antes de revisar novamente.' : 'Você pode corrigir a resposta e revisar novamente.';
        notice(`${posted ? 'O envio foi recusado e não foi realizado.' : 'A resposta não foi enviada.'} ${message} ${next}`, 'error');
      } else {
        setState('uncertain'); intent.uncertain = true; el<HTMLButtonElement>('edit').disabled = true; el<HTMLButtonElement>('send').disabled = true; el('send').textContent = 'Repetir a mesma tentativa'; notice(root.dataset.mode === 'inline' ? 'O resultado do envio está incerto. Confira o histórico no painel BotoZap. Novos envios estão bloqueados; o texto e a chave desta intenção permanecem preservados.' : 'O resultado do envio está incerto. Confira o histórico antes de confirmar uma repetição da mesma tentativa. O texto e a chave de envio serão preservados.', 'warning');
      }
    }
    finally { sending = false; business.disabled = false; renderRadar(); }
  };
  el('more-radar').onclick = () => void loadRadar(true);
  el('more-history').onclick = async () => {
    if (!conversation || !historyCursor || sending) return;
    const token = generation; el<HTMLButtonElement>('more-history').disabled = true;
    try { const page = await call('list_messages', { conversation_id: conversation.id, limit: 20, after: historyCursor }); if (token !== generation) return; messages = [...messages, ...page.data.filter((m: Row) => !messages.some(old => old.id === m.id))]; historyCursor = page.paging?.next ? page.paging.cursors.after : undefined; renderHistory(); }
    catch (error) { if (token === generation) notice((error as Error).message, 'error'); }
    finally { el<HTMLButtonElement>('more-history').disabled = false; }
  };
  function appendCustomers(page: Row) {
    for (const c of page.data) if (!customers.some(old => old.id === c.id)) { customers.push(c); const option = document.createElement('option'); option.value = c.id; option.textContent = text(c.name) || c.id; business.append(option); }
    customerPage = page.meta.page; customerPages = page.meta.total_pages; el('more-business').hidden = customerPage >= customerPages;
  }
  el('more-business').onclick = async () => {
    el<HTMLButtonElement>('more-business').disabled = true;
    try { const result = await call('open_review_panel', { page: customerPage + 1, per_page: 100 }); if (result.account_id !== account) throw new Error('A conta mudou. Reabra o painel.'); appendCustomers(result.customers); }
    catch (error) { notice((error as Error).message, 'error'); }
    finally { el<HTMLButtonElement>('more-business').disabled = false; }
  };
  return {
    setMode,
    bootstrap(result: unknown) {
      try { const data = decode(result);
        if (Array.isArray(data.data) && data.paging && acceptedId) { const receipt = data.data.find((m: Row) => (m.id === acceptedId || m.wamid === acceptedId) && m.conversation_id === conversation?.id && m.direction === 'outbound'); if (receipt && ['delivered', 'read'].includes(receipt.status)) { if (root.dataset.state !== 'read') setState(receipt.status); notice(receipt.status === 'read' ? 'Leitura confirmada pelo canal.' : 'Entrega confirmada pelo canal.'); } return; }
        if (data.draft && data.conversation && data.customer_id) {
          if (sending) return;
          acceptedId = '';
          if (root.dataset.focus !== 'conversation') { setMode('inline'); void bridge.displayMode?.('inline').catch(() => {}); }
          const stageToken = ++stageGeneration;
          void (async () => {
            const bootstrap = await call('open_review_panel', { per_page: 100 });
            if (stageToken !== stageGeneration || sending) return;
            this.bootstrap({ structuredContent: bootstrap });
            let customer = customers.find(c => c.id === data.customer_id);
            if (!customer) { customer = (await call('get_customer', { id: data.customer_id })).data; appendCustomers({ data: [customer], meta: { page: customerPage, total_pages: customerPages } }); }
            if (stageToken !== stageGeneration || sending) return;
            business.value = data.customer_id; ++generation; selected = { id: data.conversation.id, contact_id: data.conversation.contact_id, entity_type: 'conversation', title: 'Resposta preparada' }; resetDraft(); el('conversations').replaceChildren();
            await loadConversation(data.conversation.id);
            if (stageToken !== stageGeneration) return;
            if (conversation && conversation.id === data.conversation.id && !intents.get(conversation.id)?.uncertain) { draft.value = text(data.draft.text).slice(0,4096); intents.set(conversation.id, { body: draft.value, key: destination(data.conversation) === destination(conversation) ? text(data.draft.idempotency_key) || crypto.randomUUID() : crypto.randomUUID(), uncertain: false, destination: destination(conversation) }); el('length').textContent = `${draft.value.length} / 4096`; el<HTMLButtonElement>('review').disabled = !draft.value.trim() || locked || !isOpen(); card(); context(); setState(isOpen() ? 'draft' : 'closed'); if (isOpen() && draftVersion++ > 0) el('card-state').textContent = 'Atualizado'; notice(isOpen() ? '' : 'A janela de 24h está fechada. Use um template aprovado no painel BotoZap.'); }
            if (root.dataset.mode === 'fullscreen') void loadRadar();
          })().catch(() => notice('Não foi possível preparar este rascunho. Reabra o painel e confira as permissões.', 'error'));
          return;
        }
        if (account && data.account_id !== account) { ++stageGeneration; ++generation; intents.clear(); conversation = null; selected = null; messages = []; resetDraft(); context(); business.disabled = true; throw new Error('A conta mudou. Feche este painel e abra uma nova revisão.'); } if (!account && root.dataset.mode === 'fullscreen') void bridge.displayMode?.('fullscreen').catch(() => {}); account = data.account_id; environment = data.environment; el('identity').textContent = `Conta ${account}`; el('environment').textContent = environment === 'live' ? 'Ambiente de produção' : 'Sandbox'; appendCustomers(data.customers); business.disabled = false; notice(customers.length ? '' : 'Nenhum negócio disponível. Confira seu acesso no painel BotoZap.'); }
      catch (error) { notice((error as Error).message, 'error'); }
    },
    connectionError() { notice('Não foi possível conectar ao host MCP. Reabra o painel a partir da conversa.', 'error'); },
  };
}
