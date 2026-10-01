/** Applied only after UI negotiation for an allowed pilot identity. */
const rule = ' Pedido completo e explícito de executar: use a tool direta correspondente, com a permissão do ChatGPT. Pedido vago/incompleto, com escolha a fazer, ou para preparar, redigir, revisar ou ver pendências: use a UI antes de executar; não substitua o card por texto ou bloco nativo. Exceção: criar template novo mantém create_template direta com permissão, nunca a UI de envio.';
const followUpRule = ' open_botozap e list_radar são alternativas: nunca chame ambas na mesma resposta. Para "mostrar pendências e preparar resposta a X", mostre no máximo uma tela de Pendências e depois use stage_review_reply para a conversa de X. Se o pedido principal é preparar resposta e o radar está vazio, vá direto a stage_review_reply; não abra Pendências apenas para mostrar uma lista vazia. Para descobrir IDs ou localizar X, use list_customers, list_contacts ou list_conversations sem UI; não abra outra tela para descobrir IDs nem acrescente open_review_panel como tela de Pendências duplicada.';
const followUpTools = new Set(['open_botozap', 'list_radar', 'open_review_panel', 'stage_review_reply']);
const monitoringRule = ' Pedidos de acompanhar, monitorar, ver status ou "follow" usam SOMENTE open_live_conversation: nunca enviar, reenviar ou preparar nova mensagem nesses pedidos, mesmo após um envio confirmado. message_id é opcional e, sem ele, acompanha a última mensagem enviada na conversa.';
const monitoringTools = new Set(['open_live_conversation','send_message','reply_to_conversation','stage_review_reply']);
const guidance: Record<string, string> = {
  open_botozap: 'Para "o que tenho pendente", resumo do dia ou ver pendências, abra esta UI de Pendências sem encadear consultas exploratórias.',
  open_live_conversation: 'Leia o status atual do recibo e os eventos posteriores da conversa autorizada; acompanhar não envia.',
  open_review_panel: 'Abra Pendências para consultar prioridades e escolher a conversa.',
  list_radar: 'Exibe o carrossel de Pendências de um negócio. Para descobrir negócios ou ver o resumo do dia, prefira open_botozap.',
  stage_review_reply: 'Para preparar, redigir ou revisar resposta, publique o rascunho neste card; não use o bloco nativo de texto. Não envia.',
  stage_review_template: 'Para escolher/preparar o ENVIO de um template já aprovado numa conversa, abra esta UI. Criar template novo usa create_template diretamente; esta UI não cria templates.',
  stage_appointment_booking: 'Para pedido vago de agendamento ou escolha de serviço/horário, use esta UI de disponibilidade antes de criar.',
  open_agent_cases: 'Para "a IA precisa de ajuda?", chame open_agent_cases diretamente, sem customer_id para todos os negócios autorizados. Não abra Pendências/open_botozap para descobrir IDs; list_customers é consulta sem UI quando precisar escolher. Críticos primeiro, agrupados por conversa.',
  send_message: 'Se ainda precisa preparar/revisar texto, use stage_review_reply; se precisa escolher template aprovado, stage_review_template. Envie diretamente só com destinatário, origem e conteúdo completos e ordem explícita de enviar.',
  reply_to_conversation: 'Para preparar/redigir/revisar resposta use stage_review_reply. Responda diretamente só com conversa e texto completos e ordem explícita de enviar.',
  create_appointment: 'Pedido de agendamento vago/incompleto ou com escolha de horário usa stage_appointment_booking. Crie diretamente só com serviço, pessoa, data/horário e instrução completa e explícita.',
  create_template: 'Criação de template novo continua direta com permissão do ChatGPT. stage_review_template serve apenas para enviar um template já aprovado, não para criar.',
};
export function uiDescription(name: string, original: string, enabled: boolean) {
  return enabled && guidance[name] ? original + ' ' + guidance[name] + (followUpTools.has(name) ? followUpRule : '') + rule + (monitoringTools.has(name) ? monitoringRule : '') : original;
}
const labels: Record<string, [string,string]> = {
  open_botozap:['Abrindo Pendências…','Pendências abertas'], open_review_panel:['Abrindo Radar…','Radar aberto'],
  list_radar:['Consultando Pendências…','Pendências consultadas'], stage_review_reply:['Preparando resposta…','Resposta preparada'],
  stage_review_template:['Preparando envio de template…','Template pronto para revisão'], review_template_variables:['Conferindo variáveis…','Variáveis conferidas'],
  open_agent_cases:['Consultando atendimentos…','Atendimentos consultados'], stage_appointment_booking:['Consultando horários…','Horários disponíveis'],
  open_live_conversation:['Abrindo plantão ao vivo…','Plantão ao vivo aberto'],
};
export function uiInvocation(name: string) {
  const label=labels[name]; return label ? {'openai/toolInvocation/invoking':label[0],'openai/toolInvocation/invoked':label[1]} : {};
}
