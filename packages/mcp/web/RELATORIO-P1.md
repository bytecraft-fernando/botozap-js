# Relatório P1 — piloto no ChatGPT real

Branch `fix/mcp-ui-pilot-1`, criada de `origin/main` em `f586343fd1ea82b7e4f2328486e6b01ba2fcfad7`. Correções motivadas pelo teste de Fernando no ChatGPT web; validação local reproduz a moldura do host. Nenhum deploy, publicação npm, alteração de flags ou mudança no app ou em `plugins/botozap/**`.

## Resultado

| Item | Comportamento final |
|---|---|
| Negócio único | O bootstrap seleciona automaticamente quando `total_count === 1` e carrega o Radar; páginas parciais não são confundidas com conta de negócio único. |
| Singular/plural | Helper `quantity` compartilhado para item, pendência, cliente, conversa e dia; “1 item” e “1 pendência”. |
| Sem conversa | O carrossel conserva Abrir no BotoZap até confirmar um vínculo pelas tools; o painel mostra motivo/próximo passo e link, sem resposta, mensagens ou compositor. Reunião/agendamento abre `/agenda`; outros itens abrem `/radar`. |
| Link real | Links HTTPS do BotoZap usam `ui/open-link` (`App.openLink`) pelo host, com âncora semântica e fallback de nova aba; nenhuma navegação externa autoriza acesso. |
| Título | Carrossel chama-se Pendências. |
| Retorno do fullscreen | Sem conversa aberta, o painel mostra resumo das primeiras pendências e Abrir em tela cheia; não exibe avatar ou rascunho vazio. No mobile mostra dois itens, no desktop três; fullscreen conserva a lista inteira da página. |
| Moldura inline | O simulador representa o `prefersBorder` do ChatGPT na coluna do chat. Todas as telas inline têm padding interno de 20 px e removem borda/sombra dos containers externos; a moldura do host é a única borda externa. |
| CSP | Todos os oito resources UI, inclusive REVIEW/REPLY/RADAR, compartilham CSP padrão e alias ChatGPT; conexões, assets e subframes externos permanecem sem domínios permitidos. Redirecionamentos permitem somente `https://botozap.com.br`. |
| Rótulos | Todas as tools de UI declaram invoking/invoked em português, com até 64 caracteres. |
| Atendimento | Alertas abertos e casos abertos de qualquer origem aparecem juntos, com alertas críticos primeiro e seleção por item; alertas oferecem revisar conversa/abrir painel, casos preservam assumir/devolver com confirmação e permissões. |
| Caminho do modelo | Descrições das tools de UI e diretas correspondentes orientam UI para preparo/revisão/escolhas, e execução direta para pedidos completos explícitos. Só aplicadas após negociação MCP Apps e permissão da conta piloto; sem UI as descrições são preservadas. Criação de template continua direta, como corrigido pelo coordenador. |

## CSP e domínio

A [referência oficial do Apps SDK](https://developers.openai.com/apps-sdk/reference#component-resource-_meta-fields), consultada nesta rodada, distingue `ui.csp` dos aliases do ChatGPT e exige `openai/widgetCSP.redirect_domains` para destinos externos confiáveis. A implementação usa `connectDomains/resourceDomains/frameDomains: []` e `connect_domains/resource_domains/frame_domains: []`, mais `redirect_domains: ["https://botozap.com.br"]`; `openai/widgetPrefersBorder` acompanha `ui.prefersBorder`.

Não se declara `openai/widgetDomain` fictício: a UI é HTML empacotado, usando a origem padrão do sandbox. Um domínio dedicado e único por plugin é requisito de submissão pública segundo a referência e precisa ser provisionado/validado antes da publicação. Este PR não faz publicação nem configura infraestrutura. A remoção do aviso “CSP desativada” e o comportamento de open-link devem ser reconfirmados no ChatGPT real após a próxima implantação autorizada; a evidência local comprova os metadados, não o cache/render do host em produção.

## API pública e limite das conversas pausadas

Pesquisa somente em leitura no app: `src/app/api/v1/ai/alerts/route.ts` fornece GET `/v1/ai/alerts` com `customer_id`, status, kind, severity e paginação; scope `agents:read`. A tool agora faz essa leitura pelo SDK, além de GET `/v1/ai/cases` sem o filtro antigo `source=agent`. A política já usa `agents:read`; `TOOL_ROUTES.open_agent_cases` exige ambas as rotas, com teste de autorização OAuth fail-closed.

`src/app/api/v1/conversations/route.ts` e `serialize.ts` não filtram nem devolvem o estado de pausa do agente. `src/app/api/v1/conversations/[id]/agent-control/route.ts` oferece somente POST pause/resume, não GET ou lista. Portanto **não existe rota pública suficiente para enumerar as oito conversas pausadas**; não há consulta inventada nem contagem zero inferida. A resposta indica `paused_available: false` e a tela orienta conferir também esses atendimentos no BotoZap. O coordenador foi informado durante a execução.

A consulta atual retorna a primeira página de até 20 casos e 100 alertas, com totais do servidor; críticos são priorizados entre os alertas carregados. Histórico de casos continua sendo leitura autorizada antes de liberar ação. Troca de seleção invalida uma evidência em andamento e ações já solicitadas nesta sessão não são repetidas ao selecionar o caso novamente; CAS de revisão continua no servidor. Alertas não são assumidos como se fossem casos.

Falta uma extensão pública do app para listar conversas pausadas aguardando humano, com filtro por negócio, paginação e scope/rotas definidos. Quando existir, o SDK e a composição do atendimento poderão consumir esse contrato; não foi alterado o repo do app nesta rodada.

## Validação

- `pnpm build`, `pnpm typecheck`, `pnpm test`: verdes, **570 testes** (173 SDK, 105 CLI, 292 MCP).
- `pnpm gate:tarballs`: verde; catálogo sem UI continua compatível com a fixture 0.6.0, com apenas os acréscimos já existentes get_profile/prepare_send_intent.
- Guarda HTTP do CI e `git diff --check`: verdes, nenhum cliente HTTP duplicado ou nova referência node:http/node:https.
- Testes novos cobrem os oito resources com CSP, rótulos, gating das descrições, alerta crítico sem caso, rotas OAuth, pluralização, auto seleção, ação sem conversa e mudança de seleção durante leitura de evidência.
- **92 capturas**, claro/escuro, desktop/mobile: carrossel, reply, Radar, entrada global, template, casos, booking, live, agendamento sem conversa no carrossel/painel e alerta crítico sem casos; inline e fullscreen, mais retorno inline da entrada global.
- Zero violações axe WCAG A/AA, sem overflow do host/iframe, nenhum card vazio e nenhuma borda dupla inline nas asserções. Inspeção visual das composições em ambos os temas e formatos concluída.
- Sem instrumentação de debug no commit. Dados e diálogos de piloto do simulador são fictícios.

[Validação das capturas](screenshots/validation-p1.json), [Pendências mobile após fullscreen](screenshots/p1-global-inline-return-mobile-light.png), [carrossel na moldura do host](screenshots/p1-carousel-inline-desktop-dark.png), [item sem conversa](screenshots/p1-unlinked-panel-fullscreen-mobile-light.png), [alerta crítico sem casos](screenshots/p1-alerts-inline-desktop-dark.png), [resposta inline](screenshots/p1-reply-inline-desktop-light.png), [template](screenshots/p1-template-inline-mobile-dark.png), [agendamento](screenshots/p1-booking-fullscreen-desktop-light.png) e [plantão](screenshots/p1-live-inline-desktop-light.png).

## Reprodução e próximo teste real

Simulador em http://127.0.0.1:4174/chat, sem afetar 4173. Cenários `pilot-global`, `pilot-unlinked`, `pilot-alerts` somam-se aos roteiros existentes. `PORT=4174 pnpm --filter @botozap/mcp demo:ui` inicia; `pnpm --filter @botozap/mcp exec node scripts/screenshot-p1.mjs` captura a matriz completa.

Uma tool nova de resumo do dia não foi necessária: `open_botozap` já é uma entrada sem argumentos para Pendências e sua descrição agora direciona pedidos como “o que tenho pendente” e “resumo do dia”. Isso evita ampliar o catálogo padrão. Depois da implantação autorizada, Fernando precisa conferir seleção de tools pelo modelo, CSP/open-link e ida/volta de display mode no host real; testes locais não garantem qual tool um modelo escolherá.
