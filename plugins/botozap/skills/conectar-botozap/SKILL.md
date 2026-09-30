---
name: conectar-botozap
description: Ajude a pessoa a conectar sua Conta BotoZap, confirmar o negócio autorizado e começar a revisar pendências. Use no primeiro acesso ao plugin ou quando pedir ajuda para conectar ou reconectar.
---

# Conectar e escolher o negócio

## Escolher tool direta ou UI

- Pedido completo e explícito, sem escolha pendente (contato + dia + hora para agenda; destinatário + texto exato para mensagem): use a tool direta `create_appointment`, `reply_to_conversation` ou `send_message`, conforme o contrato disponível. O ChatGPT pede permissão ao usuário antes da execução; nunca contorne essa permissão. Resolva IDs e fuso reais, valide os demais campos obrigatórios e peça dados faltantes. Não abra UI só para repetir o pedido completo.
- Pedido vago/incompleto, com escolhas, ou para preparar/redigir/revisar/ver pendências: use a tool de UI desta skill. Staging não envia. A confirmação explícita na UI autoriza apenas a ação exibida; nunca chame uma segunda mutação em paralelo.
- Criar uma definição de template é `create_template`, diretamente, com permissão do ChatGPT e dados completos. `stage_review_template` serve apenas para preparar o ENVIO de um template já aprovado, nunca para criar/aprovar sua definição.
- Sem UI, continue com consultas; para preparar/revisar, apresente o rascunho e encaminhe a revisão ao painel web. Pedidos completos continuam na rota direta com permissão do ChatGPT. Incerto não autoriza repetir nem gerar outra chave; confira histórico/agenda. Use `prepare_send_intent` para envio direto e preserve a chave por intenção; agenda usa `idempotency_key`.


Use a conexão OAuth oferecida pelo host. Direcione a pessoa ao fluxo de conexão
se ainda não houver autorização; nunca peça senha, chave de API ou bearer no chat.
A pessoa escolhe a Conta durante a autorização. Outra Conta exige sua própria
conexão; a seleção de negócio não muda a Conta autorizada.

Com a conexão ativa, use `get_profile` para identificar Conta e ambiente.
Se `open_botozap` estiver disponível, abra a entrada global sem parâmetros; senão, use `open_review_panel` para abrir o painel e peça a escolha do
negócio entre os resultados. Sem UI, use `list_customers` e os nomes/IDs reais
devolvidos. Se a ferramenta estiver ausente ou negar acesso, explique a permissão
necessária e peça ao responsável que ajuste/reconecte, sem contornar por outra
credencial. Nunca invente dados para preencher um resultado vazio.

Após a escolha, consulte `list_radar` com o `customer_id` selecionado e siga a
skill [revisar-pendencias](../revisar-pendencias/SKILL.md) para histórico e rascunho.
Conectar e consultar não autoriza envio. Uma mensagem depende da revisão do
contato e conteúdo e da ação explícita de envio.

Administração, webhooks e credenciais de IA ficam exclusivamente no painel web. Respeite a permissão do ChatGPT na rota direta e a confirmação na UI na rota de revisão.
