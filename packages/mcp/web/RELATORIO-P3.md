# P3 — Caixa de entrada do agente

Base: `origin/main` em `cedc4efbd810b93d8e87f47a8d386e5d8012fb52`. Branch: `fix/mcp-agent-inbox-p3`. Sem deploy, publicação npm ou alteração do app.

## Contrato real e causas

Leitura do app em `/Users/fernando/Desenvolvimento/bytecraft/botozap`:

- `src/app/api/v1/messages/route.ts:1678–1693,1764–1766,1786–1802`: `conversation_id`, `direction=inbound`, `sort=created_at` e `limit=1` são parâmetros reais; a ordenação é descendente. A consulta anterior já era válida. A causa da prévia ausente era a extração: `messages/serialize.ts:121–145` conserva `content`, e a criação de texto em `messages/route.ts:519` grava `content.body`, sem o objeto `content.text.body` que a tela esperava.
- `src/lib/ai/agents/api.ts:31` e rotas `ai/alerts`, `ai/cases`, `ai/usage`: a API exige um UUID de negócio. O parâmetro opcional pertence à tool, que enumera `/v1/customers` e executa leituras autorizadas por negócio; não omite o ID nas requisições à API. A enumeração e as listas de alertas, casos e conversas percorrem a paginação real.
- `src/lib/ai/cases/index.ts:13,24,27`: estados de alerta `open`, `acknowledged`, `resolved`; os dois primeiros permanecem na caixa de entrada.
- `src/lib/ai/execution/engine.ts:53` inclui códigos de segurança no detalhe; `src/lib/ai/guardrails/manipulation.ts:23–38` define os motivos. A apresentação agora traduz os motivos conhecidos e usa texto genérico para desconhecidos, sem imprimir detalhe técnico do servidor.
- A resposta de uso vem em `data`; a tool desembrulha esse envelope. A tela usa “Nenhum cliente atendido hoje”, singular ou plural, sem identificador de fuso. Para vários negócios, omite a métrica diária: somar contatos únicos por negócio produziria uma contagem potencialmente duplicada.

## Correções

`open_agent_cases` aceita omitir `customer_id` e agrega os negócios autorizados; cada linha exibe o negócio quando há mais de um. Descrição e guidance orientam chamar diretamente para pedidos de ajuda da IA e usar `list_customers`, sem UI, se for necessário descobrir IDs. A política inclui `customers:read` e a rota GET `/v1/customers`, preservando a autorização por identidade; o catálogo sem UI continua compatível.

Um contrato puro compartilhado pelo resultado e pela interface extrai texto, caption e formas legadas, além de rotular áudio, imagem, documento, mensagem sem texto e mensagem removida. Tanto a revisão de casos quanto o painel compartilhado usam esse contrato, evitando balões vazios. Quando uma leitura de prévia não é permitida ou falha, a tela não inventa conteúdo.

Alertas, pausas e casos da mesma `conversation_id` formam uma linha, conservando marcações, evidências, negócio e ações. Alertas sem conversa continuam sendo itens independentes. O contador principal usa itens únicos; o resumo para o modelo mantém também contagens separadas por categoria, status e severidade e explica que não devem ser somadas. Críticos aparecem primeiro. Revisar abre o histórico/compositor existente; envio e retomada continuam exigindo confirmação explícita.

## Verificação

- Fixtures de mensagens geradas executando as funções reais `serializeMessage`, `serializeChannelAccount`, `channelOf` e `channelFields`, com hashes SHA-256 dos fontes em `tests/fixtures/app-messages.ts`. Regeneração offline: `pnpm --filter @botozap/mcp exec node scripts/capture-message-contract.mjs /Users/fernando/Desenvolvimento/bytecraft/botozap`.
- Testes de tool via MCP cobrem ID opcional, um/vários negócios, descoberta paginada somente leitura, consulta real de mensagens e resumo; testes de apresentação cobrem tipos de mensagem, códigos traduzidos, agrupamento, métricas 0/1/N, negócios por linha e ausência de balão vazio.
- `pnpm build`, `pnpm typecheck`, `pnpm test` (607 testes: SDK 176, CLI 105, MCP 326), `pnpm gate:tarballs`, guarda HTTP do CI e `git diff --check`: verdes.
- Cenário `cases-p3`: alerta crítico reconhecido + oito conversas pausadas + zero casos, com a conversa do alerta também pausada. Resultado: oito itens únicos. Vinte capturas: inline com moldura do host, fullscreen, revisão, confirmação de retomada e retomada concluída; desktop/mobile, claro/escuro. `screenshots/validation-p3.json`: axe A/AA zero, sem overflow, sem card vazio e sem borda dupla inline. Asserções adicionais verificam ausência de balão vazio, códigos técnicos e fuso na apresentação.
- Capturas: `screenshots/p3-p3-*.png`; simulador existente em `http://127.0.0.1:4174/chat`.

## Após merge

Ainda é necessário validar a conta piloto no ChatGPT real depois do deploy pelo responsável; este trabalho não fez deploy. A sessão precisa permitir `customers:read` para a descoberta autorizada dos negócios; se o grant não tiver esse escopo, a autorização deve ser atualizada pelo fluxo existente.
