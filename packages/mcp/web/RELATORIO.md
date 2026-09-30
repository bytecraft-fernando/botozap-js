# Relatório — rodada 2: BotoZap dentro do ChatGPT

PR em draft: https://github.com/bytecraft-fernando/botozap-js/pull/14
Branch: `feat/mcp-ui-chatgpt`. SHA de implementação: `ea8437bc9d4ae24b07610609c86b232c2fb8a4bd`.

## Entrega

Simulador do host ChatGPT com sidebar, mensagens do usuário/assistente, compositor fixo, claro/escuro e desktop/mobile. Os iframes executam o `main.ts` de produção, via `AppBridge` e `PostMessageTransport` do MCP Apps. O fake está somente no host: tools, modelo e eventos de entrega/leitura. Roteiro clicável: pendências → Responder → rascunho → “deixa mais curto” → Editar fullscreen → confirmação → aceite → entrega → leitura. Cenários adicionais: janela fechada, recusado, incerto, vazio, loading e erro. “Abra o Radar” abre o painel completo com seletor de negócio.

Carrossel de até oito cards, avatar de iniciais, nome consultado em get_contact, prioridade, tempo relativo e Responder. Resposta pronta em bolha, contato/número mascarado, chips de negócio/origem/janela, no máximo Editar/Enviar; motivo e orientação de recusado/incerto dentro do card. Conversa fullscreen com contato/urgência persistentes, histórico em bolhas, contador e rascunho após o histórico. Safe area medida pelo host mantém revisão acima do compositor; o chat também leva ações inline para a área visível no mobile.

UI restrita opcionalmente por `BOTOZAP_MCP_UI_ACCOUNTS` junto da flag existente. Contas fora da lista não recebem tools, recursos ou metadados UI; catálogo igual à fixture 0.6.0 mais get_profile e prepare_send_intent. Sem lista, preserva o comportamento anterior da flag. Identidade renovada atualiza a disponibilidade. Recursos de carrossel/rascunho preferem inline; revisão/Radar prefere fullscreen; todos anunciam os dois modos para permitir Editar e fallback. Schemas e contratos não mudaram.

Entrega/leitura só são exibidas após histórico com recibo correspondente à mesma mensagem outbound/conversa; leitura não regride. Idempotência, congelamento incerto, ausência de retry automático, recusa confirmada e proteção de 24h continuam cobertos. Tokens oficiais, tema do host, foco, labels e aria-live; CSS/JS autocontidos e CSP sem domínios externos. Referências pesquisadas com refero-design e decisões em [DESIGN.md](DESIGN.md).

## Validação

- `pnpm build`: verde.
- `pnpm typecheck`: verde.
- `pnpm test`: verde, 474 testes (173 SDK, 105 CLI, 196 MCP).
- `pnpm gate:tarballs`: verde; catálogo empacotado compatível com 0.6.0 e somente get_profile/prepare_send_intent adicionadas sem UI.
- Guarda HTTP executada a partir do bloco exato de `.github/workflows/ci.yml`: verde.
- `pnpm --filter @botozap/mcp screenshots:ui`: 60 capturas, zero violações axe WCAG A/AA; limite de ações, runtime e overflow verificados, ações inline/fullscreen acima do compositor verificadas geometricamente.
- Inspeção visual de desktop/mobile, claro/escuro e estados incerto/recusado: concluída.
- Servidor 4173 reiniciado com a versão nova e deixado ativo; Responder em outra pendência também verificado pela ponte real.

## Simulador

```sh
pnpm --filter @botozap/mcp demo:ui
```

URL: http://127.0.0.1:4173/chat. Sem credenciais, somente dados fictícios. Para reproduzir:

```sh
pnpm --filter @botozap/mcp exec playwright install chromium
pnpm --filter @botozap/mcp screenshots:ui
```

Vídeo do roteiro: [roteiro-chat-desktop-dark.webm](screenshots/roteiro-chat-desktop-dark.webm), 12,48 segundos, 1440×1050. Evidência automática: [validation.json](screenshots/validation.json).

## Lista de screenshots

Todos os 60 arquivos estão em `packages/mcp/web/screenshots/`; substituem as capturas da rodada 1.

| Etapa/estado | Desktop claro | Desktop escuro | Mobile claro | Mobile escuro |
|---|---|---|---|---|
| a-pendencias | [desktop light](screenshots/chat-a-pendencias-desktop-light.png) | [desktop dark](screenshots/chat-a-pendencias-desktop-dark.png) | [mobile light](screenshots/chat-a-pendencias-mobile-light.png) | [mobile dark](screenshots/chat-a-pendencias-mobile-dark.png) |
| b-resposta | [desktop light](screenshots/chat-b-resposta-desktop-light.png) | [desktop dark](screenshots/chat-b-resposta-desktop-dark.png) | [mobile light](screenshots/chat-b-resposta-mobile-light.png) | [mobile dark](screenshots/chat-b-resposta-mobile-dark.png) |
| c-curta | [desktop light](screenshots/chat-c-curta-desktop-light.png) | [desktop dark](screenshots/chat-c-curta-desktop-dark.png) | [mobile light](screenshots/chat-c-curta-mobile-light.png) | [mobile dark](screenshots/chat-c-curta-mobile-dark.png) |
| d-conversa | [desktop light](screenshots/chat-d-conversa-desktop-light.png) | [desktop dark](screenshots/chat-d-conversa-desktop-dark.png) | [mobile light](screenshots/chat-d-conversa-mobile-light.png) | [mobile dark](screenshots/chat-d-conversa-mobile-dark.png) |
| e-confirmacao | [desktop light](screenshots/chat-e-confirmacao-desktop-light.png) | [desktop dark](screenshots/chat-e-confirmacao-desktop-dark.png) | [mobile light](screenshots/chat-e-confirmacao-mobile-light.png) | [mobile dark](screenshots/chat-e-confirmacao-mobile-dark.png) |
| e-aceito | [desktop light](screenshots/chat-e-aceito-desktop-light.png) | [desktop dark](screenshots/chat-e-aceito-desktop-dark.png) | [mobile light](screenshots/chat-e-aceito-mobile-light.png) | [mobile dark](screenshots/chat-e-aceito-mobile-dark.png) |
| e-entregue | [desktop light](screenshots/chat-e-entregue-desktop-light.png) | [desktop dark](screenshots/chat-e-entregue-desktop-dark.png) | [mobile light](screenshots/chat-e-entregue-mobile-light.png) | [mobile dark](screenshots/chat-e-entregue-mobile-dark.png) |
| e-lido | [desktop light](screenshots/chat-e-lido-desktop-light.png) | [desktop dark](screenshots/chat-e-lido-desktop-dark.png) | [mobile light](screenshots/chat-e-lido-mobile-light.png) | [mobile dark](screenshots/chat-e-lido-mobile-dark.png) |
| radar | [desktop light](screenshots/chat-radar-desktop-light.png) | [desktop dark](screenshots/chat-radar-desktop-dark.png) | [mobile light](screenshots/chat-radar-mobile-light.png) | [mobile dark](screenshots/chat-radar-mobile-dark.png) |
| f-closed | [desktop light](screenshots/chat-f-closed-desktop-light.png) | [desktop dark](screenshots/chat-f-closed-desktop-dark.png) | [mobile light](screenshots/chat-f-closed-mobile-light.png) | [mobile dark](screenshots/chat-f-closed-mobile-dark.png) |
| f-rejected | [desktop light](screenshots/chat-f-rejected-desktop-light.png) | [desktop dark](screenshots/chat-f-rejected-desktop-dark.png) | [mobile light](screenshots/chat-f-rejected-mobile-light.png) | [mobile dark](screenshots/chat-f-rejected-mobile-dark.png) |
| f-uncertain | [desktop light](screenshots/chat-f-uncertain-desktop-light.png) | [desktop dark](screenshots/chat-f-uncertain-desktop-dark.png) | [mobile light](screenshots/chat-f-uncertain-mobile-light.png) | [mobile dark](screenshots/chat-f-uncertain-mobile-dark.png) |
| f-empty | [desktop light](screenshots/chat-f-empty-desktop-light.png) | [desktop dark](screenshots/chat-f-empty-desktop-dark.png) | [mobile light](screenshots/chat-f-empty-mobile-light.png) | [mobile dark](screenshots/chat-f-empty-mobile-dark.png) |
| f-loading | [desktop light](screenshots/chat-f-loading-desktop-light.png) | [desktop dark](screenshots/chat-f-loading-desktop-dark.png) | [mobile light](screenshots/chat-f-loading-mobile-light.png) | [mobile dark](screenshots/chat-f-loading-mobile-dark.png) |
| f-error | [desktop light](screenshots/chat-f-error-desktop-light.png) | [desktop dark](screenshots/chat-f-error-desktop-dark.png) | [mobile light](screenshots/chat-f-error-mobile-light.png) | [mobile dark](screenshots/chat-f-error-mobile-dark.png) |

## Decisões de Fernando / limites

Escolher os account_id do piloto e validar OAuth, modo fullscreen e safe area em uma sessão real do ChatGPT antes de habilitar a UI. O protótipo não ativa flag, faz deploy, publica pacote ou edita o app, http.ts e get_profile/`/v1/me`; a simulação não garante a geometria de todas as versões do host real. O host precisa entregar um histórico atualizado para o card receber confirmação de entrega/leitura; não há polling ou retry automático acrescentado. Intenções pendentes continuam na memória do iframe; reload não restaura uma tentativa incerta. O carrossel depende das permissões de leitura para enriquecer contatos/conversas e mantém rótulos conservadores quando faltam dados.
