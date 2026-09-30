# Rodada 4A.3 — rodapé acima do compositor

O layout fullscreen passou a ter uma única área vertical de rolagem que termina acima da barra de ações e do compositor do host. A barra fica fixa, com altura medida por ResizeObserver, e o texto final nunca precisa passar atrás dela. A safe area usa `--host-safe-bottom`, preenchida pelo host context MCP Apps, com reserva mínima/fallback de 160 px. Crescimento do compositor e mudanças nos botões recalculam o espaço disponível.

A implementação central fica em `web/screens/fullscreen-layout.ts`/`.css`. O screen-kit instala o controlador para template, cases e booking; Radar e conversa usam o mesmo controlador com duas linhas de integração no panel. Não foram alterados registros, protocolos de envio, PiP/eventos ou entrada global. Inline conserva seu layout normal; alternar para inline remove a barra fixa. A confirmação recebe prioridade sobre o grupo de ações do rascunho.

## Teste de geometria e acessibilidade

Com o simulador ativo, execute:

```sh
pnpm --filter @botozap/mcp demo:ui
# http://127.0.0.1:4173/chat
node packages/mcp/tests/fullscreen-footer-capture.mjs
node packages/mcp/tests/templates-4a2-capture.mjs
```

O teste Playwright percorre template/carrossel, conversa, Radar, cases e booking em desktop/mobile, claro/escuro. Em cada estado, verifica topo, meio e fim da rolagem: o primário permanece visível e acima do compositor; ao final, o último texto/controle termina acima da barra de ações. Verifica também confirmação e crescimento do compositor. Cases/booking são ampliados pelo protocolo `ui/request-display-mode` real do AppBridge, sem lógica especial nas telas.

- Build, typecheck, 543 testes unitários, gate de tarballs e guarda HTTP passaram.
- 56 capturas novas de fullscreen: geometria e axe WCAG A/AA sem violações.
- 100 capturas de templates da 4A.2 foram regeneradas com o rodapé corrigido, inclusive `4a2-template-carousel-previa-desktop-light.png`; axe A/AA zerado.
- O vídeo `roteiro-4a2-template-carousel-conversa-desktop-dark.webm` também foi regenerado.
- Simulador mantido na porta 4173. Nenhuma flag de produção, publicação ou deploy.

Nenhuma decisão nova de produto pendente. O SHA deve ser repassado ao worker B após seu rebase; a integração dele permanece fora desta tarefa.

## Capturas novas
- `screenshots/4a3-template-carousel-rodape-desktop-light.png`
- `screenshots/4a3-template-carousel-confirmacao-desktop-light.png`
- `screenshots/4a3-template-carousel-compositor-alto-desktop-light.png`
- `screenshots/4a3-conversation-rodape-desktop-light.png`
- `screenshots/4a3-conversation-confirmacao-desktop-light.png`
- `screenshots/4a3-conversation-compositor-alto-desktop-light.png`
- `screenshots/4a3-radar-rodape-desktop-light.png`
- `screenshots/4a3-radar-confirmacao-desktop-light.png`
- `screenshots/4a3-radar-compositor-alto-desktop-light.png`
- `screenshots/4a3-cases-rodape-desktop-light.png`
- `screenshots/4a3-cases-confirmacao-desktop-light.png`
- `screenshots/4a3-cases-compositor-alto-desktop-light.png`
- `screenshots/4a3-booking-rodape-desktop-light.png`
- `screenshots/4a3-booking-compositor-alto-desktop-light.png`
- `screenshots/4a3-template-carousel-rodape-mobile-light.png`
- `screenshots/4a3-template-carousel-confirmacao-mobile-light.png`
- `screenshots/4a3-template-carousel-compositor-alto-mobile-light.png`
- `screenshots/4a3-conversation-rodape-mobile-light.png`
- `screenshots/4a3-conversation-confirmacao-mobile-light.png`
- `screenshots/4a3-conversation-compositor-alto-mobile-light.png`
- `screenshots/4a3-radar-rodape-mobile-light.png`
- `screenshots/4a3-radar-confirmacao-mobile-light.png`
- `screenshots/4a3-radar-compositor-alto-mobile-light.png`
- `screenshots/4a3-cases-rodape-mobile-light.png`
- `screenshots/4a3-cases-confirmacao-mobile-light.png`
- `screenshots/4a3-cases-compositor-alto-mobile-light.png`
- `screenshots/4a3-booking-rodape-mobile-light.png`
- `screenshots/4a3-booking-compositor-alto-mobile-light.png`
- `screenshots/4a3-template-carousel-rodape-desktop-dark.png`
- `screenshots/4a3-template-carousel-confirmacao-desktop-dark.png`
- `screenshots/4a3-template-carousel-compositor-alto-desktop-dark.png`
- `screenshots/4a3-conversation-rodape-desktop-dark.png`
- `screenshots/4a3-conversation-confirmacao-desktop-dark.png`
- `screenshots/4a3-conversation-compositor-alto-desktop-dark.png`
- `screenshots/4a3-radar-rodape-desktop-dark.png`
- `screenshots/4a3-radar-confirmacao-desktop-dark.png`
- `screenshots/4a3-radar-compositor-alto-desktop-dark.png`
- `screenshots/4a3-cases-rodape-desktop-dark.png`
- `screenshots/4a3-cases-confirmacao-desktop-dark.png`
- `screenshots/4a3-cases-compositor-alto-desktop-dark.png`
- `screenshots/4a3-booking-rodape-desktop-dark.png`
- `screenshots/4a3-booking-compositor-alto-desktop-dark.png`
- `screenshots/4a3-template-carousel-rodape-mobile-dark.png`
- `screenshots/4a3-template-carousel-confirmacao-mobile-dark.png`
- `screenshots/4a3-template-carousel-compositor-alto-mobile-dark.png`
- `screenshots/4a3-conversation-rodape-mobile-dark.png`
- `screenshots/4a3-conversation-confirmacao-mobile-dark.png`
- `screenshots/4a3-conversation-compositor-alto-mobile-dark.png`
- `screenshots/4a3-radar-rodape-mobile-dark.png`
- `screenshots/4a3-radar-confirmacao-mobile-dark.png`
- `screenshots/4a3-radar-compositor-alto-mobile-dark.png`
- `screenshots/4a3-cases-rodape-mobile-dark.png`
- `screenshots/4a3-cases-confirmacao-mobile-dark.png`
- `screenshots/4a3-cases-compositor-alto-mobile-dark.png`
- `screenshots/4a3-booking-rodape-mobile-dark.png`
- `screenshots/4a3-booking-compositor-alto-mobile-dark.png`
