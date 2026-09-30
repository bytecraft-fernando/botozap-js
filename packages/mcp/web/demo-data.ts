/* Fictional data belongs exclusively to the simulated host, never the UI. */
export const customerId = '00000000-0000-4000-8000-000000000001';
export const conversationId = '00000000-0000-4000-8000-000000000003';
export const contactId = '00000000-0000-4000-8000-000000000002';
export const bootstrap = { account_id: 'conta-demonstracao', environment: 'sandbox', customers: { data: [{ id: customerId, name: 'Ateliê das Águas' }, { id: '00000000-0000-4000-8000-000000000011', name: 'Café da Praça' }], meta: { page: 1, per_page: 100, total_count: 2, total_pages: 1 } } };
export const draftText = 'Olá, Marina! A produção confirmou: conseguimos entregar as 40 lembranças até sexta-feira. Posso preparar o pedido com o acabamento que você escolheu?';
export const shortText = 'Marina, entregamos as 40 lembranças até sexta. Posso confirmar o pedido?';
const ago = (minutes: number) => new Date(Date.now()-minutes*60000).toISOString();
export function conversation(closed = false, selected = 0) {
  const people = [{ name: 'Marina Oliveira', phone: '+55 92 99123-0010' }, { name: 'Rafael Costa', phone: '+55 92 99123-0020' }, { name: 'Luiza Santos', phone: '+55 92 99123-0030' }];
  return { id: conversationId, contact_id: selected === 1 ? '00000000-0000-4000-8000-000000000012' : selected === 2 ? '00000000-0000-4000-8000-000000000022' : contactId, status: 'active', channel: 'whatsapp', phone_number_id: '00000000-0000-4000-8000-000000000004', display_phone_number: '+55 92 90000-0000', contact: people[selected] ?? people[0], last_message_at: ago([180,55,30][selected] ?? 180), window_expires_at: new Date(Date.now()+(closed ? -1 : 120)*60000).toISOString() };
}
export function radar(empty = false) {
  const data = [
    { id: '00000000-0000-4000-8000-000000000005', customer_id: customerId, contact_id: contactId, entity_type: 'opportunity', conversation_id: conversationId, title: 'pediu orçamento', bucket: 'critical', next_step: 'Confirmar entrega até sexta', last_activity_at: ago(180) },
    { id: '00000000-0000-4000-8000-000000000006', customer_id: customerId, contact_id: '00000000-0000-4000-8000-000000000012', conversation_id: '00000000-0000-4000-8000-000000000013', entity_type: 'demand', title: 'quer rastrear o pedido', bucket: 'at_risk', next_step: 'Consultar previsão de entrega', last_activity_at: ago(55) },
    { id: '00000000-0000-4000-8000-000000000007', customer_id: customerId, contact_id: '00000000-0000-4000-8000-000000000022', conversation_id: '00000000-0000-4000-8000-000000000023', entity_type: 'return', title: 'retorno combinado', bucket: 'scheduled', next_step: 'Apresentar novas opções', last_activity_at: ago(30) },
  ];
  return { data: empty ? [] : data, meta: { page: 1, per_page: 20, total_pages: 1, total_count: empty ? 0 : 3, counts: { critical: empty ? 0 : 1, at_risk: empty ? 0 : 1, scheduled: empty ? 0 : 1 } } };
}
export function history(status?: string, body = draftText) {
  const data: Record<string, any>[] = [
    { id: 'm1', direction: 'inbound', content: { text: { body: 'Oi! Adorei as lembranças que vocês fizeram. 😊' } }, created_at: ago(185) },
    { id: 'm2', direction: 'outbound', content: { text: { body: 'Olá, Marina! Que bom saber. Para quantas pessoas você está pensando?' } }, created_at: ago(182) },
    { id: 'm3', direction: 'inbound', content: { text: { body: 'São 40 lembranças. Vocês conseguem entregar até sexta? É para o aniversário da minha filha.' } }, created_at: ago(180) },
    { id: 'm4', direction: 'outbound', content: { text: { body: 'Vou conferir o prazo com a produção e já te retorno.' } }, created_at: ago(15) },
  ];
  if (status) data.push({ id: '00000000-0000-4000-8000-000000000090', wamid: 'wamid.demo', conversation_id: conversationId, direction: 'outbound', status, content: { text: { body } }, created_at: ago(0) });
  return { data, paging: { next: null, cursors: { after: null } } };
}
