import { mountReview } from './panel.js';
import './review.css';
const banner = document.createElement('aside'); banner.className = 'demo-banner'; banner.textContent = 'DEMONSTRAÇÃO · Dados fictícios · Nenhuma mensagem real será enviada';
const theme = document.createElement('button'); theme.textContent = 'Alternar tema'; theme.onclick = () => document.documentElement.classList.toggle('dark'); banner.append(theme); document.body.prepend(banner);
const business = '00000000-0000-4000-8000-000000000001', contact = '00000000-0000-4000-8000-000000000002', id = '00000000-0000-4000-8000-000000000003';
const meta = { page: 1, per_page: 20, total_count: 3, total_pages: 1 };
const conversation = { id, contact_id: contact, status: 'active', channel: 'whatsapp', phone_number_id: '00000000-0000-4000-8000-000000000004', display_phone_number: '+55 92 90000-0000', contact: { name: 'Marina Oliveira', phone: '+55 92 90000-0010' }, window_expires_at: new Date(Date.now() + 7200000).toISOString() };
const bootstrap = { account_id: 'conta-exemplo', environment: 'live', customers: { data: [{ id: business, name: 'Ateliê Encontro das Águas' }], meta } };
const panel = mountReview(document.getElementById('app') ?? document.body, {
  async call(name) {
    let result;
    switch (name) {
      case 'open_review_panel': result = bootstrap; break;
      case 'list_radar': result = { data: [{ id: '00000000-0000-4000-8000-000000000005', customer_id: business, contact_id: contact, entity_type: 'opportunity', title: 'Marina · orçamento de lembranças', bucket: 'critical', next_step: 'Confirmar prazo de produção' }, { id: '00000000-0000-4000-8000-000000000006', customer_id: business, contact_id: contact, entity_type: 'demand', title: 'Acompanhar entrega do pedido', bucket: 'at_risk', next_step: 'Consultar previsão com a equipe' }, { id: '00000000-0000-4000-8000-000000000007', customer_id: business, contact_id: contact, entity_type: 'return', conversation_id: id, title: 'Retomar contato na sexta-feira', bucket: 'scheduled', next_step: 'Enviar opções de acabamento' }], meta }; break;
      case 'list_opportunity_conversations': case 'list_demand_conversations': result = { data: [{ conversation_id: id }], meta }; break;
      case 'get_conversation': result = { data: conversation }; break;
      case 'list_messages': result = { data: [{ id: 'm1', direction: 'inbound', type: 'text', content: { text: { body: 'Oi! Gostei da proposta. Vocês conseguem entregar as 40 lembranças até sexta?' } }, created_at: new Date(Date.now()-1800000).toISOString() }, { id: 'm2', direction: 'outbound', type: 'text', content: { text: { body: 'Olá, Marina! Vou conferir o prazo com a produção e já te retorno.' } }, created_at: new Date(Date.now()-900000).toISOString() }], paging: { next: null, cursors: { after: null } } }; break;
      case 'reply_to_conversation': result = { id: 'envio-ficticio', status: 'accepted' }; break;
      default: return { isError: true };
    }
    return { structuredContent: result };
  },
  async context() {},
});
panel.bootstrap({ structuredContent: bootstrap });
