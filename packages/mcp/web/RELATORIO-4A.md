# UI BotoZap · rodada 4A

> Atualização visual: a [rodada 4A.2](RELATORIO-4A2.md) substitui o formulário aberto pela prévia protagonista, com edição progressiva e ajustes pela conversa. As capturas `4a2-template-*` representam a experiência atual.

PR draft: https://github.com/bytecraft-fernando/botozap-js/pull/14
Branch: `feat/mcp-ui-chatgpt`, a partir de `a883687`.

## Abrir o simulador

```sh
pnpm --filter @botozap/mcp demo:ui
# http://127.0.0.1:4173/chat
node packages/mcp/scripts/screenshot-4a.mjs
```

Seletor Host: ChatGPT / Genérico MCP Apps / Sem UI. O genérico fornece outra
paleta, fonte e variáveis padrão, sem extras OpenAI; não pretende reproduzir o
visual de um produto específico. Os iframes usam `main.ts` real e AppBridge;
fixtures, modelo, recibos e eventos ficam exclusivamente no host. Sem UI, mostra
resultados textuais e o rascunho do assistente, sem criar iframe nem usar UI tools.

Roteiros: `template` (texto + botões), `template-image`, `template-document`,
`template-video`, `template-location`, `template-auth`, `template-one-tap`,
`template-carousel`, `template-offer`, `template-catalog`,
`template-named`, `booking`, `cases`, `cases-unique`. Exemplo:
`/chat?scenario=template-document&theme=dark&host=generic`.
Para o Radar, escreva “Abra o Radar”; para o card, “Prepare uma resposta para Marina”.

## Tipos suportados × limites reais

Leitura **somente leitura** do SDK, `messages/route.ts`, builder e libs de template
do app. O app não foi editado. `components` no SDK é `unknown[]`; a API de envio
valida objetos, 20 itens e 32 KiB UTF-8 e repassa os componentes à Meta. Portanto,
aceitação estrutural na API não prova aprovação/elegibilidade no provedor.

| Tipo | Prévia / parâmetros da UI | Condições e lacunas |
|---|---|---|
| Cabeçalho texto, corpo e rodapé | Texto preenchido em bolha; rodapé próprio | Variáveis posicionais/nomeadas; HTML permanece texto |
| Corpo texto / moeda / data | Fallback legível; `text`, `currency`, `date_time` com `parameter_name` quando nomeado | Moeda ISO + `amount_1000` inteiro seguro; data usa fallback do canal |
| Imagem, vídeo, documento | Placeholder com tipo, nome/tamanho quando informados; `id` ou `link`; filename do documento | Sem upload/download/thumbnail; URL HTTPS candidata pública ou media_id numérico existente; não verifica DNS, arquivo, ownership ou existência do ID |
| Localização | Lugar/endereço em placeholder, sem carregar mapa; latitude/longitude/name/address | Coordenadas com limites; nome/endereço opcionais conforme helper atual do app |
| Quick reply | Botão visual; payload opcional (obrigatório por card no carrossel) | CTA da mensagem não é uma ação do host |
| URL dinâmica | Botão com o rótulo aprovado; parâmetros de sufixo | URL final HTTPS pública e limitada; não abre domínio externo |
| Telefone | Botão estático do catálogo | Não inventa parâmetro runtime |
| Copiar código | Botão visual; `coupon_code` | Código revisado, até 15 caracteres |
| Autenticação copiar / one-tap | Código emitido externamente no corpo e botão URL; footer do catálogo | UI não emite/valida OTP; autofill depende do app/dispositivo; API bloqueia username-only/BSUID para autenticação. Se o catálogo não contém texto canônico, a UI identifica a prévia do código como parcial no idioma do template |
| Carrossel | Bolhas/card com mídia, texto e botões; `card_index` e valores independentes | 2–10 cards, imagem/vídeo por card, rolagem somente horizontal |
| Oferta limitada | Texto da oferta, expiração e cupom/URL; `expiration_time_ms` | Só catálogo já aprovado/sincronizado; builder do app não preserva LIMITED_TIME_OFFER; snapshot do app precisa renderizar oferta/expiração para histórico fiel |
| Catálogo / ações JSON | CTA visual; `action` JSON para catálogo e tipos reconhecidos | JSON precisa ser objeto; regras comerciais/produtos e elegibilidade são do provedor. A UI não reproduz a interação após o clique do cliente |
| Schema desconhecido | Não habilita envio pela UI | Tool bruta continua com seu contrato; precisa de schema/renderer conhecido antes de oferecer na UI |

Criar ofertas limitadas e expor `parameter_format: NAMED`/preservar exemplos
nomeados exigem mudanças separadas no app (normalizer/validação/builder/snapshot). Esses recursos não foram inventados na API nem ligados
em produção. A prévia de mídia não valida conteúdo remoto, e o tamanho mostrado é
metadado de contexto, não tamanho aferido. O app não oferece tool de leitura de
metadados de mídia; adicionar isso seria trabalho separado.

A revisão relê destinatário/origem, aprovação, definição e WABA; confirma antes do
POST, guarda uma chave por intenção e não faz retry automático. Recusa confirmada
libera revisão; sem edição conserva a chave. Edição cria outra intenção. Incerto
congela campos/chave e bloqueia repetição. Aceite não afirma entrega/leitura.
Os limites de 20 componentes/32 KiB são validados antes da confirmação e do envio.

## Hosts e registro

A UI exige flag, conta selecionada (quando a lista existe), permissões e capacidade
MCP Apps negociada: `capabilities.extensions["io.modelcontextprotocol/ui"].mimeTypes`
contendo `text/html;profile=mcp-app`. Sem UI ou com flags desligadas, o catálogo é
igual ao tools-only (fixture 0.6.0 + `get_profile` e `prepare_send_intent`), inclusive
sem metadados UI nem recursos `ui://`. O initialize reavalia o registro; refresh de
identidade conserva a guarda. Capability malformada ou MIME diferente não ativa UI.

Host context/styles padrão têm prioridade sobre os tokens locais apps-sdk-ui;
botão primário usa variáveis inverse/text-inverse do host. OpenAI elicitation só
é chamada com capacidade explícita e campos compatíveis; a UI própria é fallback.
Display mode indisponível/recusado permanece inline. Sem updateModelContext, não
chama o método; sem message, orienta pedir ao assistente, sem erro não tratado.
Hints OpenAI são opcionais e ignorados pelo host genérico. Matriz detalhada em
[DESIGN.md](./DESIGN.md). Compatibilidade real com Claude, Copilot, Goose, Postman
e MCPJam depende da capacidade/versão instalada e ainda requer ensaio real;
nenhum desses produtos foi declarado validado apenas pela simulação.

## Agenda e métrica

Cabeçalho por dia (“Hoje, 30 de set.” / “Amanhã, 1 de out.”), intervalos sem data
repetida. “Com Meet” nos cards; dependência de conexão na confirmação/erro.

A tela 6 está pronta para `usage.unique_contacts_today` + `usage.timezone`
(ou ambos em `usage.handoff`). Exige inteiro não negativo e fuso IANA válido;
mostra “clientes hoje” no fuso do negócio. Sem ambos, `handoff.conversations`
permanece “conversas hoje (UTC)”. O campo ainda é provisório; a implementação da
contagem de pessoas únicas no dia civil do negócio pertence ao agente da API.

## Validação

- `pnpm build`, `pnpm typecheck`, `pnpm test` e `pnpm gate:tarballs` passaram.
- Testes: SDK 173, CLI 105, MCP 249 (527 no total), incluindo renderizadores,
  parâmetros por tipo, tamanhos/UTF-8, URLs/mídia, localização, OTP, carrossel,
  moeda/data, catálogo desconhecido, métrica, agrupamento e negociação de UI.
- Guarda HTTP do CI passou: nenhum cliente/fetch novo fora do SDK.
- Capturas 4A: 140 PNGs, axe WCAG A/AA sem violações; sem overflow horizontal do
  documento/iframe nos templates; nenhuma requisição externa nos roteiros de mídia.
- 12 vídeos de 8,2–9,0 s (desktop escuro), gravados em browser; não são renderizações
  artificiais. Capturas das rodadas anteriores também foram atualizadas.
- CSP com domínios vazios, JS/CSS empacotados, sem credenciais nem fontes externas.
- `http.ts`, get_profile/`/v1/me`, app, PiP/eventos/entrada global e produção intactos.

## Decisões pendentes

Fernando: escolher as contas do piloto e validar uma sessão real nos hosts usados;
a UI continua desligada em produção. API: fechar o nome/localização do campo de
clientes únicos + timezone e seu cálculo por dia civil. App: priorizar criação de
oferta limitada, `parameter_format: NAMED`/exemplos nomeados e snapshot de oferta. Mídia/OTP continuam recebendo dados existentes,
sem upload ou emissão de código neste escopo. Telas 5/8 são a branch paralela.

## Arquivos de evidência

Todos estão em `packages/mcp/web/screenshots/`. A lista abaixo é exata; `validation-4a.json`
contém o resultado axe de cada captura. `validation.json` e `validation-3a.json`
registram os roteiros anteriores reexecutados.

### Capturas 4A

- [`4a-booking-agrupado-desktop-dark.png`](./screenshots/4a-booking-agrupado-desktop-dark.png)
- [`4a-booking-agrupado-desktop-light.png`](./screenshots/4a-booking-agrupado-desktop-light.png)
- [`4a-booking-agrupado-mobile-dark.png`](./screenshots/4a-booking-agrupado-mobile-dark.png)
- [`4a-booking-agrupado-mobile-light.png`](./screenshots/4a-booking-agrupado-mobile-light.png)
- [`4a-booking-confirmacao-desktop-dark.png`](./screenshots/4a-booking-confirmacao-desktop-dark.png)
- [`4a-cases-agrupado-desktop-dark.png`](./screenshots/4a-cases-agrupado-desktop-dark.png)
- [`4a-cases-agrupado-desktop-light.png`](./screenshots/4a-cases-agrupado-desktop-light.png)
- [`4a-cases-agrupado-mobile-dark.png`](./screenshots/4a-cases-agrupado-mobile-dark.png)
- [`4a-cases-agrupado-mobile-light.png`](./screenshots/4a-cases-agrupado-mobile-light.png)
- [`4a-cases-unique-agrupado-desktop-dark.png`](./screenshots/4a-cases-unique-agrupado-desktop-dark.png)
- [`4a-cases-unique-agrupado-desktop-light.png`](./screenshots/4a-cases-unique-agrupado-desktop-light.png)
- [`4a-cases-unique-agrupado-mobile-dark.png`](./screenshots/4a-cases-unique-agrupado-mobile-dark.png)
- [`4a-cases-unique-agrupado-mobile-light.png`](./screenshots/4a-cases-unique-agrupado-mobile-light.png)
- [`4a-host-chatgpt-card-desktop-dark.png`](./screenshots/4a-host-chatgpt-card-desktop-dark.png)
- [`4a-host-chatgpt-card-desktop-light.png`](./screenshots/4a-host-chatgpt-card-desktop-light.png)
- [`4a-host-chatgpt-card-mobile-dark.png`](./screenshots/4a-host-chatgpt-card-mobile-dark.png)
- [`4a-host-chatgpt-card-mobile-light.png`](./screenshots/4a-host-chatgpt-card-mobile-light.png)
- [`4a-host-chatgpt-radar-desktop-dark.png`](./screenshots/4a-host-chatgpt-radar-desktop-dark.png)
- [`4a-host-chatgpt-radar-desktop-light.png`](./screenshots/4a-host-chatgpt-radar-desktop-light.png)
- [`4a-host-chatgpt-radar-mobile-dark.png`](./screenshots/4a-host-chatgpt-radar-mobile-dark.png)
- [`4a-host-chatgpt-radar-mobile-light.png`](./screenshots/4a-host-chatgpt-radar-mobile-light.png)
- [`4a-host-generic-card-desktop-dark.png`](./screenshots/4a-host-generic-card-desktop-dark.png)
- [`4a-host-generic-card-desktop-light.png`](./screenshots/4a-host-generic-card-desktop-light.png)
- [`4a-host-generic-card-mobile-dark.png`](./screenshots/4a-host-generic-card-mobile-dark.png)
- [`4a-host-generic-card-mobile-light.png`](./screenshots/4a-host-generic-card-mobile-light.png)
- [`4a-host-generic-radar-desktop-dark.png`](./screenshots/4a-host-generic-radar-desktop-dark.png)
- [`4a-host-generic-radar-desktop-light.png`](./screenshots/4a-host-generic-radar-desktop-light.png)
- [`4a-host-generic-radar-mobile-dark.png`](./screenshots/4a-host-generic-radar-mobile-dark.png)
- [`4a-host-generic-radar-mobile-light.png`](./screenshots/4a-host-generic-radar-mobile-light.png)
- [`4a-host-none-card-desktop-dark.png`](./screenshots/4a-host-none-card-desktop-dark.png)
- [`4a-host-none-card-desktop-light.png`](./screenshots/4a-host-none-card-desktop-light.png)
- [`4a-host-none-card-mobile-dark.png`](./screenshots/4a-host-none-card-mobile-dark.png)
- [`4a-host-none-card-mobile-light.png`](./screenshots/4a-host-none-card-mobile-light.png)
- [`4a-host-none-radar-desktop-dark.png`](./screenshots/4a-host-none-radar-desktop-dark.png)
- [`4a-host-none-radar-desktop-light.png`](./screenshots/4a-host-none-radar-desktop-light.png)
- [`4a-host-none-radar-mobile-dark.png`](./screenshots/4a-host-none-radar-mobile-dark.png)
- [`4a-host-none-radar-mobile-light.png`](./screenshots/4a-host-none-radar-mobile-light.png)
- [`4a-template-aceito-desktop-dark.png`](./screenshots/4a-template-aceito-desktop-dark.png)
- [`4a-template-auth-aceito-desktop-dark.png`](./screenshots/4a-template-auth-aceito-desktop-dark.png)
- [`4a-template-auth-confirmacao-desktop-dark.png`](./screenshots/4a-template-auth-confirmacao-desktop-dark.png)
- [`4a-template-auth-confirmacao-desktop-light.png`](./screenshots/4a-template-auth-confirmacao-desktop-light.png)
- [`4a-template-auth-confirmacao-mobile-dark.png`](./screenshots/4a-template-auth-confirmacao-mobile-dark.png)
- [`4a-template-auth-confirmacao-mobile-light.png`](./screenshots/4a-template-auth-confirmacao-mobile-light.png)
- [`4a-template-auth-previa-desktop-dark.png`](./screenshots/4a-template-auth-previa-desktop-dark.png)
- [`4a-template-auth-previa-desktop-light.png`](./screenshots/4a-template-auth-previa-desktop-light.png)
- [`4a-template-auth-previa-mobile-dark.png`](./screenshots/4a-template-auth-previa-mobile-dark.png)
- [`4a-template-auth-previa-mobile-light.png`](./screenshots/4a-template-auth-previa-mobile-light.png)
- [`4a-template-carousel-aceito-desktop-dark.png`](./screenshots/4a-template-carousel-aceito-desktop-dark.png)
- [`4a-template-carousel-confirmacao-desktop-dark.png`](./screenshots/4a-template-carousel-confirmacao-desktop-dark.png)
- [`4a-template-carousel-confirmacao-desktop-light.png`](./screenshots/4a-template-carousel-confirmacao-desktop-light.png)
- [`4a-template-carousel-confirmacao-mobile-dark.png`](./screenshots/4a-template-carousel-confirmacao-mobile-dark.png)
- [`4a-template-carousel-confirmacao-mobile-light.png`](./screenshots/4a-template-carousel-confirmacao-mobile-light.png)
- [`4a-template-carousel-previa-desktop-dark.png`](./screenshots/4a-template-carousel-previa-desktop-dark.png)
- [`4a-template-carousel-previa-desktop-light.png`](./screenshots/4a-template-carousel-previa-desktop-light.png)
- [`4a-template-carousel-previa-mobile-dark.png`](./screenshots/4a-template-carousel-previa-mobile-dark.png)
- [`4a-template-carousel-previa-mobile-light.png`](./screenshots/4a-template-carousel-previa-mobile-light.png)
- [`4a-template-catalog-aceito-desktop-dark.png`](./screenshots/4a-template-catalog-aceito-desktop-dark.png)
- [`4a-template-catalog-confirmacao-desktop-dark.png`](./screenshots/4a-template-catalog-confirmacao-desktop-dark.png)
- [`4a-template-catalog-confirmacao-desktop-light.png`](./screenshots/4a-template-catalog-confirmacao-desktop-light.png)
- [`4a-template-catalog-confirmacao-mobile-dark.png`](./screenshots/4a-template-catalog-confirmacao-mobile-dark.png)
- [`4a-template-catalog-confirmacao-mobile-light.png`](./screenshots/4a-template-catalog-confirmacao-mobile-light.png)
- [`4a-template-catalog-previa-desktop-dark.png`](./screenshots/4a-template-catalog-previa-desktop-dark.png)
- [`4a-template-catalog-previa-desktop-light.png`](./screenshots/4a-template-catalog-previa-desktop-light.png)
- [`4a-template-catalog-previa-mobile-dark.png`](./screenshots/4a-template-catalog-previa-mobile-dark.png)
- [`4a-template-catalog-previa-mobile-light.png`](./screenshots/4a-template-catalog-previa-mobile-light.png)
- [`4a-template-confirmacao-desktop-dark.png`](./screenshots/4a-template-confirmacao-desktop-dark.png)
- [`4a-template-confirmacao-desktop-light.png`](./screenshots/4a-template-confirmacao-desktop-light.png)
- [`4a-template-confirmacao-mobile-dark.png`](./screenshots/4a-template-confirmacao-mobile-dark.png)
- [`4a-template-confirmacao-mobile-light.png`](./screenshots/4a-template-confirmacao-mobile-light.png)
- [`4a-template-document-aceito-desktop-dark.png`](./screenshots/4a-template-document-aceito-desktop-dark.png)
- [`4a-template-document-confirmacao-desktop-dark.png`](./screenshots/4a-template-document-confirmacao-desktop-dark.png)
- [`4a-template-document-confirmacao-desktop-light.png`](./screenshots/4a-template-document-confirmacao-desktop-light.png)
- [`4a-template-document-confirmacao-mobile-dark.png`](./screenshots/4a-template-document-confirmacao-mobile-dark.png)
- [`4a-template-document-confirmacao-mobile-light.png`](./screenshots/4a-template-document-confirmacao-mobile-light.png)
- [`4a-template-document-previa-desktop-dark.png`](./screenshots/4a-template-document-previa-desktop-dark.png)
- [`4a-template-document-previa-desktop-light.png`](./screenshots/4a-template-document-previa-desktop-light.png)
- [`4a-template-document-previa-mobile-dark.png`](./screenshots/4a-template-document-previa-mobile-dark.png)
- [`4a-template-document-previa-mobile-light.png`](./screenshots/4a-template-document-previa-mobile-light.png)
- [`4a-template-image-aceito-desktop-dark.png`](./screenshots/4a-template-image-aceito-desktop-dark.png)
- [`4a-template-image-confirmacao-desktop-dark.png`](./screenshots/4a-template-image-confirmacao-desktop-dark.png)
- [`4a-template-image-confirmacao-desktop-light.png`](./screenshots/4a-template-image-confirmacao-desktop-light.png)
- [`4a-template-image-confirmacao-mobile-dark.png`](./screenshots/4a-template-image-confirmacao-mobile-dark.png)
- [`4a-template-image-confirmacao-mobile-light.png`](./screenshots/4a-template-image-confirmacao-mobile-light.png)
- [`4a-template-image-previa-desktop-dark.png`](./screenshots/4a-template-image-previa-desktop-dark.png)
- [`4a-template-image-previa-desktop-light.png`](./screenshots/4a-template-image-previa-desktop-light.png)
- [`4a-template-image-previa-mobile-dark.png`](./screenshots/4a-template-image-previa-mobile-dark.png)
- [`4a-template-image-previa-mobile-light.png`](./screenshots/4a-template-image-previa-mobile-light.png)
- [`4a-template-location-aceito-desktop-dark.png`](./screenshots/4a-template-location-aceito-desktop-dark.png)
- [`4a-template-location-confirmacao-desktop-dark.png`](./screenshots/4a-template-location-confirmacao-desktop-dark.png)
- [`4a-template-location-confirmacao-desktop-light.png`](./screenshots/4a-template-location-confirmacao-desktop-light.png)
- [`4a-template-location-confirmacao-mobile-dark.png`](./screenshots/4a-template-location-confirmacao-mobile-dark.png)
- [`4a-template-location-confirmacao-mobile-light.png`](./screenshots/4a-template-location-confirmacao-mobile-light.png)
- [`4a-template-location-previa-desktop-dark.png`](./screenshots/4a-template-location-previa-desktop-dark.png)
- [`4a-template-location-previa-desktop-light.png`](./screenshots/4a-template-location-previa-desktop-light.png)
- [`4a-template-location-previa-mobile-dark.png`](./screenshots/4a-template-location-previa-mobile-dark.png)
- [`4a-template-location-previa-mobile-light.png`](./screenshots/4a-template-location-previa-mobile-light.png)
- [`4a-template-named-aceito-desktop-dark.png`](./screenshots/4a-template-named-aceito-desktop-dark.png)
- [`4a-template-named-confirmacao-desktop-dark.png`](./screenshots/4a-template-named-confirmacao-desktop-dark.png)
- [`4a-template-named-confirmacao-desktop-light.png`](./screenshots/4a-template-named-confirmacao-desktop-light.png)
- [`4a-template-named-confirmacao-mobile-dark.png`](./screenshots/4a-template-named-confirmacao-mobile-dark.png)
- [`4a-template-named-confirmacao-mobile-light.png`](./screenshots/4a-template-named-confirmacao-mobile-light.png)
- [`4a-template-named-previa-desktop-dark.png`](./screenshots/4a-template-named-previa-desktop-dark.png)
- [`4a-template-named-previa-desktop-light.png`](./screenshots/4a-template-named-previa-desktop-light.png)
- [`4a-template-named-previa-mobile-dark.png`](./screenshots/4a-template-named-previa-mobile-dark.png)
- [`4a-template-named-previa-mobile-light.png`](./screenshots/4a-template-named-previa-mobile-light.png)
- [`4a-template-nao-suportado-desktop-dark.png`](./screenshots/4a-template-nao-suportado-desktop-dark.png)
- [`4a-template-nao-suportado-desktop-light.png`](./screenshots/4a-template-nao-suportado-desktop-light.png)
- [`4a-template-nao-suportado-mobile-dark.png`](./screenshots/4a-template-nao-suportado-mobile-dark.png)
- [`4a-template-nao-suportado-mobile-light.png`](./screenshots/4a-template-nao-suportado-mobile-light.png)
- [`4a-template-offer-aceito-desktop-dark.png`](./screenshots/4a-template-offer-aceito-desktop-dark.png)
- [`4a-template-offer-confirmacao-desktop-dark.png`](./screenshots/4a-template-offer-confirmacao-desktop-dark.png)
- [`4a-template-offer-confirmacao-desktop-light.png`](./screenshots/4a-template-offer-confirmacao-desktop-light.png)
- [`4a-template-offer-confirmacao-mobile-dark.png`](./screenshots/4a-template-offer-confirmacao-mobile-dark.png)
- [`4a-template-offer-confirmacao-mobile-light.png`](./screenshots/4a-template-offer-confirmacao-mobile-light.png)
- [`4a-template-offer-previa-desktop-dark.png`](./screenshots/4a-template-offer-previa-desktop-dark.png)
- [`4a-template-offer-previa-desktop-light.png`](./screenshots/4a-template-offer-previa-desktop-light.png)
- [`4a-template-offer-previa-mobile-dark.png`](./screenshots/4a-template-offer-previa-mobile-dark.png)
- [`4a-template-offer-previa-mobile-light.png`](./screenshots/4a-template-offer-previa-mobile-light.png)
- [`4a-template-one-tap-aceito-desktop-dark.png`](./screenshots/4a-template-one-tap-aceito-desktop-dark.png)
- [`4a-template-one-tap-confirmacao-desktop-dark.png`](./screenshots/4a-template-one-tap-confirmacao-desktop-dark.png)
- [`4a-template-one-tap-confirmacao-desktop-light.png`](./screenshots/4a-template-one-tap-confirmacao-desktop-light.png)
- [`4a-template-one-tap-confirmacao-mobile-dark.png`](./screenshots/4a-template-one-tap-confirmacao-mobile-dark.png)
- [`4a-template-one-tap-confirmacao-mobile-light.png`](./screenshots/4a-template-one-tap-confirmacao-mobile-light.png)
- [`4a-template-one-tap-previa-desktop-dark.png`](./screenshots/4a-template-one-tap-previa-desktop-dark.png)
- [`4a-template-one-tap-previa-desktop-light.png`](./screenshots/4a-template-one-tap-previa-desktop-light.png)
- [`4a-template-one-tap-previa-mobile-dark.png`](./screenshots/4a-template-one-tap-previa-mobile-dark.png)
- [`4a-template-one-tap-previa-mobile-light.png`](./screenshots/4a-template-one-tap-previa-mobile-light.png)
- [`4a-template-previa-desktop-dark.png`](./screenshots/4a-template-previa-desktop-dark.png)
- [`4a-template-previa-desktop-light.png`](./screenshots/4a-template-previa-desktop-light.png)
- [`4a-template-previa-mobile-dark.png`](./screenshots/4a-template-previa-mobile-dark.png)
- [`4a-template-previa-mobile-light.png`](./screenshots/4a-template-previa-mobile-light.png)
- [`4a-template-video-aceito-desktop-dark.png`](./screenshots/4a-template-video-aceito-desktop-dark.png)
- [`4a-template-video-confirmacao-desktop-dark.png`](./screenshots/4a-template-video-confirmacao-desktop-dark.png)
- [`4a-template-video-confirmacao-desktop-light.png`](./screenshots/4a-template-video-confirmacao-desktop-light.png)
- [`4a-template-video-confirmacao-mobile-dark.png`](./screenshots/4a-template-video-confirmacao-mobile-dark.png)
- [`4a-template-video-confirmacao-mobile-light.png`](./screenshots/4a-template-video-confirmacao-mobile-light.png)
- [`4a-template-video-previa-desktop-dark.png`](./screenshots/4a-template-video-previa-desktop-dark.png)
- [`4a-template-video-previa-desktop-light.png`](./screenshots/4a-template-video-previa-desktop-light.png)
- [`4a-template-video-previa-mobile-dark.png`](./screenshots/4a-template-video-previa-mobile-dark.png)
- [`4a-template-video-previa-mobile-light.png`](./screenshots/4a-template-video-previa-mobile-light.png)

### Vídeos 4A

- [`roteiro-4a-booking-desktop-dark.webm`](./screenshots/roteiro-4a-booking-desktop-dark.webm) · 8.24 s
- [`roteiro-4a-template-auth-desktop-dark.webm`](./screenshots/roteiro-4a-template-auth-desktop-dark.webm) · 8.72 s
- [`roteiro-4a-template-carousel-desktop-dark.webm`](./screenshots/roteiro-4a-template-carousel-desktop-dark.webm) · 8.96 s
- [`roteiro-4a-template-catalog-desktop-dark.webm`](./screenshots/roteiro-4a-template-catalog-desktop-dark.webm) · 8.72 s
- [`roteiro-4a-template-desktop-dark.webm`](./screenshots/roteiro-4a-template-desktop-dark.webm) · 8.8 s
- [`roteiro-4a-template-document-desktop-dark.webm`](./screenshots/roteiro-4a-template-document-desktop-dark.webm) · 8.84 s
- [`roteiro-4a-template-image-desktop-dark.webm`](./screenshots/roteiro-4a-template-image-desktop-dark.webm) · 8.8 s
- [`roteiro-4a-template-location-desktop-dark.webm`](./screenshots/roteiro-4a-template-location-desktop-dark.webm) · 8.8 s
- [`roteiro-4a-template-named-desktop-dark.webm`](./screenshots/roteiro-4a-template-named-desktop-dark.webm) · 8.8 s
- [`roteiro-4a-template-offer-desktop-dark.webm`](./screenshots/roteiro-4a-template-offer-desktop-dark.webm) · 8.8 s
- [`roteiro-4a-template-one-tap-desktop-dark.webm`](./screenshots/roteiro-4a-template-one-tap-desktop-dark.webm) · 8.72 s
- [`roteiro-4a-template-video-desktop-dark.webm`](./screenshots/roteiro-4a-template-video-desktop-dark.webm) · 8.84 s

## Correção: tipos removidos do produto

O botão removido não tem campos, parser de envio, prévia, roteiro nem mídia na UI.
Um template sincronizado com esse botão permanece visível no catálogo como
**Não suportado**, com a razão exigida; não abre elicitation, não prepara intenção
nem envia. A mesma guarda vale para carrossel e para alteração detectada no preflight.
Escolher outro template aprovado permite continuar a revisão.

Auditoria do restante do repositório: não há suporte explícito ativo a WhatsApp
Flows no SDK/CLI/MCP, endpoints `/v1/flows` ou escopos `flows:*`. Foram encontradas
somente referências históricas **anteriores a esta rodada**, preservadas:

- `packages/sdk/CHANGELOG.md:72`: registra a remoção de client/types/endpoints na versão anterior.
- `packages/cli/CHANGELOG.md:55`: registra que a documentação já deixou de mencionar o produto removido.

`ai/followup-flows`, `ai.followupFlows`, suas tools/rotas e tipos são réguas da IA,
não são o produto removido e permanecem intactos. O contrato preexistente de
`components: unknown[]` no SDK/tool bruta também permanece; não foi alterado fora
do escopo da UI desta branch. Novos testes cobrem a guarda específica de template.
