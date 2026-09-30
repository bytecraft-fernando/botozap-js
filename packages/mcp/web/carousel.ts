import type { Bridge } from './panel.js';
import { initials, relative, string, bucketLabel } from './ui-helpers.js';
type Row = Record<string, any>;
export function mountCarousel(root: HTMLElement, bridge: Bridge) {
  root.innerHTML = `<main class="carousel-workspace"><div class="carousel-heading"><div><p class="eyebrow">Seu dia, em ordem</p><h1>Pendências no WhatsApp</h1></div><span id="carousel-count" class="badge"></span></div><div id="carousel-content" role="region" aria-label="Pendências" tabindex="0" aria-busy="true">${Array.from({ length: 3 }, () => '<div class="skeleton-card" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>').join('')}</div><p id="carousel-note" class="caption" role="status" aria-live="polite">Consultando seu Radar…</p></main>`;
  let customer = '', customerName = '', rows: Row[] = [];
  const content = root.querySelector<HTMLElement>('#carousel-content')!;
  const note = root.querySelector<HTMLElement>('#carousel-note')!;
  function render() {
    content.setAttribute('aria-busy','false'); content.replaceChildren();
    root.querySelector('#carousel-count')!.textContent = `${rows.length} pendências`;
    if (!rows.length) { content.innerHTML = '<section class="rich-empty"><span class="empty-symbol" aria-hidden="true">✓</span><h2>Tudo em dia por aqui</h2><p>Nenhuma pendência neste negócio. Peça ao ChatGPT os follow-ups da semana ou quem pediu orçamento.</p></section>'; note.textContent = 'Você pode continuar a conversa para explorar outro negócio.'; return; }
    for (const entry of rows.slice(0,8)) {
      const card = document.createElement('article'); card.className = 'pending-card'; card.dataset.bucket = string(entry.bucket);
      const name = string(entry.contact?.name) || 'Contato';
      card.innerHTML = '<div class="pending-person"><span class="avatar" aria-hidden="true"></span><div><h2></h2><p class="pending-business"></p></div></div><span class="urgency"></span><p class="pending-wait"></p><p class="pending-reason"></p><p class="pending-next"></p><button class="primary">Responder <span aria-hidden="true">↗</span></button>';
      card.querySelector('.avatar')!.textContent = initials(name); card.querySelector('h2')!.textContent = name;
      card.querySelector('.pending-business')!.textContent = customerName || string(entry.customer_name) || 'Negócio selecionado';
      card.querySelector('.urgency')!.textContent = `${entry.bucket === 'critical' ? '! ' : entry.bucket === 'scheduled' ? '◷ ' : '• '}${bucketLabel(entry.bucket)}`;
      const wait = relative(entry.last_activity_at); card.querySelector('.pending-wait')!.textContent = wait ? `Sem atividade ${wait}` : 'Resposta pendente';
      card.querySelector('.pending-reason')!.textContent = string(entry.reason_label) || string(entry.title) || 'A conversa precisa da sua atenção';
      card.querySelector('.pending-next')!.textContent = string(entry.next_step) || 'Confira o contexto antes de responder';
      const button = card.querySelector('button')!;
      button.onclick = async () => {
        button.disabled = true;
        try {
          await bridge.context({ customer_id: customer, selected_pending: { id: entry.id, entity_type: entry.entity_type, contact_id: entry.contact_id, conversation_id: entry.conversation_id }, untrusted_contact_content: { title: entry.title, next_step: entry.next_step } });
          if (!bridge.message) throw new Error('Peça ao ChatGPT uma resposta para este item.');
          await bridge.message(`Prepare uma resposta para a pendência ${entry.id} do negócio ${customer || entry.customer_id}. Confira a conversa vinculada e prepare o rascunho com stage_review_reply, sem enviar.`);
          note.textContent = 'O ChatGPT está preparando uma resposta com o contexto desta conversa.';
        } catch (error) { note.textContent = (error as Error).message; } finally { button.disabled = false; }
      };
      content.append(card);
      // Enrich from existing authorized tools; Radar titles are not contact names.
      if (entry.contact_id) void bridge.call('get_contact', { id: entry.contact_id }).then(result => {
        const contact = result.structuredContent?.data; if (!card.isConnected || !contact) return;
        const name = string(contact.display_name) || string(contact.profile_name) || 'Contato';
        card.querySelector('h2')!.textContent = name; card.querySelector('.avatar')!.textContent = initials(name);
      }).catch(() => {});
      if (entry.conversation_id) void bridge.call('get_conversation', { id: entry.conversation_id }).then(result => {
        const conversation = result.structuredContent?.data; if (!card.isConnected || !conversation || conversation.contact_id !== entry.contact_id) return;
        const wait = relative(conversation.last_message_at); if (wait) card.querySelector('.pending-wait')!.textContent = `Esperando ${wait}`;
      }).catch(() => {});
    }
    note.textContent = 'Escolha uma conversa para preparar uma resposta. Nenhuma mensagem será enviada sem sua confirmação.';
  }
  return {
    input(args: Row) { customer = string(args.customer_id); if (customer) void bridge.call('get_customer', { id: customer }).then(r => { customerName = string(r.structuredContent?.data?.name); if (rows.length) render(); }).catch(() => {}); },
    bootstrap(result: any) {
      if (result.isError) { content.setAttribute('aria-busy','false'); content.innerHTML = '<section class="rich-empty"><span class="empty-symbol" aria-hidden="true">!</span><h2>Não foi possível consultar as pendências</h2><p>Confira seu acesso e peça ao ChatGPT para consultar o Radar novamente.</p></section>'; note.textContent = 'A consulta falhou. Nenhuma ação foi realizada.'; return; }
      const data = result.structuredContent ?? JSON.parse(result.content?.find((c: Row) => c.type === 'text')?.text ?? '{}');
      rows = Array.isArray(data.data) ? data.data : []; render();
    },
    connectionError() { note.textContent = 'Não foi possível conectar ao host. Reabra a consulta no ChatGPT.'; },
  };
}
