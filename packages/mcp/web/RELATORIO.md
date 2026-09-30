# Relatório — UI BotoZap no ChatGPT

PR em draft: https://github.com/bytecraft-fernando/botozap-js/pull/14

Branch: `feat/mcp-ui-chatgpt`. Commit de implementação: `159a2f8664106bdf1f8d09b37a24d4c1770b6c2e`.

## Entrega

Card inline “Resposta pronta” com contato, WhatsApp/número de origem, negócio, prévia e janela 24h; estados rascunho, confirmando, enviando, aceito, recusado com motivo/próxima ação, incerto bloqueado e janela fechada sem Enviar. Até duas ações visíveis. Radar responsivo com negócio, pendências crítico/atenção/programado, histórico e edição; uma rolagem de documento e reserva para o composer do host.

Tokens oficiais `@openai/apps-sdk-ui@0.2.2`, fonte do sistema, tema/variáveis do host e rosa somente no primário. Textos de estado neutros mantêm contraste AA em superfícies claras/escuras. Recursos distintos declaram inline para `stage_review_reply` e preferência fullscreen para `open_review_panel`, preservando entrypoint thread e fallback inline. Schemas, resultados e backend de envio/idempotência permanecem compatíveis. O card bloqueia repetir um resultado incerto; a recuperação manual explícita original do Radar conserva payload/chave/24h sem retry automático.

## Verificação

- `pnpm build`: passou.
- `pnpm typecheck`: passou.
- `pnpm test`: passou; 470 testes (173 SDK, 105 CLI, 192 MCP), incluindo fixture 0.6.0 e congelamento do card incerto.
- `pnpm gate:tarballs`: passou; binários/tools/types verificados em projeto limpo.
- Guarda “Nenhum fetch/cliente HTTP fora do SDK” executada a partir do bloco do CI: passou.
- `pnpm --filter @botozap/mcp screenshots:ui`: passou; axe WCAG A/AA, no máximo duas ações inline e ausência de overflow horizontal nos 21 cenários capturados.
- Inspeção visual de card claro/escuro, rejeição, incerteza, Radar desktop e mobile com composer: passou.

## Demo

```sh
pnpm --filter @botozap/mcp demo:ui
```

URL: http://127.0.0.1:4173/. Dados fictícios e estados/tema/layout selecionáveis. Para recriar as imagens com a demo aberta:

```sh
pnpm --filter @botozap/mcp exec playwright install chromium
pnpm --filter @botozap/mcp screenshots:ui
```

## Screenshots

Todos em `packages/mcp/web/screenshots/`:

- [card-accepted-dark.png](screenshots/card-accepted-dark.png)
- [card-accepted-light.png](screenshots/card-accepted-light.png)
- [card-closed-dark.png](screenshots/card-closed-dark.png)
- [card-closed-light.png](screenshots/card-closed-light.png)
- [card-confirming-dark.png](screenshots/card-confirming-dark.png)
- [card-confirming-light.png](screenshots/card-confirming-light.png)
- [card-draft-dark.png](screenshots/card-draft-dark.png)
- [card-draft-light.png](screenshots/card-draft-light.png)
- [card-mobile-dark.png](screenshots/card-mobile-dark.png)
- [card-rejected-dark.png](screenshots/card-rejected-dark.png)
- [card-rejected-light.png](screenshots/card-rejected-light.png)
- [card-sending-dark.png](screenshots/card-sending-dark.png)
- [card-sending-light.png](screenshots/card-sending-light.png)
- [card-uncertain-dark.png](screenshots/card-uncertain-dark.png)
- [card-uncertain-light.png](screenshots/card-uncertain-light.png)
- [radar-desktop-dark.png](screenshots/radar-desktop-dark.png)
- [radar-desktop-light.png](screenshots/radar-desktop-light.png)
- [radar-mobile-composer-dark.png](screenshots/radar-mobile-composer-dark.png)
- [radar-mobile-composer-light.png](screenshots/radar-mobile-composer-light.png)
- [radar-mobile-dark.png](screenshots/radar-mobile-dark.png)
- [radar-mobile-light.png](screenshots/radar-mobile-light.png)

## Fora de escopo / decisão de Fernando

UI segue desligada em produção. Não houve deploy Fly, publicação npm, mudança de flags, edição do repo do app, edição de `packages/mcp/src/http.ts` ou de `get_profile`/`/v1/me`. Ainda falta validar em uma sessão real do ChatGPT com o host OAuth e decidir quando habilitar a UI; a demo simula o composer, não comprova sua geometria real. O fallback de hosts que ignoram fullscreen mantém o Radar responsivo; preferências de display mode continuam sujeitas à decisão do host. Intenções pendentes permanecem na memória do iframe, como antes: reload não as restaura.
