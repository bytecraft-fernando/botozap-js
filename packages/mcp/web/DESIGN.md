# BotoZap no ChatGPT

A direção visual é o sistema oficial do ChatGPT, com fonte do sistema, superfícies neutras e os tokens de `@openai/apps-sdk-ui@0.2.2`. O tema do host chega por `App.getHostContext` / `onhostcontextchanged`: `applyDocumentTheme` e `applyHostStyleVariables` aplicam tema, cores, tipografia e foco. Não existe paleta própria `.dark`, logo na resposta, fonte externa ou CDN. O rosa `#a71d5d` aparece somente no botão primário, com texto branco (contraste superior a 7:1).

## Referências e decisões

Referência principal travada: [UI guidelines da OpenAI](https://developers.openai.com/plugins/concepts/ui-guidelines). Preserve fonte do sistema, cores do sistema, ação única e card autocontido; nenhuma marca em texto, bordas ou superfícies. Referências complementares: [Apps SDK UI](https://github.com/openai/apps-sdk-ui), [spec MCP extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md), `@modelcontextprotocol/ext-apps@1.7.5` e a referência de foco/formulários `refero-design/references/craft-details.md`. O contexto do app em `botozap/docs/DESIGN.md` contribui somente com lista/detalhe, vocabulário e papel do rosa; suas fontes e sua paleta não são transplantadas.

| Decisão | Fonte / papel | Aplicação |
|---|---|---|
| Resposta pronta inline | OpenAI: decisão simples, até duas ações | Contato, WhatsApp/número de origem, negócio, janela 24h, prévia e Enviar/Editar |
| Confirmação no mesmo card | Brief de segurança + craft forms | Consentimento explícito; sem terceira ação ou navegação |
| Radar fullscreen | OpenAI: fluxo complexo | Negócio, pendências e histórico com rascunho editável |
| Tema e tokens oficiais | Apps SDK UI + host context | Tokens primitivos, semânticos e de componentes empacotados no HTML; variáveis do host prevalecem |
| Documento com uma rolagem | OpenAI: sem scroll aninhado | Lista e histórico crescem no fluxo; mobile empilha colunas |
| Composer sobreposto | OpenAI fullscreen + safeAreaInsets | Reserva inferior de 160px mais inset do host; overlay demonstrativo só na demo |
| Foco e anúncios | WCAG / craft details | Labels, foco visível, role=status, aria-live e dados de contato como texto |

Os estados usam rótulos explícitos e texto neutro do sistema: os tons de estado padrão do pacote não passaram contraste AA em todas as superfícies escuras, então não os usamos para texto.

Os controles são elementos HTML nativos acessíveis estilizados pelos tokens oficiais; não adicionamos uma árvore React ao painel existente. O build importa os três layers de tokens diretamente do pacote instalado (incluindo licença MIT), transforma `@theme static` em declarações CSS padrão e não inclui os assets de fontes/Katex do pacote. Assim o HTML continua autocontido e a CSP mantém todos os domínios vazios.

## Recursos e display modes

- `stage_review_reply` aponta para `ui://botozap/reply/v1.html`: `availableDisplayModes: ["inline"]`, `preferredDisplayMode: "inline"`.
- `open_review_panel` conserva `ui://botozap/review/v1.html` e o entrypoint `thread`: `availableDisplayModes: ["inline", "fullscreen"]`, `preferredDisplayMode: "fullscreen"`.
- O cliente anuncia os modos do recurso correspondente na inicialização e só solicita uma mudança se o host a oferecer. A preferência é uma sugestão ao host; se fullscreen não existir, o Radar permanece um documento responsivo sem rolagens internas.
- Os schemas e resultados das tools permanecem iguais. Sem UI, as tools continuam retornando dados estruturados úteis. Com `BOTOZAP_MCP_UI_ENABLED` desligado, tools de revisão, metadados UI e recursos UI não são registrados, como antes.
- Seleção, histórico e rascunho são atualizados por `ui/update-model-context`, com conteúdo de contato explicitamente não confiável. Ações de envio usam `callServerTool`; não é necessário produzir uma mensagem redundante por `ui/message`.

## Estados e envio

O card possui rascunho, confirmando, enviando, aceito, recusado, incerto e janela fechada. Aceite significa somente confirmação do servidor/provedor, sem afirmar entrega ou leitura. Uma recusa confirmada exibe motivo/próxima ação e libera a preparação; uma janela fechada remove Enviar e orienta template no painel. O estado incerto no card congela texto e chave, bloqueia repetição e orienta conferir o histórico.

A lógica de idempotência do Radar permanece integral: UUID por intenção, chave preparada preservada, edição gera nova chave, recusa confirmada libera, sem retry automático, texto incerto congelado e recuperação manual explícita somente com o mesmo payload/chave. O relógio começa no primeiro POST e bloqueia recuperação após 24h. A releitura antes do envio confirma destinatário/canal/janela, sem eliminar a possibilidade de alteração concorrente entre GET e POST. Intenções vivem na memória do iframe; recarregar não restaura uma tentativa pendente.

## Demo local e screenshots

Na raiz do repo, após `pnpm install`:

```sh
pnpm --filter @botozap/mcp demo:ui
```

Abra http://127.0.0.1:4173/. Os controles alternam card/Radar, sete estados do card e tema claro/escuro; o Radar tem negócio e pendências navegáveis, histórico e edição reais sobre uma ponte fictícia. Nenhuma credencial ou mensagem real é usada. O composer exibido no Radar é uma simulação identificada; em produção, só o ChatGPT desenha seu composer.

Para recriar os screenshots, mantenha a demo aberta e rode em outro terminal:

```sh
pnpm --filter @botozap/mcp exec playwright install chromium
pnpm --filter @botozap/mcp screenshots:ui
```

O script verifica WCAG A/AA com axe, limite de duas ações visíveis no card e ausência de overflow horizontal; grava 21 PNGs em `screenshots/`: sete estados em dois temas, Radar desktop/mobile em dois temas, dois viewports mobile mostrando o composer e um card mobile escuro. A avaliação automática complementa a inspeção visual, sem substituir a validação no host real.

O protótipo não ativa flags, não publica pacotes e não faz deploy. A próxima decisão é a validação dentro de uma sessão real do ChatGPT antes de habilitar a UI em produção.
