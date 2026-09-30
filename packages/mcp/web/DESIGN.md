# BotoZap dentro do ChatGPT — rodada 2

O produto é uma conversa assistida: o ChatGPT organiza as prioridades, prepara a resposta com contexto e ajusta o texto pelo próprio compositor. A pessoa só abre a conversa completa quando precisa revisar o histórico. As UIs de produção e da demonstração são os mesmos iframes, com uma ponte MCP Apps real; os dados e o comportamento do modelo fictício ficam exclusivamente no host local.

## Referências e direção

A referência principal é a [UI guidelines da OpenAI](https://developers.openai.com/plugins/concepts/ui-guidelines): fonte e cores do sistema, cards autocontidos, até duas ações por card, carrossel inline e fullscreen para revisão complexa. [Apps SDK UI](https://github.com/openai/apps-sdk-ui) fornece os tokens oficiais; a [spec MCP extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md) determina os modos e entrypoints. O contexto em `botozap/docs/DESIGN.md` foi lido somente para vocabulário e produto; não transplantamos suas fontes ou paleta.

A pesquisa com a skill `refero-design` consultou estilos de Attio (CRM) e Intercom (mensagens), telas de ChatGPT claro/escuro, Nextdoor (conversa) e Cushion (inbox vazia). O coordenador também forneceu referências de Rox, WhatsApp iOS, Jace, Fernand e ManyChat. Elas orientam hierarquia e comportamento; nenhuma marca, fonte ou cor de outro app aparece nas telas.

| Referência | Decisão aplicada |
|---|---|
| [ChatGPT claro](https://refero.design/screens/2260b104-cf7a-4284-8ce0-22b6c2453efd) e [escuro](https://refero.design/screens/c9675a3b-dec0-42ee-9b66-1c89b4039f21) | Sidebar discreta, usuário em bolha, assistente em texto, superfície neutra e compositor fixo |
| Attio e Intercom | Priorização por pessoa, avatar de iniciais, informação curta e uma ação por pendência |
| [Nextdoor](https://refero.design/screens/a2ea9fb7-ecfa-4655-b2b7-d1d5354762ce) e [WhatsApp iOS](https://refero.design/screens/9d2b1d8b-a098-4833-9ee6-53eb53e29570) | Cabeçalho de contato, bolhas alinhadas por direção e horários relativos; sem cores ou logotipos de terceiros |
| [Rox](https://refero.design/pages/b2b99545-69d1-40fe-924c-5d65f4ce1f1d) | Negócio identificado nos cards; seletor de negócio no Radar |
| [Jace](https://refero.design/pages/a0d2caa3-4913-4c3b-8fe8-88f49293bfb9) | Rascunho imediatamente após o histórico, em formato de mensagem |
| [Fernand](https://refero.design/pages/54c8ba55-da90-4ccf-9964-133858a29f8f) | Origem, negócio e janela explícitos; aceite separado de entrega/leitura |
| [ManyChat](https://refero.design/pages/cd0f5eaf-2afa-4166-861b-b0fc04ed49c2) | Rascunho atualiza no mesmo card e anuncia “Atualizado”; sem uma terceira ação de desfazer |
| [Cushion](https://refero.design/screens/8a974bf1-38e4-4f51-b9a1-1259de5343e1) | Vazio útil com próximos comandos; skeleton e falha com orientação |

## Telas e protocolo

1. `list_radar` aponta para `ui://botozap/radar-cards/v1.html`, carrossel inline com até oito pendências e uma ação **Responder** por card. Nome vem de `get_contact`, não do título do Radar. O tempo de espera vem de `get_conversation.last_message_at`; quando não há conversa vinculada, o card informa o tempo sem atividade do Radar. Enriquecimento não disponível mantém uma apresentação conservadora.
2. `stage_review_reply` aponta para `ui://botozap/reply/v1.html`, preferência inline, contato, número mascarado, bolha de rascunho, chips e **Editar / Enviar**. Editar solicita fullscreen; em hosts sem esse modo, a edição permanece no mesmo documento.
3. `open_review_panel` conserva `ui://botozap/review/v1.html`, entrypoint `thread` e preferência fullscreen. O Radar completo permite trocar negócio e selecionar pendências; a edição do card abre diretamente a conversa, com contato/urgência persistentes e rascunho após o histórico.

Os três recursos declaram `availableDisplayModes: ["inline", "fullscreen"]`. A preferência não obriga o host. Sem suporte visual, as tools conservam dados estruturados e schemas. `ui/update-model-context` transmite seleção, rascunho e estado com conteúdo do contato marcado não confiável; o carrossel usa `ui/message` para pedir ao modelo a preparação de uma resposta. Nenhuma tela envia ao clicar em Responder ou Editar.

O simulador usa `AppBridge` e `PostMessageTransport` do `@modelcontextprotocol/ext-apps`: inicialização, tool input/result, server tools, mensagem ao modelo, contexto e pedido de display mode passam pelo protocolo. O host fornece tema, dimensões, locale e safe area medida a partir do compositor. Iframes fullscreen ficam sob o compositor, com reserva inferior e rolagem de documento; lista e histórico não viram scroll containers. Só o carrossel tem a rolagem horizontal prevista nas diretrizes.

## Aparência e acessibilidade

Os tokens CSS de `@openai/apps-sdk-ui@0.2.2` e sua licença são empacotados no HTML. Controles HTML nativos fornecem semântica e teclado; não há fontes, CDN ou domínios externos na CSP. `applyDocumentTheme` e `applyHostStyleVariables` acompanham o host. Não há tema próprio `.dark` nem logo dentro da resposta. A marca aparece somente no botão primário rosa `#a71d5d`, com texto branco e contraste superior a 7:1.

Texto e ícones usam cores do sistema. Aviso de janela usa a superfície semântica de warning, borda do sistema e texto de alto contraste. Labels, foco visível, `aria-live`, regiões nomeadas, avatares decorativos e respeito a reduced motion permanecem em todos os estados. O script de captura verifica WCAG A/AA, overflow, até duas ações inline e a posição da ação de revisão acima do compositor real do simulador.

## Estados e segurança

Rascunho → confirmando → enviando → aceito. O card só informa entregue/lido quando recebe um resultado de histórico com o mesmo ID ou wamid, mesma conversa, direção outbound e status explícito; eventos de outras mensagens não alteram o card e leitura não regride. Na demo, esses eventos são gerados pelo host após o aceite e são identificados como fictícios.

Recusa confirmada mostra motivo/próxima ação no card e libera revisão. Incerto congela texto/chave e bloqueia repetição inline; a recuperação manual original do Radar conserva payload/chave/24h. Janela fechada não mostra Enviar e orienta avaliar template no painel BotoZap. Não há retry automático. UUID por intenção, releitura de destinatário/canal/janela antes do POST, congelamento, expiração de 24h e proteção de clique duplo permanecem. Intenções vivem na memória do iframe; reload não restaura tentativas pendentes.

## Piloto por conta

`BOTOZAP_MCP_UI_ENABLED=true` continua sendo necessário. `BOTOZAP_MCP_UI_ACCOUNTS` opcional restringe a UI por `account_id` da identidade já resolvida, no registro de tools/recursos. Lista ausente preserva o comportamento anterior da flag; lista vazia bloqueia todas as contas; lista definida remove tools/metadados/recursos UI de outras contas. Refresh de identidade também atualiza o catálogo e os recursos. Nenhuma flag foi habilitada em produção.

## Simulador e reprodução

```sh
pnpm --filter @botozap/mcp demo:ui
```

Abra http://127.0.0.1:4173/chat. O roteiro começa com “O que tenho hoje no BotoZap?”. Clique em Responder, escreva “deixa mais curto” no compositor, clique em Editar e confirme o envio. O status passa por aceite, entrega e leitura em eventos separados. “Abra o Radar” mostra a visão completa; o seletor superior troca cenário e o botão de tema altera os iframes pelo host context. Todos os dados são fictícios e não há credenciais.

```sh
pnpm --filter @botozap/mcp exec playwright install chromium
pnpm --filter @botozap/mcp screenshots:ui
```

O script grava 60 PNGs: roteiro a–e, seis variações f e Radar, em desktop/mobile e claro/escuro. Também grava `roteiro-chat-desktop-dark.webm` e `validation.json`. O vídeo é uma gravação de sessão de browser, sem composição artificial. A validação automática e o simulador não substituem a revisão em uma sessão OAuth real do ChatGPT.


## Rodada 3A: contexto e decisões assistidas

A pendência mais urgente recebe o único **Responder** cheio do carrossel. As
outras usam contorno. O card de resposta mostra a última mensagem recebida antes
do rascunho (padrão de contexto Poppy, solicitado no feedback). Após aceite, o chip
de janela desaparece; entregue/lido ficam no chip e na bolha, sem um segundo aviso.

A pesquisa Refero desta rodada examinou [Resend](https://refero.design/pages/cb66ec48-9da5-4899-81e9-ae73e24806f0)
para De/Para compactos e prévia grande, e [Airbnb Select a time](https://refero.design/pages/9db126f1-1482-4e66-8806-e097341d7d55)
para horários ordenados por dia e confirmação separada. Square Assistant orienta
o resumo do atendimento e a escalação com evidência; a leitura de histórico real
substitui notas internas do caso, que não são mensagens do cliente.

- Tela 4: `stage_review_template` → `ui://botozap/template/v1.html`. Só templates
  aprovados com prévia suportada, valores editáveis e confirmação. A janela fechada
  do card abre a mesma tela em fullscreen; sua tool prefere inline. Releitura de
  origem, destinatário, aprovação e definição acontece antes do envio. O formulário
  nativo segue [MCP extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md)
  (`openai/elicitation/create`, modo form, `x-openai-suggestions`). UI própria quando
  a capability está ausente. A ferramenta de variáveis não envia.
- Tela 6: `open_agent_cases` → `ui://botozap/cases/v1.html`, inline. Evidência vem de
  `list_messages`; assumir/devolver usam `ai_cases_update`, revisão CAS e confirmação
  explícita, incluindo o efeito de retomar automação. Sem permissão, sem ação;
  evidência indisponível também bloqueia ação. Métrica é de conversas, não pessoas.
- Tela 7: `stage_appointment_booking` → `ui://botozap/booking/v1.html`, inline.
  Disponibilidade e criação são reais. Selecionar não cria; confirmar releituras e
  usa UUID por intenção. Compromisso e aviso são operações separadas: falha no aviso
  nunca refaz o compromisso, e janela fechada orienta template.

Os três recursos declaram inline/fullscreen, preferem inline, seguem o tema do
host e empacotam CSS/JS. A região inferior respeita a safe area do compositor.
Fixtures ficam em `scenarios/`; telas reais em `screens/`; somente o host simula
respostas. As telas 5/8 são trabalho de outro worker e não fazem parte desta rodada.
