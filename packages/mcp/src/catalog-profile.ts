import type {ApiIdentity} from './server.js';
import type {ToolPolicy} from './permissions.js';

export type CatalogProfile = 'assistant' | 'full';
const descriptions: Record<string, [string,string]> = {
  get_channel_account: ['Conta de canal','Consulta a conta de canal autorizada para a app.'],
  get_profile: ['Conta conectada','Consulta a identidade da conta autorizada.'],
  open_botozap: ['Pendências','Abre as pendências da conta para escolher o próximo atendimento.'],
  list_radar: ['Pendências do negócio','Consulta pendências priorizadas de um negócio.'],
  open_review_panel: ['Painel de revisão','Abre negócios e pendências para revisar um atendimento.'],
  stage_review_reply: ['Preparar resposta','Prepara uma resposta com histórico para revisão; não envia.'],
  stage_review_template: ['Preparar template aprovado','Prepara o envio de um template já aprovado; não cria nem envia.'],
  review_template_variables: ['Revisar variáveis','Consulta o template e verifica as variáveis antes do envio.'],
  open_agent_cases: ['A IA precisa de ajuda','Consulta alertas não resolvidos, conversas pausadas e casos, agrupados por conversa.'],
  stage_appointment_booking: ['Escolher horário','Consulta disponibilidade e prepara um agendamento para confirmação.'],
  open_live_conversation: ['Acompanhar conversa','Consulta eventos de uma conversa autorizada desde o cursor, sem enviar mensagens.'],
  list_customers: ['Listar negócios','Lista os negócios autorizados sem abrir outra tela.'],
  get_customer: ['Consultar negócio','Consulta um negócio autorizado pelo UUID.'],
  list_conversations: ['Listar conversas','Lista conversas autorizadas, com filtros de negócio e agente pausado.'],
  get_conversation: ['Consultar conversa','Consulta contato, canal, janela de atendimento e estado de uma conversa.'],
  list_messages: ['Histórico de mensagens','Consulta mensagens de uma conversa, com paginação e filtros.'],
  get_message: ['Consultar mensagem','Consulta o conteúdo e o estado de uma mensagem autorizada.'],
  list_contacts: ['Listar contatos','Lista contatos da conta autorizada.'],
  get_contact: ['Consultar contato','Consulta nome e dados de um contato autorizado.'],
  list_templates: ['Listar templates','Lista templates do número autorizado e seu estado de aprovação.'],
  get_template: ['Consultar template','Consulta conteúdo, componentes e variáveis de um template autorizado.'],
  list_phone_numbers: ['Listar números','Lista os números e canais autorizados para escolher a origem.'],
  get_phone_number: ['Consultar número','Consulta os dados do número autorizado usado pelo atendimento.'],
  list_appointments: ['Listar compromissos','Consulta compromissos autorizados da agenda.'],
  get_appointment: ['Consultar compromisso','Consulta um compromisso autorizado pelo UUID.'],
  get_appointment_availability: ['Consultar horários','Consulta horários disponíveis para um serviço e período.'],
  list_appointment_services: ['Listar serviços','Consulta serviços de agenda disponíveis no negócio.'],
  get_opportunity: ['Consultar oportunidade','Consulta uma oportunidade autorizada do CRM.'],
  get_demand: ['Consultar demanda','Consulta uma demanda autorizada do CRM.'],
  list_opportunity_conversations: ['Conversas da oportunidade','Consulta conversas vinculadas à oportunidade autorizada.'],
  list_demand_conversations: ['Conversas da demanda','Consulta conversas vinculadas à demanda autorizada.'],
  ai_cases_list: ['Listar casos da IA','Consulta casos de atendimento que precisam de intervenção humana.'],
  ai_cases_get: ['Consultar caso da IA','Consulta um caso autorizado para revisar contexto e estado.'],
  ai_alerts_list: ['Listar alertas da IA','Consulta alertas por estado; open e acknowledged ainda precisam de revisão.'],
  send_message: ['Enviar mensagem','Envia conteúdo ao destinatário pelo canal autorizado; exige confirmação do usuário e pode produzir efeito irreversível.'],
  reply_to_conversation: ['Responder conversa','Envia uma resposta na conversa autorizada após confirmação explícita.'],
  prepare_send_intent: ['Preparar intenção de envio','Gera a chave de uma nova intenção de envio, sem enviar; preserve a chave ao conferir resultado incerto.'],
  create_template: ['Criar template','Cria uma definição de template e solicita aprovação ao provedor, com permissão do usuário.'],
  create_appointment: ['Criar compromisso','Cria um compromisso e pode sincronizar calendários externos; exige confirmação.'],
  update_appointment: ['Alterar compromisso','Altera um compromisso existente e pode sincronizar calendários externos; exige confirmação.'],
  control_conversation_agent: ['Pausar ou retomar IA','Altera a automação da conversa; retomar pode gerar resposta ao cliente e exige confirmação explícita.'],
  ai_cases_update: ['Atualizar caso da IA','Altera atribuição e estado de um caso; retomar o agente pode gerar resposta ao cliente e exige confirmação.'],
  ai_alerts_update: ['Atualizar alerta da IA','Reconhece ou resolve um alerta autorizado; altera seu estado e exige intenção explícita.'],
  // Booking reads the owner's display name; this helper is app-only.
  list_users: ['Responsáveis da agenda','Consulta nomes dos responsáveis autorizados para a tela de agendamento.'],
};
export const ASSISTANT_TOOLS = new Set(Object.keys(descriptions));

export function parseClientProfiles(value: string | undefined): ReadonlyMap<string,CatalogProfile> {
  const profiles=new Map<string,CatalogProfile>();
  for(const entry of (value??'').split(',').map(v=>v.trim()).filter(Boolean)) {
    const [id,profile,...extra]=entry.split(':').map(v=>v.trim());
    if(extra.length || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id!) || !['assistant','full'].includes(profile!) || profiles.has(id!.toLowerCase()))throw new Error('BOTOZAP_MCP_OAUTH_CLIENT_PROFILES inválido: use UUID:assistant ou UUID:full sem duplicatas.');
    profiles.set(id!.toLowerCase(),profile as CatalogProfile);
  }
  return profiles;
}
export function catalogProfile(identity: ApiIdentity, profiles: ReadonlyMap<string,CatalogProfile>): CatalogProfile {
  return identity.auth_type==='oauth' ? profiles.get(identity.client_id?.toLowerCase()??'')??'assistant' : 'full';
}
export function catalogAllows(name: string, identity: ApiIdentity, profiles: ReadonlyMap<string,CatalogProfile>): boolean {
  return catalogProfile(identity,profiles)==='full' || ASSISTANT_TOOLS.has(name);
}
export function assistantDescriptor(name: string, original: string, policy: ToolPolicy) {
  const copy=descriptions[name];
  return {
    ...(copy?{title:copy[0]}:{}),
    description:copy?`${copy[1]} ${original}`:original,
    annotations:{readOnlyHint:policy.readOnlyHint,destructiveHint:policy.destructiveHint,openWorldHint:policy.openWorldHint || name==='ai_cases_update'},
  };
}
