import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { mountReview } from './panel.js';
import './review.css';
const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'radar' ? 'radar' : 'inline';
const state = params.get('state') ?? 'draft';
applyDocumentTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
const banner = document.createElement('aside'); banner.className = 'demo-banner';
banner.innerHTML = `<span>Demo · dados fictícios · nenhum envio real</span><label for="demo-mode">Visualização</label><select id="demo-mode"><option value="inline">Card inline</option><option value="radar">Radar fullscreen</option></select><label for="demo-state">Estado</label><select id="demo-state"><option value="draft">Rascunho</option><option value="confirming">Confirmando</option><option value="sending">Enviando</option><option value="accepted">Aceito</option><option value="rejected">Recusado</option><option value="uncertain">Incerto</option><option value="closed">Janela fechada</option></select><label for="demo-theme">Tema do host</label><select id="demo-theme"><option value="light">Claro</option><option value="dark">Escuro</option></select>`;
document.body.prepend(banner);
for (const [key, value] of [['mode', mode], ['state', state], ['theme', params.get('theme') ?? 'light']]) {
  const select = document.getElementById(`demo-${key}`) as HTMLSelectElement;
  select.value = value; select.onchange = () => { params.set(key, select.value); location.search = params.toString(); };
}
const business = '00000000-0000-4000-8000-000000000001', contact = '00000000-0000-4000-8000-000000000002', id = '00000000-0000-4000-8000-000000000003';
const meta = { page: 1, per_page: 20, total_count: 3, total_pages: 1 };
const conversation = { id, contact_id: contact, status: 'active', channel: 'whatsapp', phone_number_id: '00000000-0000-4000-8000-000000000004', display_phone_number: '+55 92 90000-0000', contact: { name: 'Marina Oliveira', phone: '+55 92 90000-0010' }, window_expires_at: state === 'closed' ? '2026-09-29T18:00:00Z' : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() };
const bootstrap = { account_id: 'conta-exemplo', environment: 'sandbox', customers: { data: [{ id: business, name: 'Ateliê Encontro das Águas' }, { id: 'outro-negocio', name: 'Café da Praça' }], meta } };
const draftText = 'Olá, Marina! Confirmamos a entrega das 40 lembranças até sexta-feira. Posso preparar o pedido com o acabamento que você escolheu?';
const root = document.getElementById('app')!;
const panel = mountReview(root, {
  async call(name) {
    let result;
    switch (name) {
      case 'open_review_panel': result = bootstrap; break;
      case 'list_radar': result = { data: [{ id: '00000000-0000-4000-8000-000000000005', customer_id: business, contact_id: contact, entity_type: 'opportunity', title: 'Marina · orçamento de lembranças', bucket: 'critical', next_step: 'Confirmar prazo de produção' }, { id: '00000000-0000-4000-8000-000000000006', customer_id: business, contact_id: contact, entity_type: 'demand', title: 'Acompanhar entrega do pedido', bucket: 'at_risk', next_step: 'Consultar previsão com a equipe' }, { id: '00000000-0000-4000-8000-000000000007', customer_id: business, contact_id: contact, entity_type: 'return', conversation_id: id, title: 'Retomar contato na sexta-feira', bucket: 'scheduled', next_step: 'Enviar opções de acabamento' }], meta }; break;
      case 'list_opportunity_conversations': case 'list_demand_conversations': result = { data: [{ conversation_id: id }], meta }; break;
      case 'get_conversation': result = { data: conversation }; break;
      case 'list_messages': result = { data: [{ id: 'm1', direction: 'inbound', type: 'text', content: { text: { body: 'Oi! Gostei da proposta. Vocês conseguem entregar as 40 lembranças até sexta?' } }, created_at: '2026-09-30T13:30:00Z' }, { id: 'm2', direction: 'outbound', type: 'text', content: { text: { body: 'Olá, Marina! Vou conferir o prazo com a produção e já te retorno.' } }, created_at: '2026-09-30T13:45:00Z' }], paging: { next: null, cursors: { after: null } } }; break;
      case 'reply_to_conversation':
        if (state === 'sending') return new Promise(() => {});
        if (state === 'uncertain') throw new Error('Conexão interrompida após envio');
        if (state === 'rejected') return { isError: true, structuredContent: { error: { outcome: 'rejected', message: 'O número de origem está indisponível.', retry: 'backoff' } } };
        result = { id: 'envio-ficticio', status: 'accepted' }; break;
      default: return { isError: true };
    }
    return { structuredContent: result };
  },
  async context() {},
});
function ready(predicate: () => boolean): Promise<void> {
  return new Promise(resolve => { const tick = () => predicate() ? resolve() : requestAnimationFrame(tick); tick(); });
}
async function demo() {
  if (mode === 'radar') {
    panel.bootstrap({ structuredContent: bootstrap });
    const select = document.getElementById('business') as HTMLSelectElement;
    select.value = business; select.dispatchEvent(new Event('change'));
    await ready(() => !!root.querySelector('.radar-item'));
    (root.querySelector('.radar-item') as HTMLButtonElement).click();
    await ready(() => !(document.getElementById('draft') as HTMLTextAreaElement).disabled);
    const draft = document.getElementById('draft') as HTMLTextAreaElement; draft.value = draftText; draft.dispatchEvent(new Event('input'));
    const composer = document.createElement('aside'); composer.className = 'demo-composer'; composer.textContent = 'Pergunte ao ChatGPT sobre esta conversa…'; composer.innerHTML += '<small>Composer do host · sobreposição simulada apenas nesta demo</small>'; document.body.append(composer);
  } else {
    panel.bootstrap({ structuredContent: { customer_id: business, conversation, draft: { text: draftText, idempotency_key: '00000000-0000-4000-8000-000000000008' } } });
    await ready(() => !!document.getElementById('card-preview')?.textContent?.includes('40 lembranças'));
    if (['confirming', 'sending', 'accepted', 'rejected', 'uncertain'].includes(state)) {
      document.getElementById('review')!.click();
      if (state !== 'confirming') {
        const consent = document.getElementById('consent') as HTMLInputElement; consent.checked = true; consent.dispatchEvent(new Event('change')); document.getElementById('send')!.click();
        await ready(() => root.dataset.state === state);
      }
    }
  }
  document.documentElement.dataset.demoReady = 'true';
}
void demo();
