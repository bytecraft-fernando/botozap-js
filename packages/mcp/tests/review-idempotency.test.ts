// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountReview } from '../web/panel.js';
const meta = { page: 1, total_pages: 1, total_count: 1, per_page: 20 };
const conversation = { id: 'conversation', contact_id: 'contact', phone_number_id: 'number', channel: 'whatsapp', status: 'active', window_expires_at: '2099-01-01T00:00:00Z', contact: { name: 'Marina', phone: '55920010' } };
const result = (structuredContent: unknown) => ({ structuredContent });
const bootstrap = result({ account_id: 'account', environment: 'live', customers: { data: [{ id: 'business', name: 'Ateliê' }], meta } });
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const change = (id: string, type = 'change') => el(id).dispatchEvent(new Event(type));
function setup(failOnce = false) {
  let failed = false;
  const call = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'open_review_panel') return bootstrap;
    if (name === 'list_radar') return result({ data: [{ id: 'item', entity_type: 'opportunity', customer_id: 'business', contact_id: 'contact', title: 'Orçamento' }], meta });
    if (name === 'list_opportunity_conversations') return result({ data: [{ conversation_id: 'conversation' }], meta });
    if (name === 'get_conversation') return result({ data: structuredClone(conversation) });
    if (name === 'list_messages') return result({ data: [], paging: { next: null } });
    if (name === 'reply_to_conversation') { if (failOnce && !failed) { failed = true; throw new Error('timeout after dispatch'); } return result({ id: 'receipt', wamid: 'wamid', status: 'accepted' }); }
    throw new Error(`Unexpected ${name} ${JSON.stringify(args)}`);
  });
  const context = vi.fn(async (_value: unknown) => {});
  const panel = mountReview(document.body, { call, context }); panel.bootstrap(bootstrap);
  return { call, context, panel, sends: () => call.mock.calls.filter(([name]) => name === 'reply_to_conversation') };
}
async function select() {
  el<HTMLSelectElement>('business').value = 'business'; change('business');
  await vi.waitFor(() => expect(document.querySelector('.radar-item')).not.toBeNull());
  (document.querySelector('.radar-item') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(el<HTMLTextAreaElement>('draft').disabled).toBe(false));
}
function compose(body: string) { el<HTMLTextAreaElement>('draft').value = body; change('draft', 'input'); el('review').click(); confirm(); }
function confirm() { el<HTMLInputElement>('consent').checked = true; change('consent'); }
beforeEach(() => { document.body.innerHTML = ''; HTMLElement.prototype.scrollIntoView = vi.fn(); });
describe('review idempotency intent', () => {
  it('unlocks preparation when the preflight fails before any dispatch', async () => {
    const h = setup(); await select(); compose('Texto revisado.'); const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'get_conversation' ? { isError: true, structuredContent: { error: { message: 'Acesso revogado.', status: 403 } } } : original(name, args));
    el('send').click(); await vi.waitFor(() => expect(el('notice').textContent).toContain('não foi enviada'));
    expect(h.sends()).toHaveLength(0); expect(el<HTMLTextAreaElement>('draft').disabled).toBe(false);
  });
  it('unlocks a confirmed rejected response and preserves the key for an identical explicit retry', async () => {
    const h = setup(); const original = h.call.getMockImplementation()!; let attempts = 0;
    h.call.mockImplementation(async (name, args) => name === 'reply_to_conversation' && attempts++ === 0 ? { isError: true, structuredContent: { error: { outcome: 'rejected', message: 'Aguarde antes de tentar novamente.', status: 429 } } } : original(name, args));
    await select(); compose('Confirmo o prazo.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('recusado'));
    expect(el<HTMLTextAreaElement>('draft').disabled).toBe(false); expect(el<HTMLButtonElement>('review').disabled).toBe(false); expect(h.sends()).toHaveLength(1);
    el('review').click(); confirm(); el('send').click();
    await vi.waitFor(() => expect(h.sends()).toHaveLength(2));
    expect(h.sends()[1][1]).toEqual(h.sends()[0][1]);
  });
  it('uses a new key when the user corrects a confirmed rejected response', async () => {
    const h = setup(); const original = h.call.getMockImplementation()!; let attempts = 0;
    h.call.mockImplementation(async (name, args) => name === 'reply_to_conversation' && attempts++ === 0 ? { isError: true, structuredContent: { error: { outcome: 'rejected', message: 'Conteúdo inválido.', status: 422 } } } : original(name, args));
    await select(); compose('Texto original.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('recusado'));
    compose('Texto corrigido.'); el('send').click();
    await vi.waitFor(() => expect(h.sends()).toHaveLength(2));
    expect(h.sends()[1][1].idempotency_key).not.toBe(h.sends()[0][1].idempotency_key);
    expect(h.sends()[1][1].text).toEqual({ body: 'Texto corrigido.' });
  });
  it('keeps generic tool failures uncertain even when their message says rejected', async () => {
    const h = setup(); const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'reply_to_conversation' ? { isError: true, structuredContent: { error: { message: 'rejected', status: 422 } } } : original(name, args));
    await select(); compose('Mesmo texto.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('incerto'));
    expect(el<HTMLTextAreaElement>('draft').disabled).toBe(true); expect(h.sends()).toHaveLength(1);
  });
  it('does not repeat an uncertain attempt after the 24 hour receipt lifetime', async () => {
    const firstAttemptAt = Date.now(); const now = vi.spyOn(Date, 'now').mockReturnValue(firstAttemptAt);
    try {
      const h = setup(true); await select(); compose('Mesmo texto.'); el('send').click();
      await vi.waitFor(() => expect(el('notice').textContent).toContain('incerto'));
      const callsBefore = h.call.mock.calls.length;
      now.mockReturnValue(firstAttemptAt + 24 * 60 * 60 * 1000 + 1);
      confirm(); el('send').click();
      expect(el('notice').textContent).toContain('expirou');
      expect(h.call.mock.calls).toHaveLength(callsBefore); expect(h.sends()).toHaveLength(1);
      expect(el<HTMLTextAreaElement>('draft').disabled).toBe(true);
    } finally { now.mockRestore(); }
  });
  it('keeps a user edit when an older staged draft is still loading', async () => {
    const h = setup(); await select();
    let release!: (value: ReturnType<typeof result>) => void;
    const pending = new Promise<ReturnType<typeof result>>(resolve => { release = resolve; });
    const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'open_review_panel' ? pending : original(name, args));
    h.panel.bootstrap(result({ customer_id: 'business', conversation, draft: { text: 'Rascunho do modelo.', idempotency_key: 'cfc52d7a-e463-4a2c-b9de-121716c544dc' } }));
    el<HTMLTextAreaElement>('draft').value = 'Texto digitado agora.'; change('draft', 'input');
    release(bootstrap); await pending; await Promise.resolve(); await Promise.resolve();
    expect(el<HTMLTextAreaElement>('draft').value).toBe('Texto digitado agora.');
    expect(h.call.mock.calls.filter(([name]) => name === 'get_conversation')).toHaveLength(1);
  });
  it('clears the active recipient and draft when linked conversation selection is emptied', async () => {
    const h = setup(); const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'list_opportunity_conversations' ? result({ data: [{ conversation_id: 'conversation' }, { conversation_id: 'another' }], meta }) : original(name, args));
    el<HTMLSelectElement>('business').value = 'business'; change('business');
    await vi.waitFor(() => expect(document.querySelector('.radar-item')).not.toBeNull());
    (document.querySelector('.radar-item') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(el('conversations').querySelector('select')).not.toBeNull());
    const chooser = el('conversations').querySelector('select')!; chooser.value = 'conversation'; chooser.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(el<HTMLTextAreaElement>('draft').disabled).toBe(false));
    compose('Texto para a conversa.'); chooser.value = ''; chooser.dispatchEvent(new Event('change'));
    expect(el<HTMLTextAreaElement>('draft').disabled).toBe(true); expect(el<HTMLButtonElement>('review').disabled).toBe(true);
    expect(el('confirmation').hidden).toBe(true); expect(el('recipient').textContent).toBe('');
    expect(h.context.mock.calls.at(-1)?.[0]).toMatchObject({ conversation_id: null }); expect(h.sends()).toHaveLength(0);
  });
  it('updates selected conversation context even when the history is empty', async () => {
    const h = setup(); await select();
    expect(h.context.mock.calls.at(-1)?.[0]).toMatchObject({ conversation_id: 'conversation', customer_id: 'business', untrusted_contact_content: { messages: [] } });
  });
  it('can replay an uncertain attempt after its window expires without making a new intent', async () => {
    const h = setup(true); await select(); compose('Mesmo texto.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('incerto'));
    const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'get_conversation' ? result({ data: { ...conversation, status: 'ended', window_expires_at: '2020-01-01T00:00:00Z' } }) : original(name, args));
    (document.querySelector('.radar-item') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(el('review').textContent).toContain('pendente'));
    el('review').click(); confirm(); el('send').click();
    await vi.waitFor(() => expect(h.sends()).toHaveLength(2));
    expect(h.sends()[1][1]).toEqual(h.sends()[0][1]);
    await vi.waitFor(() => expect(el('notice').textContent).toContain('aceita'));
    expect(el<HTMLTextAreaElement>('draft').disabled).toBe(true);
  });
  it('blocks an uncertain retry when the actual contact address has changed', async () => {
    const h = setup(true); await select(); compose('Mesmo texto.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('incerto'));
    const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'get_conversation' ? result({ data: { ...conversation, contact: { ...conversation.contact, phone: '55929999' } } }) : original(name, args));
    (document.querySelector('.radar-item') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('destino'));
    expect(el<HTMLButtonElement>('review').disabled).toBe(true); expect(h.sends()).toHaveLength(1);
  });
  it('retries a timeout only on explicit confirmation with identical payload and key', async () => {
    const h = setup(true); await select(); compose('Confirmo o prazo.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('incerto'));
    expect(h.sends()).toHaveLength(1); expect(el<HTMLTextAreaElement>('draft').disabled).toBe(true);
    expect(el<HTMLButtonElement>('send').disabled).toBe(true);
    confirm(); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('aceita'));
    expect(h.sends()).toHaveLength(2); expect(h.sends()[1][1]).toEqual(h.sends()[0][1]);
    expect(h.sends()[0][1].idempotency_key).toMatch(/^[\da-f-]{36}$/i);
  });
  it('preserves the key of a prepared draft', async () => {
    const h = setup(); const key = 'cfc52d7a-e463-4a2c-b9de-121716c544dc';
    h.panel.bootstrap(result({ customer_id: 'business', conversation, draft: { text: 'Resposta preparada.', idempotency_key: key } }));
    await vi.waitFor(() => expect(el<HTMLTextAreaElement>('draft').value).toBe('Resposta preparada.'));
    el('review').click(); confirm(); el('send').click();
    await vi.waitFor(() => expect(h.sends()).toHaveLength(1));
    expect(h.sends()[0][1].idempotency_key).toBe(key);
  });
  it('freezes an uncertain inline card even with explicit repeat confirmation', async () => {
    const h = setup(true); const key = 'cfc52d7a-e463-4a2c-b9de-121716c544dc';
    h.panel.bootstrap(result({ customer_id: 'business', conversation, draft: { text: 'Resposta preparada.', idempotency_key: key } }));
    await vi.waitFor(() => expect(el<HTMLTextAreaElement>('draft').value).toBe('Resposta preparada.'));
    expect(document.body.dataset.mode).toBe('inline');
    el('review').click(); confirm(); el('send').click();
    await vi.waitFor(() => expect(document.body.dataset.state).toBe('uncertain'));
    confirm(); el('send').click(); el('review').click();
    expect(h.sends()).toHaveLength(1); expect(h.sends()[0][1].idempotency_key).toBe(key);
    expect(el<HTMLTextAreaElement>('draft').disabled).toBe(true);
    expect(el('notice').textContent).toContain('histórico');
  });
  it('shows a closed-window prepared card without dispatching a text reply', async () => {
    const h = setup(); const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async (name, args) => name === 'get_conversation' ? result({ data: { ...conversation, window_expires_at: '2020-01-01T00:00:00Z' } }) : original(name, args));
    h.panel.bootstrap(result({ customer_id: 'business', conversation, draft: { text: 'Texto preparado.', idempotency_key: 'cfc52d7a-e463-4a2c-b9de-121716c544dc' } }));
    await vi.waitFor(() => expect(el('card-preview').textContent).toBe('Texto preparado.'));
    expect(document.body.dataset.state).toBe('closed');
    el('review').click(); confirm(); el('send').click();
    expect(h.sends()).toHaveLength(0); expect(el('notice').textContent).toContain('template');
  });
  it('uses a new key for a new edited message after acceptance', async () => {
    const h = setup(); await select(); compose('Primeira resposta.'); el('send').click();
    await vi.waitFor(() => expect(el('notice').textContent).toContain('aceita'));
    compose('Outra resposta.'); el('send').click();
    await vi.waitFor(() => expect(h.sends()).toHaveLength(2));
    expect(h.sends()[1][1].idempotency_key).not.toBe(h.sends()[0][1].idempotency_key);
    expect(h.sends()[1][1].text).toEqual({ body: 'Outra resposta.' });
  });
});
