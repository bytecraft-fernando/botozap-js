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

## Rodada 4A: templates completos e hosts abertos

A direção visual mantém o sistema do host: tipografia/cores/bordas vindas de
`ui/notifications/host-context-changed` e `styles.variables` do MCP Apps, com os
tokens locais do apps-sdk-ui como fallback. A bolha de template repete a linguagem
da resposta pronta; De/Para e variáveis ficam compactos ao lado da prévia, acima
ou abaixo no mobile. Mídia é um placeholder acessível (tipo/nome/tamanho informados),
sem download nem URL exposta. Carrossel de template rola apenas horizontalmente;
a tela reserva a safe area inferior e usa a rolagem do documento.

Referências consultadas novamente: Resend para composição e prévia de mensagem,
Airbnb para cabeçalho por dia. A UI mantém hierarquia de duas ações no máximo;
os botões do template são elementos da prévia, sem ação de navegação no host.

### Negociação e matriz host × recurso

O SDK `getUiCapability` lê a extensão negociada no initialize:
`capabilities.extensions["io.modelcontextprotocol/ui"].mimeTypes` deve ser uma
lista contendo `text/html;profile=mcp-app`. Inicialmente, tools auxiliares e recursos
UI ficam desabilitados; após initialize, a capacidade + flag + allowlist + permissões
ativam o registro. Identidade refrescada reavalia a mesma regra. Metadados UI não
entram no catálogo sem capacidade; nenhum parâmetro obrigatório antigo mudou.

| Recurso | ChatGPT com MCP Apps | Genérico com MCP Apps | Sem MCP Apps / flags desligadas |
|---|---|---|---|
| Card e carrossel inline | iframe / ponte padrão | iframe / ponte padrão | tools e conteúdo estruturado/texto existentes |
| Radar / conversa | fullscreen quando anunciado | fullscreen quando anunciado; inline como fallback | `list_radar`, conversas e mensagens |
| Templates, escalação, agenda | componentes reais e tools existentes | mesmos componentes e tools existentes | sem auxiliares UI; tools existentes continuam disponíveis |
| Tema | variáveis/tema do host | variáveis/tema do host, inclusive fonte | não se aplica |
| Contexto de modelo / mensagem | capacidades padrão MCP Apps | só se o host anuncia; orientação textual caso não ofereça mensagens | modelo usa resultados das tools |
| Elicitation nativa OpenAI | somente `openai/elicitation.form` e campos de texto | formulário próprio sem chamadas OpenAI | tools não dependem de elicitation |
| Metadados OpenAI / entrypoints | hints opcionais | hints desconhecidos ignorados; nenhuma dependência | contrato anterior preservado, incluindo `get_profile` |

Os nomes comerciais Claude web/desktop, VS Code Copilot, M365 Copilot, Goose,
Postman e MCPJam não viram detecção por user-agent: a capacidade negociada decide.
O tema genérico do simulador é fictício para testar variáveis diferentes, e não
uma reprodução desses produtos. Compatibilidade em instalações reais precisa
ser verificada por versão. PiP, eventos e entrada global são trabalho paralelo
(telas 5/8), não são implementados nem modificados aqui.

Fontes: [spec MCP Apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx),
[SDK oficial](https://github.com/modelcontextprotocol/ext-apps),
[extensões OpenAI](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md).

### Templates: separar envio de criação

A rota `messages` e o SDK aceitam componentes opacos: até 20 componentes e 32 KiB
UTF-8 no JSON. A UI só opera definições APROVADAS obtidas do catálogo do número,
e relê aprovação/definição/destinatário antes de enviar. Conhece header texto,
imagem, vídeo, documento e localização; body posicional/nomeado e parâmetros
texto/moeda/data com fallback; footer; quick reply, URL dinâmica, telefone,
copiar código, OTP copiar/one-tap, carrossel 2–10 cards e oferta limitada.
Botões de catálogo já sincronizados podem fornecer action JSON; a prévia
exibe o CTA, não tenta reproduzir a interação externa do cliente.

Isso não significa que o builder de criação aceite todos esses tipos: ele não preserva LIMITED_TIME_OFFER e não preserva
exemplos nomeados. São lacunas do app para criar novos templates; precisam de uma
mudança separada antes de serem oferecidos como criação no BotoZap. Envio de um
template já aprovado/sincronizado é distinto. Schemas desconhecidos são bloqueados
na UI e continuam disponíveis no contrato bruto da tool.

Não gera OTP, não faz upload, não consulta terceiros, não promete disponibilidade
pública da mídia nem aceita media_id como prova de existência. Valida formato,
limites, exclusão URL/id, HTTPS sem credenciais/endereços locais, coordenadas,
expiração futura com fuso e JSON objeto. Aprovação da Meta e restrições do canal
continuam sendo verificadas no servidor/provedor. Oferta mostra a data no fuso do
visualizador; a expiração enviada conserva o instante absoluto em milissegundos.

### Agenda e métrica

Agenda tem um cabeçalho por dia, horários sem data repetida e “Com Meet” nos cards.
O aviso de dependência da conexão fica na confirmação/erro. A escalação aceita
`unique_contacts_today` + `timezone` válidos em `usage` ou `usage.handoff`; sem isso,
usa `handoff.conversations` e informa **conversas hoje (UTC)**, sem inferir pessoas.
O produtor da API deve calcular clientes únicos no dia civil do fuso do negócio,
independentemente do intervalo UTC usado pela métrica antiga.

### 4A.2 — prévia primeiro, edição progressiva

Direção travada no feedback aprovado do Fernando: a bolha e os cards são a superfície principal (Resend para prévia/composição, Poppy para contexto, já pesquisados acima). O formulário fica abaixo, recolhido em **Editar campos**, com **Avançado** também recolhido por grupo. A marca mantém seu papel no botão primário; cores, tipografia e foco vêm do host.

| Decisão | Fonte | Aplicação |
|---|---|---|
| Prévia preenchida antes dos controles | Fernando + Resend | Uma coluna, prévia em cima em desktop/mobile |
| Ajustes pela conversa | Fernando + MCP Apps | `updateModelContext` legível + `stage_review_template` existente |
| Edição progressiva e linguagem humana | Fernando | Nome do cliente, quantidade, imagem do card; transporte técnico no Avançado |
| Código de autenticação visível | Fernando | Código do sistema do negócio, fora da expansão |
| Erro obrigatório próximo da mensagem | Fernando + acessibilidade | Aviso humano com atalho que expande e foca o campo |

O contexto envia nome, prévia, variáveis com nomes humanos e chaves necessárias para staging. URLs de mídia são protegidas e omitidas do mapa copiado ao modelo; o assistente deve preservar os demais campos. Staging atualiza o mesmo card e invalida a chave da intenção quando há ajuste; confirmação/envio/incerto bloqueiam alterações. A prévia não abre elicitação automaticamente. A tool nativa `review_template_variables` continua disponível ao modelo quando pedida explicitamente; abrir uma prévia não força um segundo formulário sobre a conversa.

O simulador de ajustes fica exclusivamente em `web/scenarios/template.ts`, no host, e usa notificações MCP Apps. Exemplo: **“Muda o nome para Mariana e troca a imagem do segundo card pela coleção Floresta”**. A UI real só recebe o resultado de staging, sem reconhecer pedidos ou inventar dados.

### 4A.3 — rodapé fullscreen centralizado

A área rolável termina antes do compositor e da barra fixa de ações, com a altura da barra medida e a safe area informada pelo host (mínimo/fallback 160 px). Screen-kit e Radar/conversa compartilham o mesmo controlador; não há padding manual por tela para corrigir esse caso. Os testes percorrem topo/meio/fim, confirmação e compositor expandido em todas as telas fullscreen. Veja [o relatório e as capturas](RELATORIO-4A3.md).


## Rodada 3B — plantão e entrada global (30/09/2026)

Direção travada: preservamos os tokens, tipografia do host e a densidade das referências ChatGPT/Intercom/Fernand acima. No plantão, a linha vertical organiza recibos e prévia do cliente; uma única ação **Responder** devolve a intenção ao compositor do host, sem editor ou envio próprio. A entrada global reutiliza `mountReview` (Radar/Pendências, histórico e rodapé compartilhado); não duplica a tela de briefing. Não alteramos o card, carrossel ou as telas de template/casos/agenda.

### PiP: contrato e limite real do host

A [spec atual de mcp-extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#display-modes) declara explicitamente que ChatGPT suporta `inline` e `fullscreen`, mas **não `pip`**. A tabela de plataformas cobre ChatGPT Work web (exclui ChatGPT clássico), desktop, iOS e Android; ela não promete PiP em nenhuma plataforma. As [diretrizes de UI](https://developers.openai.com/plugins/concepts/ui-guidelines#picture-in-picture-pip) descrevem o comportamento desejado para quando houver suporte, não uma garantia de disponibilidade. `@modelcontextprotocol/ext-apps@1.7.5` tipa `pip` e aceita `app.requestDisplayMode({mode:"pip"})`; o SDK de extensões `0.1.0` também aceita `pip` no schema de recursos, mas a spec publicada restringe os metadados OpenAI a inline/fullscreen. Mantemos os recursos nesses dois modos e anunciamos a capacidade PiP na inicialização MCP Apps; pedimos PiP somente quando `hostContext.availableDisplayModes` incluir o valor literal `pip`. Recusa/ausência resulta em inline, sem erro. A demo na 4174 mostra esse fallback real, sem inventar janela flutuante do ChatGPT.

A sessão termina quando a conversa deixa de estar ativa, o prazo local de 30 minutos após o envio termina, ou a pessoa pede uma resposta nova. Ao terminar, retorna a inline; teardown do host e pagehide param o timer e invalidam leituras em andamento. Só há a ação Responder, que envia `ui/update-model-context` (texto do cliente marcado não confiável) e `ui/message`; o assistente prepara uma nova resposta com a última mensagem. Hosts sem mensagem ao modelo orientam usar o compositor. Não há retry de envio.

### Atualizações: polling de leitura via host

O stream durável `/events` e LISTEN/NOTIFY continuam nos resources MCP existentes. A notificação `notifications/resources/updated` sinaliza uma releitura ao cliente MCP; não existe na ponte instalada uma assinatura genérica que encaminhe essas notificações a qualquer iframe. A extensão `openai/resource` descreve os arquivos que abriram a app, e não um repasse universal do event bus BotoZap. Portanto o caminho implementado é `callServerTool` → `open_live_conversation`, com `conversation_id`, `after` e `message_id` (ID interno ou WAMID do envio aceito). O host conserva as credenciais; nenhum fetch/domínio externo é usado no iframe.

Cada leitura confirma a conversa, consulta até 100 mensagens filtradas por ela e uma página de até 100 eventos. O cursor avança sobre a página inteira, mesmo que nenhum evento seja desta conversa. Só devolve projeções de recibos ligados às mensagens autorizadas, respostas posteriores ao envio e eventos de digitação explicitamente vinculados à conversa. Corpo bruto do evento, account_id, outras conversas e mensagens antigas não saem da tool. Um recibo só promove a própria mensagem outbound; a UI não regride leitura. A prévia vem do histórico autorizado, é limitada a 500 caracteres e renderizada com textContent; conteúdo removido é substituído. Enquanto chegam novos eventos, intervalo de 2 s; sem mudanças cresce até 30 s; páginas com mais eventos usam 1 s. Aba invisível pausa consultas. Falha de permissão ou leitura interrompe o polling e pede reabertura pelo assistente, sem loop de erro. Limite: eventos cuja mensagem não esteja entre as 100 consultadas não são inferidos; a pessoa pode consultar o histórico completo no Radar.

A tool é somente leitura, exige `conversations:read`, `messages:read`, `events:read` e suas três rotas OAuth exatas. Tanto ela quanto os dois resources e `open_botozap` usam o gating existente de `createRegister`: flags de UI, allowlist de contas e suporte MCP Apps negociado no initialize. Sem UI, o catálogo 0.6.0 permanece intacto. A identidade atual é conferida a cada chamada.

### Entrada global e deep links

`open_botozap` aceita `{}`, tem título Pendências, ícone SVG monocromático embutido e `_meta["openai/ui"].entrypoints: [{type:"global"}]`. O resultado inicial reutiliza o bootstrap do Radar; o recurso prefere fullscreen, com composer e safe area do host. Links chegam como `hostContext["openai/deepLink"].url` na inicialização e em `ui/notifications/host-context-changed`. Tema e alterações parciais sem deepLink não apagam a rota.

Rotas aceitas: `/`, `/conversa/<UUID>` e `/pendencia/<UUID>?type=opportunity|demand` (sem type usa opportunity). O parser rejeita URLs absolutas, autoridade `//`, fragments, escapes, traversal, IDs inválidos e query ambígua. Não usamos o path para autorizar: get_conversation e get_phone_number confirmam conversa/negócio; pendências passam antes por get_opportunity/get_demand e lista de conversas vinculadas. O painel relê histórico e conversa pelas tools existentes. Falha mantém uma orientação de acesso; nenhum envio ou rascunho automático é criado. Troca de rota invalida consultas anteriores e usa uma instância isolada do mesmo Radar, evitando que respostas antigas alterem a nova tela.

Conforme a [spec de deep links](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#deep-links), encode o path inteiro como valor da query:

- Web: `https://chatgpt.com/plugins/<plugin-id>/app/open_botozap?path=%2Fconversa%2F<UUID>`.
- Desktop: `codex://plugins/<plugin-id>/app/open_botozap?path=%2Fconversa%2F<UUID>`.
- Mobile: `chatgpt://plugins/<plugin-id>/app/open_botozap?path=%2Fconversa%2F<UUID>`.

Plugin-id e tool name são segmentos percent-encoded. `@<marketplace>` só se usa em marketplace próprio e é omitido na publicação direta no ChatGPT. A tabela atual promete deep links no desktop, Work web e iOS; **Android ainda não tem suporte**, embora o entrypoint global esteja previsto nas quatro plataformas. Validar isso no host real antes do piloto.

### Proposta para o APP (não implementada)

Quando um cliente responder, o app poderá enviar ao operador autorizado uma mensagem WhatsApp interativa `cta_url`, por exemplo: “Sâmia respondeu: pode confirmar o pedido. Abra a conversa para revisar.” O botão **Responder no ChatGPT** aponta para o deep link web da conversa. O app deve respeitar a janela/regras do WhatsApp do operador; fora da janela, avaliar um template aprovado compatível. O alerta não autoriza acesso nem envia resposta ao cliente.

Faltam: plugin-id publicado, confirmação do nome `open_botozap` no catálogo publicado, operador com acesso ao mesmo negócio e plugin conectado, escolha de fallback para Android/operador sem plugin (inbox web autenticada ou instrução para conectar o plugin), deduplicação dos alertas e política de notificação/preview. Fernando decide publicação/piloto, contas e fallback; este PR não modifica o app nem ativa flags/deploy.

### Outros hosts e reprodução

Claude, VS Code Copilot, M365 Copilot e Goose podem renderizar o mesmo plantão inline pelo protocolo MCP Apps, com os tokens padrão do host e fallback. Entrada global e deep links são extras OpenAI: hosts que não os reconhecem ignoram os metadados, não exibem shortcut e podem abrir o Radar por tool; sem deepLink a tela começa nas pendências. Nenhuma promessa de suporte a PiP é feita por nome de plataforma. Host sem MCP Apps não recebe as tools auxiliares/resources UI.

`PORT=4174 pnpm --filter @botozap/mcp demo:ui` mantém esta demo separada da 4173 do worker A. Em `/chat?scenario=live`, confirme Enviar e peça “Abra o plantão ao vivo”; chegam enviada, entregue, lida, digitando e resposta do cliente, e Responder prepara o novo card. `/chat?scenario=global` simula a entrada global em uma conversa via deepLink; o botão BotoZap na sidebar abre Pendências. `host=generic` ignora a entrada/deep link OpenAI. Capturas e dois vídeos: `pnpm --filter @botozap/mcp exec node scripts/screenshot-3b.mjs`; axe A/AA, overflow e geometria do rodapé global são verificados no script.
