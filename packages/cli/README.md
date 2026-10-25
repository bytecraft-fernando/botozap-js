# @botozap/cli

CLI dev-first para a **API pública do BotoZap** — a plataforma multi-tenant sobre a
WhatsApp Cloud API oficial, também com o Instagram. Envie mensagens, gerencie contatos,
clientes, números, templates e webhooks direto do terminal ou de scripts.

A CLI é uma casca fina sobre o SDK oficial [`@botozap/sdk`](../sdk) — toda chamada de
rede passa por ele.

> Requer **Node ≥ 22.12**. Projeto usa **pnpm** (nunca npm/npx/yarn/bun).

> **Status: preview `0.x`.** Sem promessa de
> estabilidade de comandos/flags até a `1.0`. A [API REST](https://botozap.com.br/docs)
> é a interface oficial e estável — se algo faltar na CLI, chame
> `https://botozap.com.br/api/v1` direto (`curl` + `Authorization: Bearer`).
> A CLI cobre hoje um SUBCONJUNTO da API: transmissões (`broadcasts`) existem
> no SDK/REST, mas ainda não têm comando. Bugs:
> [issues do monorepo](https://github.com/bytecraft-fernando/botozap-js/issues)
> — nunca inclua sua chave de API no relato.

## Instalação

Instalação global com pnpm:

```bash
pnpm add --global @botozap/cli
botozap --version
```

Para experimentar sem instalar globalmente:

```bash
pnpm dlx @botozap/cli --help
```

## Autenticação

A CLI fala com `/api/v1` autenticando com o header `Authorization: Bearer bz_live_…`
(herdado do SDK). O servidor também aceita o legado `X-API-Key`, mas a CLI agora envia
**Bearer**. A chave é criada no painel do BotoZap, em **/chaves**.

A chave (e a URL base) são resolvidas nesta **ordem de prioridade**:

| Item     | 1º (maior)        | 2º                   | 3º                          | padrão                          |
| -------- | ----------------- | -------------------- | --------------------------- | ------------------------------- |
| API key  | `--api-key`       | `BOTOZAP_API_KEY`    | `~/.botozap/cli/config.json`| —                               |
| URL base | `--api-url`       | `BOTOZAP_API_URL`    | `~/.botozap/cli/config.json`| `https://botozap.com.br/api/v1` |

O `config.json` fica em `~/.botozap/cli/`; para usar outro diretório, defina
`BOTOZAP_CONFIG_DIR` (ex.: `BOTOZAP_CONFIG_DIR=/caminho/do/config botozap login`).

> **Segurança:** prefira `BOTOZAP_API_KEY` (env) ou `botozap login` a passar
> `--api-key` na linha de comando — argumentos de CLI ficam no histórico do shell
> e visíveis em `ps`/argv. A flag existe para conveniência e CI, mas trata a chave
> como segredo em argv. O `config.json` é gravado com permissão `0600` (diretório `0700`).

### Gravando a chave

```bash
# stub amigável: explica /chaves e oferece colar a chave
botozap login

# sem perguntar (CI); a chave fica no histórico do shell
botozap login --api-key bz_live_xxxxxxxxxxxx

# direto
botozap config set apiKey bz_live_xxxxxxxxxxxx
botozap config set baseUrl https://botozap.com.br/api/v1

botozap config get     # mostra config (apiKey mascarada)
botozap config path    # caminho do config.json
```

> **`botozap login` é um stub.** O BotoZap ainda não tem login OAuth por navegador;
> o comando apenas instrui a criar a chave em `/chaves` e grava
> a chave colada no config local.

### Verificando

```bash
botozap status
# Autenticado. Conta acessível.
# URL base       https://botozap.com.br/api/v1
# Origem da chave config
# Números        3
```

## Saída: humano vs. JSON

Por padrão a saída é **humana** (tabelas/linhas compactas). Para scripts, use
`-o json` (ou `--output json`), que imprime o JSON **cru** da resposta:

```bash
botozap messages list -o json | jq '.data[].id'
```

> **Listas** preservam o envelope da API (`{ data, paging }` por cursor, `{ data, meta }`
> por offset). **Itens** (`get`, `create`, `update`, `media ingest`, `webhooks test`, `deliveries replay`)
> saem **desembrulhados** — o objeto direto, sem a chave `data` em volta — porque os
> métodos de item do SDK já entregam a entidade. `messages send` sempre respondeu o
> objeto direto (a rota `POST /messages` não usa envelope).

## Comandos

```
botozap messages      send | send-media | send-interactive | send-location | react | list | get
botozap conversations list | get | update | typing | read | request-consent | delete
botozap contacts      list | get | create | update | delete | consents | record-consent
botozap media         ingest
botozap customers     list | get | create | update | delete
botozap setup-links   list | create | update      (--customer <id>)
botozap numbers       list | get | update | health
botozap numbers profile get | update | photo        (perfil do WhatsApp)
botozap numbers prompts get | update | clear        (perguntas prontas e comandos)
botozap numbers qr      list | create | get | update | delete
botozap numbers blocked list | block | unblock
botozap numbers history-import get | set          (conversas antigas do app, coexistência)
botozap channel-accounts list | get
botozap channel-accounts comment-ai get | set | runs   (Instagram)
botozap channel-accounts comment-rules list | get | create | update | delete | metrics   (Instagram)
botozap channel-accounts message-rules list | get | create | update | delete   (Instagram)
botozap channel-accounts messenger-profile get | update | delete | sync   (Instagram)
botozap templates     list | get | create | update
botozap webhooks      list | get | create | update | delete | test
botozap deliveries    list | replay                 (webhook_deliveries)
botozap logs          list                          (api_logs)
botozap users         list
botozap usage         meta-costs                    (custo aproximado da Meta)
botozap billing       (plano, slots e garantia) | slots create | slots cancel
botozap exports       create | list | get           (exportação de dados da Conta)
botozap team-events   list                          (registro de atividades; só Administrador)
botozap config        set | get | path
botozap login
botozap status
```

### Flags globais

- `--api-key <chave>` / `--api-url <url>` — sobrepõem env e config.
- `-o, --output <human|json>` — formato de saída (padrão `human`).
- Listas por **cursor**: `--limit`, `--after`, `--before`.
- Listas por **offset**: `--page`, `--per-page`.

### Exemplos

```bash
# Enviar texto simples
botozap messages send --to 5511999999999 --text "Olá do BotoZap!"

# Enviar payload completo (template, mídia, etc.) via arquivo ou stdin
botozap messages send --input ./mensagem.json
cat ./mensagem.json | botozap messages send --stdin

# Repetir sem mandar em dobro: a mesma chave com o mesmo corpo devolve a
# resposta original. Derive a chave do evento, não gere uma nova a cada chamada.
# Vale em send, send-media, send-interactive, send-location e react.
botozap messages send --input ./entrega.json --idempotency-key entrega-123-2026-10-20

# Botões/lista/link (objeto interactive da Cloud API), localização e reação
botozap messages send-interactive --to 5511999999999 --input ./botoes.json
botozap messages send-location --to 5511999999999 --latitude -3.119 --longitude -60.0217 --name "Loja"
botozap messages react --to 5511999999999 --message-id <uuid-ou-wamid> --emoji 👍
botozap messages react --to 5511999999999 --message-id <uuid-ou-wamid> --remove

# Mídia por link (WhatsApp ou Instagram; o Instagram não aceita --caption)
botozap messages send-media --to 5511999999999 --type image --link https://exemplo.com/foto.jpg --caption "Seu pedido"

# Instagram: --to é o IGSID do contato; --from aceita o id da conta na Meta ou o
# UUID da Conta de canal. O recibo traz wamid null e o mid em external_id.
botozap messages send --to 17841400000000123 --text "Tenho estes horários:" \
  --quick-reply "9h=sabado_09" --quick-reply "10h30=sabado_1030"
botozap messages send-media --to 17841400000000123 --type image --link https://exemplo.com/foto.jpg
botozap messages react --to 17841400000000123 --message-id <mid> --emoji ❤️
# Opções de resposta: só Instagram, só com --text, até 13 (título ≤ 20 caracteres),
# dentro da janela de 24h. Formato completo (content_type user_email/user_phone_number):
botozap messages send --to 17841400000000123 --text "Qual seu e-mail?" \
  --quick-replies-json '[{"content_type":"user_email"}]'

# Contas de canal e conversas de uma origem
botozap channel-accounts list --channel instagram   # coluna TOKEN: saúde da conexão
botozap conversations list --channel instagram --channel-account-id <uuid>

# Regras de comentário do Instagram (comment-rules:read / comment-rules:write)
botozap channel-accounts comment-rules list <conta>
botozap channel-accounts comment-rules create <conta> --keyword preço --dm-text "Te mandei os valores!" --reply-text "Te chamei no direct!"
botozap channel-accounts comment-rules update <conta> <regra> --active false
botozap channel-accounts comment-rules delete <conta> <regra>

# Listas JSON preservam frases; [] limpa. next-post true aguarda o próximo post.
botozap channel-accounts comment-rules create <conta> --dm-text "Oi!" \
  --keywords '["preço","valor"]' --excluded-keywords '["não quero"]' \
  --reply-variations '["Te chamei!","Veja o direct!"]' --next-post true
botozap channel-accounts comment-rules update <conta> <regra> --keywords '[]' --next-post false

# Instagram: interactive button (web_url/postback) ou generic (1–10 cards)
botozap messages send-interactive --to 17841400000000123 --from <conta> --input ./cards.json
cat cards.json | botozap messages send-interactive --to 17841400000000123 --from <conta> --stdin
# --tag human_agent é opcional, sujeito à flag e janela da API.

# Perguntas e menu (messenger-profile:read/write; sem sandbox)
botozap channel-accounts messenger-profile get --channel-account-id <conta>
botozap channel-accounts messenger-profile update --channel-account-id <conta> \
  --json '{"ice_breakers":[{"question":"Horários?","payload":"horarios"}]}'
botozap channel-accounts messenger-profile update --channel-account-id <conta> --input ./perfil.json
cat perfil.json | botozap channel-accounts messenger-profile update --channel-account-id <conta> --stdin
# PATCH: ausente preserva; null ou [] remove a seção.
botozap channel-accounts messenger-profile update --channel-account-id <conta> --json '{"persistent_menu":null}'
botozap channel-accounts messenger-profile sync --channel-account-id <conta>
botozap channel-accounts messenger-profile delete --channel-account-id <conta>

# Listar mensagens com filtro e paginação por cursor (coluna ORIGEM = source)
botozap messages list --direction inbound --limit 20
botozap messages list --after <cursor>
botozap messages list --sort event_at   # ordem real; reuse o cursor com o mesmo --sort

# Webhook com a categoria opt-in de mensagens do app (coexistência)
botozap webhooks create --url https://exemplo.com/hook --events messages,app_messages

# Encerrar uma conversa
botozap conversations update <id> --status ended

# Criar contato (display_name = nome dado pela empresa; o profile_name vem do canal)
botozap contacts create --wa-id 5511999999999 --display-name "Maria (loja centro)"
botozap contacts update <id> --clear-display-name

# Consentimento. Pedido na conversa (botões no WhatsApp, respostas rápidas no
# Instagram; só com a janela de 24h aberta: outside_window ou window_closed):
botozap conversations request-consent <id> --purpose marketing
# Consentimentos do contato (vigente e histórico) e registro de um novo (origem api).
# Sobre uma recusa do contato: consent_opted_out (409), nada é gravado.
botozap contacts consents <id>
botozap contacts record-consent <id> --channel whatsapp --purpose marketing --state granted --evidence "site"
# Palavras de saída/volta e textos de confirmação do Cliente (sem lista padrão):
botozap customers update <id> --opt-out-keyword sair --opt-out-keyword parar \
  --opt-in-keyword voltar --opt-out-confirmation "Pronto, sem mais mensagens."
# Botões de resposta rápida do template que são de saída (o toque grava a recusa):
botozap templates update <id> --opt-out-button "Sair"
# Excluir conversa: SEM VOLTA (mensagens, notas, vínculos e mídia; o contato fica).
# Só Administrador; pede confirmação (use --yes fora de um terminal).
botozap conversations delete <id>

# "Digitando…" enquanto prepara a resposta (só com mensagem recebida e janela aberta;
# repetir em menos de 20 s não chama a Meta de novo) e marcar como lida (tiques azuis):
botozap conversations typing <id>
botozap conversations read <id>

# Responder citando uma mensagem da conversa (UUID ou wamid/mid; não vale em react)
botozap messages send --to 5511999999999 --text "Combinado!" --reply-to <message_id>
# Mensagem de voz (só audio, WhatsApp; arquivo .ogg com Opus mono)
botozap messages send-media --to 5511999999999 --type audio --link https://cdn.exemplo.com/oi.ogg --voice

# Modelos prontos de Régua (os mesmos da galeria de Automações) e ligar um no Cliente
botozap journeys catalog
botozap journeys enable-model boas_vindas --customer-id <id> [--phone-number-id <id>]

# Diagnóstico do agente de IA (o mesmo do painel; só lê, sem custo)
botozap ai agents diagnostic --input-file diag.json   # {"customer_id":"…","id":"…"}

# Configurações do número do WhatsApp (direto na Meta; sem sandbox)
botozap numbers profile get <id>
botozap numbers profile update <id> --about "Atendemos de segunda a sábado" --website https://loja.com.br
botozap numbers profile photo <id> logo.png      # JPG ou PNG até 4 MB
botozap numbers prompts update <id> --prompt "Ver horários" --command "cardapio=Receber o cardápio"
botozap numbers qr create <id> --message "Oi! Vi o cartaz na loja." --format SVG
botozap numbers qr delete <id> <code>            # sem volta; pede confirmação (--yes)
botozap numbers blocked block <id> --contact-id <uuid>   # só quem escreveu nas últimas 24 h
botozap numbers blocked unblock <id> <wa_id>

# Conversas antigas do app WhatsApp Business (número em coexistência, logo depois de conectar)
botozap numbers history-import get <id>
botozap numbers history-import set <id> --days 180   # 0, 30 ou 180; uma vez por conexão

# Exportação de dados (exports:read / exports:write) e registro de atividades (team:read)
botozap exports create --customer-id <id> --format csv
botozap exports get <exportId>
botozap team-events list --action export.requested --since 2026-10-01

# Ingerir mídia por URL (WhatsApp: sobe para a Meta pelo Número; não envia mensagem)
botozap media ingest --phone-number-id <id> --source https://exemplo.com/foto.jpg

# Clientes (offset). A coluna SUSPENSO marca o Cliente acima do teto do Free
# (1 negócio): recebe, mas não envia (402 free_cap). No Free, criar o 2º Cliente
# também responde 402 free_cap.
botozap customers list --page 1 --per-page 25
botozap customers create --name "Acme LTDA" --external-customer-id acme-001

# Setup links de um cliente
botozap setup-links list --customer <customerId>
botozap setup-links create --customer <customerId> \
  --success-redirect-url "https://seu-app.com/whatsapp/ok" \
  --failure-redirect-url "https://seu-app.com/whatsapp/erro"
# Redirects só em estado final: concluído → success (status=completed); link
# esgotado → failure (status=failed); cliente volta num erro recuperável →
# failure (status=cancelled, o link segue válido). Todo destino recebe
# setup_link_id; URLs https, sem usuário/senha, até 2048 caracteres.

# Link do Instagram (um canal por link; padrão whatsapp). O cliente confirma que
# a conta é profissional e que as mensagens estão liberadas e entra com o
# Instagram. --connection-types não vale aqui (422 invalid_connection_types).
botozap setup-links create --customer <customerId> --channel instagram \
  --success-redirect-url "https://seu-app.com/instagram/ok"

# Números, rótulo local e saúde. A coluna SUSPENSO marca o número acima do teto
# do Free (1 número), ou de um Cliente suspenso: recebe, mas não envia
# (402 free_number_cap ou free_cap). Assine ou desconecte o outro número.
botozap numbers list
botozap numbers update <id> --label "Recepção"   # --clear-label remove
botozap numbers health <phoneNumberId>

# Custo aproximado da Meta (custo ausente aparece como "indisponível", nunca 0)
botozap usage meta-costs --customer-id <customerId> --from 2026-09-01 --to 2026-09-25

# Plano e slots adicionais (só chave de API; scopes billing:read / billing:write).
# O plano pago inclui 1 negócio; cada negócio a mais ocupa um slot de R$ 47/mês.
botozap billing
# Compra um slot vazio (gera cobrança). A mesma --idempotency-key devolve o mesmo
# slot em vez de comprar outro. Recusas: plan_required (assine o plano),
# slot_limit (pague uma fatura em aberto), billing_customer_required (fale com o suporte).
botozap billing slots create --idempotency-key compra-2026-10-17
# Cancela um slot vazio, sem reembolso (ocupado: slot_in_use, desconecte o negócio antes).
botozap billing slots cancel <slotId>

# Templates (componentes via arquivo JSON)
botozap templates create --name boas_vindas --language pt_BR \
  --category UTILITY --components ./components.json

# Webhooks (eventos válidos: messages, statuses, crm, account, app_messages (opt-in); secret: 16–256 caracteres)
botozap webhooks create --url https://meu.app/webhook \
  --events messages,statuses --secret troque-por-um-segredo-longo
# Só entregas de um cliente; --clear-customer volta a receber de toda a conta
botozap webhooks update <id> --customer-id <customerId>
# Só eventos de alguns canais (ids de `channel-accounts list`, 1 a 100;
# repetível ou separado por vírgula). Omitido no create = todos os canais.
botozap webhooks create --url https://meu.app/webhook --events messages \
  --channel-account-id <canalA> --channel-account-id <canalB>
botozap webhooks update <id> --channel-account-id <canalA>,<canalB>   # substitui a lista
botozap webhooks update <id> --all-channels                           # volta a todos
# get mostra os canais (todos | lista | nenhum) e a saúde por canal: só canais
# com falha, com falhas seguidas, próxima tentativa e pausa. Um canal pausado
# (15ª falha) não para os outros; health_status do webhook resume o pior canal.
# Na listagem, CANAIS e SAÚDE ("degraded (1 canal com falha)").
botozap webhooks get <id>
botozap webhooks test <id>

# Entregas e logs
botozap deliveries list --status failed
botozap deliveries list --status failed --channel-account-id <id-do-canal>
# reenvia uma entrega esgotada (exhausted) ou cortada pelo limite (limited), como o Reenviar do painel
botozap deliveries list --status exhausted
botozap deliveries replay <id-da-entrega>
botozap logs list --status-code 500
```

## Tratamento de erros

A API usa o envelope `{ "error": { "code", "message" } }`. A CLI imprime a `message`
(em PT-BR) no **stderr** e sai com **código 1**:

```
Erro [authentication_error]: Chave de API inválida ou expirada.
```

Num `429 rate_limited`, a CLI acrescenta o `Retry-After` (e `X-RateLimit-*`,
quando presentes) à mensagem — espere esse tempo antes de reenviar.

Quando a Meta recusa um envio ou pedido de consentimento, a CLI mostra o código
da Meta junto da mensagem:

```
Erro [meta_error]: <mensagem da API> — código da Meta: 131026
```

Com `-o json`, erros saem **estruturados no stderr** (stdout fica limpo para
pipes): `{ "error": { "code", "message", "status", "meta_code"?, "rate_limit"? } }`. O exit
code é **1** para qualquer erro (`0` só no sucesso) — trate classes de erro pelo
`code` do JSON, não pelo exit code.

## Estrutura

```
src/
  index.ts            # entrada (bin), parsing com commander, tratamento de erro
  client.ts           # resolve config e instancia `BotoZap` de @botozap/sdk
  config.ts           # leitura/escrita de ~/.botozap/cli/config.json + resolução
  output.ts           # formatação human/json (tabelas, detalhes, paginação)
  commands/*.ts        # um arquivo por recurso
```

## Desenvolvimento

```bash
pnpm --filter @botozap/cli typecheck   # tsc --noEmit
pnpm --filter @botozap/cli test        # vitest
pnpm --filter @botozap/cli build       # tsc -> dist/
node packages/cli/dist/index.js --help
```

## Atendimento, CRM e Agenda

Comandos: `saved-replies`, `inbox-tools`, `opportunities`, `demands`, `radar`,
`journeys`, `appointments`, `calendar`, `assignments`, `contact-stages` e
`contact-fields`. Cada subcomando mostra campos e CAS em `--help`; os campos e
filtros são lidos de `--input-file arquivo.json`. Use `-o json` para scripts.
O arquivo mantém listas, objetos, null e timestamps precisos sem escape de shell.

```sh
botozap saved-replies list --input-file filtros.json -o json
botozap opportunities create --input-file oportunidade.json -o json
botozap appointments availability --input-file disponibilidade.json -o json
```

[Contratos e exemplos dos arquivos JSON](https://github.com/bytecraft-fernando/botozap-js/blob/main/docs/attendance-release.md).

IA usa exclusivamente credenciais próprias (BYOK): SDK `client.ai`, CLI `botozap ai`
e ferramentas MCP `ai_*`. Agentes versionados, provedores, credenciais, conhecimento,
memória, skills, follow-ups e retornos prometidos, roteadores, casos, alertas,
avisos, propostas de aprendizado e comerciais, controle de acesso (elegibilidade),
inferências, promessas do operador, catálogo de modelos, execuções e uso. Scopes
`agents:read/write`; aprovação exige chave criada por
owner/admin ainda autorizado. Prévia não envia WhatsApp. Não há carteira, créditos
ou compra de vagas de IA. [Contratos e exemplos IA](https://github.com/bytecraft-fernando/botozap-js/blob/main/docs/ai.md).

## Instagram — onda 2

Regras de comentário incluem `dm_button_title`, `delivery_text` e `delivery_media`.
Regras de mensagem têm CRUD com gatilhos e ações tipados (`message-rules:read/write`);
métricas de comentário recebem `from`/`to` (`comment-rules:read`).
[Contrato e exemplos de SDK, CLI e MCP](../../docs/instagram-wave-two.md).

### Instagram: conexão, QR e seguidores

```sh
botozap channel-accounts connection get CONTA
botozap channel-accounts connection resubscribe CONTA
botozap channel-accounts connection disconnect CONTA
botozap channel-accounts message-rules qr CONTA REGRA --out campanha.png --format png
botozap channel-accounts message-rules qr CONTA REGRA --out campanha.svg --format svg
botozap channel-accounts comment-rules update CONTA REGRA --live true
botozap channel-accounts comment-rules update CONTA REGRA --require-follow true --non-follower-text 'Siga a conta e toque de novo'
botozap channel-accounts message-rules update CONTA REGRA --require-follow false --clear-non-follower-text
botozap contacts list --follows-business true
botozap conversations list --follows-business false
```

Conexão exige chave live e permissões `numbers:read`/`numbers:write`; a desconexão por OAuth acontece no painel. QR exige `message-rules:read`, `--out` e usa PNG por padrão. `--live true|false` está disponível na criação e edição de regras de comentário; sem suporte no servidor, a API retorna `422 feature_unavailable`. `--require-follow true|false`, `--non-follower-text` e `--clear-non-follower-text` estão disponíveis na criação e edição dos dois tipos de regra. Nas regras de mensagem, essas flags complementam a fonte JSON; campos duplicados entre JSON e flags são recusados. Nas de comentário, use flags de campos ou uma fonte JSON, como nos demais campos.

### IA de comentários do Instagram

```sh
botozap channel-accounts comment-ai get CONTA
botozap channel-accounts comment-ai set CONTA --enabled true --agent AGENTE --daily-limit 50
botozap channel-accounts comment-ai runs CONTA --page 1 --per-page 30 -o json
botozap channel-accounts comment-ai set CONTA --enabled false
botozap channel-accounts comment-ai set CONTA --agent null
```

Use o UUID interno da Conta de canal. GET/runs exigem `agents:read`; set exige
`agents:write` e plano com IA, exceto quando somente desliga. Sem sandbox; PATCH
no OAuth é exclusivo do painel. Ativar permite respostas públicas e DMs
automáticas. O set altera somente as flags enviadas; `--agent null` limpa a
seleção quando desligada. O limite aceita inteiros de 1 a 200 e renova no dia de
`America/Sao_Paulo`. A leitura distingue respostas confirmadas de reservas
(inclusive incertas), gate e pré-requisitos; runs inclui decisão, motivo legível
e estado dos envios.
