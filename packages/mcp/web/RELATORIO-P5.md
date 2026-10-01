# P5 — template aprovado e administração pelo painel

## Causa reproduzida

A conversa expõe `phone_number_id` como UUID interno. A UI usava esse UUID no filtro de `list_templates.phone_number_id`, porém a rota real do app `src/app/api/v1/templates/route.ts` compara esse parâmetro com a coluna Meta `phone_numbers.phone_number_id` (e devolve lista vazia quando não encontra número autorizado). `get_phone_number` retorna a conexão correta via `waba_connection_id` e o ID Meta em `phone_number_id`.

A UI agora filtra por `waba_connection_id` do número autorizado; se esse campo faltar, usa somente o ID Meta retornado pelo número, nunca o UUID da conversa. Sem ambos, falha explicitamente sem consultar o catálogo global. A lista também exclui templates de outra WABA. A checagem de origem/template continua sendo repetida antes de enviar, com confirmação e idempotência existentes.

O rótulo “Fora da janela” era estático, sem cálculo. Agora usa “Janela aberta · Template aprovado” quando status active e window_expires_at futuro; fora disso usa “Template aprovado”, pois templates são permitidos também com janela aberta. Não há bloqueio por janela para preparar template aprovado.

## Seleção e componentes

`template_id` aceita ID interno ou nome solicitado; a UI pré-seleciona ambos e lê suggested_values por ID ou nome. A descrição da tool documenta chaves body_1/body_2 (posicional) e body_nome/body_pedido (NAMED). O parser existente já reconhece componentes reais, exemplos e parâmetros nomeados: os novos testes exercitam quatro variáveis nos dois formatos e confirmam parâmetros Cloud API, incluindo parameter_name no NAMED. Não foi atribuído ao parser um defeito que não se reproduziu.

`capture-reviewer-contract.mjs` agora executa também shapeTemplate, shapePhone e templateRejectionReason reais do app; a fixture registra os hashes dos fontes e usa identidades fictícias. Conversas seguem o serializer real já utilizado. Os testes simulam a semântica da rota: UUID interno no filtro Meta retorna vazio, filtro WABA correto retorna os aprovados. Na implementação anterior, o teste não chega a Rascunho; com a correção, seleciona o solicitado e preenche os quatro valores sem mutações.

## Administração

As descrições com UI habilitada orientam webhooks, credenciais de IA e administração exclusivamente para https://botozap.com.br; proíbem sugerir habilitar/expor essas ações no plugin ou pedir segredos no chat. Skills conectar-botozap/casos-da-ia receberam a mesma instrução. Catálogo/descrições sem UI continuam inalterados. É orientação ao modelo; nenhuma permissão administrativa foi ampliada.

## Evidências e release

Build, typecheck, 659 testes (SDK 176, CLI 105, MCP 378), gate:tarballs, guarda HTTP e diff-check verdes. Oito capturas `screenshots/p5-template-reviewer-*.png`, inline/fullscreen desktop/mobile claro/escuro, com axe A/AA zero, sem overflow/borda dupla/card vazio e asserções de janela aberta, template solicitado e pedido 12345. Resultado: validation-p5.json; cenário do simulador: http://127.0.0.1:4174/chat?scenario=template-reviewer.

Changeset patch aplicado: MCP 0.8.3. SDK 0.10.0 e CLI 0.6.1 permanecem porque não foram alterados. release:mcp --dry-run passou: botozap-mcp-0.8.3.tgz, 250.2 kB, 130 arquivos, SHA1 d294d9b8bb8b9f718d7f8f680c43579c74125c4a. Sem deploy, publicação npm ou portal; as skills foram atualizadas no fonte.

Após merge/publicação/deploy pelo responsável, revalidar a conta real: pedido do confirmacao_pedido com quatro valores e janela aberta, confirmação na tela, e recusa administrativa que direciona ao painel sem propor novas ações no plugin.
