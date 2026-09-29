---
name: conectar-botozap
description: Ajude a pessoa a conectar sua Conta BotoZap, confirmar o negócio autorizado e começar a revisar pendências. Use no primeiro acesso ao plugin ou quando pedir ajuda para conectar ou reconectar.
---

# Conectar e escolher o negócio

Use a conexão OAuth oferecida pelo host. Direcione a pessoa ao fluxo de conexão
se ainda não houver autorização; nunca peça senha, chave de API ou bearer no chat.
A pessoa escolhe a Conta durante a autorização. Outra Conta exige sua própria
conexão; a seleção de negócio não muda a Conta autorizada.

Com a conexão ativa, use `get_profile` para identificar Conta e ambiente.
Se `open_review_panel` estiver disponível, abra o painel e peça a escolha do
negócio entre os resultados. Sem UI, use `list_customers` e os nomes/IDs reais
devolvidos. Se a ferramenta estiver ausente ou negar acesso, explique a permissão
necessária e peça ao responsável que ajuste/reconecte, sem contornar por outra
credencial. Nunca invente dados para preencher um resultado vazio.

Após a escolha, consulte `list_radar` com o `customer_id` selecionado e siga a
skill [revisar-pendencias](../revisar-pendencias/SKILL.md) para histórico e rascunho.
Conectar e consultar não autoriza envio. Uma mensagem depende da revisão do
contato e conteúdo e da ação explícita de envio.
