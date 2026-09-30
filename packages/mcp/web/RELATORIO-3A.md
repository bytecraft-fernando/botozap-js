# UI BotoZap · rodada 3A

PR draft: https://github.com/bytecraft-fernando/botozap-js/pull/14
Branch: `feat/mcp-ui-chatgpt`. Telas 5/8 pertencem à rodada paralela do worker B.

## Abrir e reproduzir

```sh
pnpm --filter @botozap/mcp demo:ui
# http://127.0.0.1:4173/chat
node packages/mcp/scripts/screenshot-3a.mjs
```

Links diretos: `/chat?scenario=template`, `/chat?scenario=cases`,
`/chat?scenario=booking`; acrescente `&theme=dark` para escuro. O seletor oferece
carregamento, vazio e erro nas três telas, recusa/incerteza em template/agenda,
e sem permissão em casos. As telas reais rodam em iframes MCP Apps; só o host
simula dados e resultados. Nenhuma ação do simulador consulta produção.

## Entregue

- Carrossel: Responder primário só na maior prioridade; demais em contorno.
- Resposta: última mensagem recebida acima do rascunho, horário relativo; chip
  de janela desaparece após aceite; entregue/lido sem aviso redundante.
- Tela 4: janela fechada abre templates aprovados do número, De/Para, seletor,
  variáveis sugeridas/editáveis e prévia com cabeçalho/corpo/botões. Confirmação
  explícita usa `send_message type=template`, prepara UUID por intenção, relê
  destinatário/origem/aprovação e congela após resultado incerto. Formulário nativo
  `openai/elicitation/create` com sugestões quando anunciado; fallback acessível.
- Tela 6: caso escalado, razão, evidência do histórico, resumo de conversas e
  assumir/devolver com confirmação, identidade, permissão e CAS. Ausência de
  evidência ou autorização bloqueia ação. Devolver informa a retomada automática.
- Tela 7: horários ordenados por dia, faixa, responsável e Meet solicitado;
  confirmação com contato/serviço/aviso. Releitura da disponibilidade antes de
  criar; UUID por intenção. Aviso só pela janela aberta e após criação confirmada.

As quatro auxiliares são read-only, não recebem `account_id`, respeitam flags,
conta e `allowed_routes`; tools existentes continuam com o mesmo contrato. Três
recursos novos preferem inline e oferecem fullscreen. A janela fechada abre o
editor em fullscreen quando suportado. Safe area medida do compositor, tokens
Apps SDK UI e tema do host; HTML empacotado, CSP sem domínios externos.

## Validação

`pnpm build`, `pnpm typecheck`, `pnpm test` (494: SDK 173, CLI 105, MCP 216),
`pnpm gate:tarballs`, guarda HTTP idêntica à do CI e `git diff --check` passaram.
Gate confirmou catálogo padrão idêntico à fixture 0.6.0 mais `get_profile` e
`prepare_send_intent`. Vinte testes novos cobrem protocolo nativo, permissões,
confirmação, CAS, parâmetros, disponibilidade, recusa, incerteza e aviso posterior.

Playwright/axe: 100 capturas novas + 60 anteriores regeneradas; WCAG A/AA com zero
violações, nenhum erro de runtime ou overflow. Até duas ações por card, uma por
horário. Resultados em `screenshots/validation-3a.json` e `validation.json`.
Os vídeos são gravações do navegador durante cada roteiro, sem montagem: template
8,24 s, casos 9,08 s e agenda 6,96 s, com pausas para leitura. Regenerar somente
os vídeos: `node packages/mcp/scripts/screenshot-3a.mjs --video-only`.

CI da implementação `f41a8b9c0bba92e7ce810dcfec200e1b9208a44c`: Node 20.19, 22 e 24
verdes ([execução](https://github.com/bytecraft-fernando/botozap-js/actions/runs/36676378891)).

## Limites e decisões do Fernando

1. Aprovar o piloto e escolher account_ids continua pendente; nenhuma flag foi
   ligada, nenhum deploy ou publicação foi feito. Validar o formulário nativo e
   display modes no ChatGPT real da conta piloto; o protocolo nativo está coberto
   por teste MCP, e o simulador usa o fallback próprio.
2. Prévia suporta templates de texto e botões QUICK_REPLY/URL/PHONE_NUMBER.
   Mídia/autenticação/outros componentes são excluídos do editor; tools existentes
   continuam disponíveis. Decidir se a próxima rodada inclui essas famílias.
3. A API entrega quantidade de conversas, não clientes únicos. O resumo usa
   conversas; o período diário da consulta de uso é UTC. Definir o fuso do resumo
   e métrica de clientes únicos exige decisão/API de produto.
4. Compromisso e aviso não são atômicos. Se o aviso falhar, o card informa que o
   compromisso existe e bloqueia recriação. Meet é solicitado, condicionado à
   conexão; a prévia não inventa URL antes da criação.
5. O caso consultado é o primeiro caso aberto com origem agent. Navegação de
   vários casos e origens guardrail podem ser ampliadas depois. Assumir atribui
   o caso ao operador; não promete pausar toda a automação do negócio.

## Vídeos

- [roteiro-3a-booking-desktop-dark.webm](screenshots/roteiro-3a-booking-desktop-dark.webm)
- [roteiro-3a-cases-desktop-dark.webm](screenshots/roteiro-3a-cases-desktop-dark.webm)
- [roteiro-3a-template-desktop-dark.webm](screenshots/roteiro-3a-template-desktop-dark.webm)

## Capturas novas (100)

- [3a-booking-confirmacao-desktop-dark.png](screenshots/3a-booking-confirmacao-desktop-dark.png)
- [3a-booking-confirmacao-desktop-light.png](screenshots/3a-booking-confirmacao-desktop-light.png)
- [3a-booking-confirmacao-mobile-dark.png](screenshots/3a-booking-confirmacao-mobile-dark.png)
- [3a-booking-confirmacao-mobile-light.png](screenshots/3a-booking-confirmacao-mobile-light.png)
- [3a-booking-empty-desktop-dark.png](screenshots/3a-booking-empty-desktop-dark.png)
- [3a-booking-empty-desktop-light.png](screenshots/3a-booking-empty-desktop-light.png)
- [3a-booking-empty-mobile-dark.png](screenshots/3a-booking-empty-mobile-dark.png)
- [3a-booking-empty-mobile-light.png](screenshots/3a-booking-empty-mobile-light.png)
- [3a-booking-error-desktop-dark.png](screenshots/3a-booking-error-desktop-dark.png)
- [3a-booking-error-desktop-light.png](screenshots/3a-booking-error-desktop-light.png)
- [3a-booking-error-mobile-dark.png](screenshots/3a-booking-error-mobile-dark.png)
- [3a-booking-error-mobile-light.png](screenshots/3a-booking-error-mobile-light.png)
- [3a-booking-horarios-desktop-dark.png](screenshots/3a-booking-horarios-desktop-dark.png)
- [3a-booking-horarios-desktop-light.png](screenshots/3a-booking-horarios-desktop-light.png)
- [3a-booking-horarios-mobile-dark.png](screenshots/3a-booking-horarios-mobile-dark.png)
- [3a-booking-horarios-mobile-light.png](screenshots/3a-booking-horarios-mobile-light.png)
- [3a-booking-loading-desktop-dark.png](screenshots/3a-booking-loading-desktop-dark.png)
- [3a-booking-loading-desktop-light.png](screenshots/3a-booking-loading-desktop-light.png)
- [3a-booking-loading-mobile-dark.png](screenshots/3a-booking-loading-mobile-dark.png)
- [3a-booking-loading-mobile-light.png](screenshots/3a-booking-loading-mobile-light.png)
- [3a-booking-marcado-desktop-dark.png](screenshots/3a-booking-marcado-desktop-dark.png)
- [3a-booking-marcado-desktop-light.png](screenshots/3a-booking-marcado-desktop-light.png)
- [3a-booking-marcado-mobile-dark.png](screenshots/3a-booking-marcado-mobile-dark.png)
- [3a-booking-marcado-mobile-light.png](screenshots/3a-booking-marcado-mobile-light.png)
- [3a-booking-rejected-desktop-dark.png](screenshots/3a-booking-rejected-desktop-dark.png)
- [3a-booking-rejected-desktop-light.png](screenshots/3a-booking-rejected-desktop-light.png)
- [3a-booking-rejected-mobile-dark.png](screenshots/3a-booking-rejected-mobile-dark.png)
- [3a-booking-rejected-mobile-light.png](screenshots/3a-booking-rejected-mobile-light.png)
- [3a-booking-uncertain-desktop-dark.png](screenshots/3a-booking-uncertain-desktop-dark.png)
- [3a-booking-uncertain-desktop-light.png](screenshots/3a-booking-uncertain-desktop-light.png)
- [3a-booking-uncertain-mobile-dark.png](screenshots/3a-booking-uncertain-mobile-dark.png)
- [3a-booking-uncertain-mobile-light.png](screenshots/3a-booking-uncertain-mobile-light.png)
- [3a-cases-assumido-desktop-dark.png](screenshots/3a-cases-assumido-desktop-dark.png)
- [3a-cases-assumido-desktop-light.png](screenshots/3a-cases-assumido-desktop-light.png)
- [3a-cases-assumido-mobile-dark.png](screenshots/3a-cases-assumido-mobile-dark.png)
- [3a-cases-assumido-mobile-light.png](screenshots/3a-cases-assumido-mobile-light.png)
- [3a-cases-confirmacao-desktop-dark.png](screenshots/3a-cases-confirmacao-desktop-dark.png)
- [3a-cases-confirmacao-desktop-light.png](screenshots/3a-cases-confirmacao-desktop-light.png)
- [3a-cases-confirmacao-mobile-dark.png](screenshots/3a-cases-confirmacao-mobile-dark.png)
- [3a-cases-confirmacao-mobile-light.png](screenshots/3a-cases-confirmacao-mobile-light.png)
- [3a-cases-devolvido-desktop-dark.png](screenshots/3a-cases-devolvido-desktop-dark.png)
- [3a-cases-devolvido-desktop-light.png](screenshots/3a-cases-devolvido-desktop-light.png)
- [3a-cases-devolvido-mobile-dark.png](screenshots/3a-cases-devolvido-mobile-dark.png)
- [3a-cases-devolvido-mobile-light.png](screenshots/3a-cases-devolvido-mobile-light.png)
- [3a-cases-empty-desktop-dark.png](screenshots/3a-cases-empty-desktop-dark.png)
- [3a-cases-empty-desktop-light.png](screenshots/3a-cases-empty-desktop-light.png)
- [3a-cases-empty-mobile-dark.png](screenshots/3a-cases-empty-mobile-dark.png)
- [3a-cases-empty-mobile-light.png](screenshots/3a-cases-empty-mobile-light.png)
- [3a-cases-error-desktop-dark.png](screenshots/3a-cases-error-desktop-dark.png)
- [3a-cases-error-desktop-light.png](screenshots/3a-cases-error-desktop-light.png)
- [3a-cases-error-mobile-dark.png](screenshots/3a-cases-error-mobile-dark.png)
- [3a-cases-error-mobile-light.png](screenshots/3a-cases-error-mobile-light.png)
- [3a-cases-escalado-desktop-dark.png](screenshots/3a-cases-escalado-desktop-dark.png)
- [3a-cases-escalado-desktop-light.png](screenshots/3a-cases-escalado-desktop-light.png)
- [3a-cases-escalado-mobile-dark.png](screenshots/3a-cases-escalado-mobile-dark.png)
- [3a-cases-escalado-mobile-light.png](screenshots/3a-cases-escalado-mobile-light.png)
- [3a-cases-loading-desktop-dark.png](screenshots/3a-cases-loading-desktop-dark.png)
- [3a-cases-loading-desktop-light.png](screenshots/3a-cases-loading-desktop-light.png)
- [3a-cases-loading-mobile-dark.png](screenshots/3a-cases-loading-mobile-dark.png)
- [3a-cases-loading-mobile-light.png](screenshots/3a-cases-loading-mobile-light.png)
- [3a-cases-permission-desktop-dark.png](screenshots/3a-cases-permission-desktop-dark.png)
- [3a-cases-permission-desktop-light.png](screenshots/3a-cases-permission-desktop-light.png)
- [3a-cases-permission-mobile-dark.png](screenshots/3a-cases-permission-mobile-dark.png)
- [3a-cases-permission-mobile-light.png](screenshots/3a-cases-permission-mobile-light.png)
- [3a-template-aceito-desktop-dark.png](screenshots/3a-template-aceito-desktop-dark.png)
- [3a-template-aceito-desktop-light.png](screenshots/3a-template-aceito-desktop-light.png)
- [3a-template-aceito-mobile-dark.png](screenshots/3a-template-aceito-mobile-dark.png)
- [3a-template-aceito-mobile-light.png](screenshots/3a-template-aceito-mobile-light.png)
- [3a-template-confirmacao-desktop-dark.png](screenshots/3a-template-confirmacao-desktop-dark.png)
- [3a-template-confirmacao-desktop-light.png](screenshots/3a-template-confirmacao-desktop-light.png)
- [3a-template-confirmacao-mobile-dark.png](screenshots/3a-template-confirmacao-mobile-dark.png)
- [3a-template-confirmacao-mobile-light.png](screenshots/3a-template-confirmacao-mobile-light.png)
- [3a-template-empty-desktop-dark.png](screenshots/3a-template-empty-desktop-dark.png)
- [3a-template-empty-desktop-light.png](screenshots/3a-template-empty-desktop-light.png)
- [3a-template-empty-mobile-dark.png](screenshots/3a-template-empty-mobile-dark.png)
- [3a-template-empty-mobile-light.png](screenshots/3a-template-empty-mobile-light.png)
- [3a-template-error-desktop-dark.png](screenshots/3a-template-error-desktop-dark.png)
- [3a-template-error-desktop-light.png](screenshots/3a-template-error-desktop-light.png)
- [3a-template-error-mobile-dark.png](screenshots/3a-template-error-mobile-dark.png)
- [3a-template-error-mobile-light.png](screenshots/3a-template-error-mobile-light.png)
- [3a-template-janela-fechada-desktop-dark.png](screenshots/3a-template-janela-fechada-desktop-dark.png)
- [3a-template-janela-fechada-desktop-light.png](screenshots/3a-template-janela-fechada-desktop-light.png)
- [3a-template-janela-fechada-mobile-dark.png](screenshots/3a-template-janela-fechada-mobile-dark.png)
- [3a-template-janela-fechada-mobile-light.png](screenshots/3a-template-janela-fechada-mobile-light.png)
- [3a-template-loading-desktop-dark.png](screenshots/3a-template-loading-desktop-dark.png)
- [3a-template-loading-desktop-light.png](screenshots/3a-template-loading-desktop-light.png)
- [3a-template-loading-mobile-dark.png](screenshots/3a-template-loading-mobile-dark.png)
- [3a-template-loading-mobile-light.png](screenshots/3a-template-loading-mobile-light.png)
- [3a-template-previa-desktop-dark.png](screenshots/3a-template-previa-desktop-dark.png)
- [3a-template-previa-desktop-light.png](screenshots/3a-template-previa-desktop-light.png)
- [3a-template-previa-mobile-dark.png](screenshots/3a-template-previa-mobile-dark.png)
- [3a-template-previa-mobile-light.png](screenshots/3a-template-previa-mobile-light.png)
- [3a-template-rejected-desktop-dark.png](screenshots/3a-template-rejected-desktop-dark.png)
- [3a-template-rejected-desktop-light.png](screenshots/3a-template-rejected-desktop-light.png)
- [3a-template-rejected-mobile-dark.png](screenshots/3a-template-rejected-mobile-dark.png)
- [3a-template-rejected-mobile-light.png](screenshots/3a-template-rejected-mobile-light.png)
- [3a-template-uncertain-desktop-dark.png](screenshots/3a-template-uncertain-desktop-dark.png)
- [3a-template-uncertain-desktop-light.png](screenshots/3a-template-uncertain-desktop-light.png)
- [3a-template-uncertain-mobile-dark.png](screenshots/3a-template-uncertain-mobile-dark.png)
- [3a-template-uncertain-mobile-light.png](screenshots/3a-template-uncertain-mobile-light.png)
