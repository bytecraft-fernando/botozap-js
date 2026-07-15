# @botozap/cli

CLI dev-first para a **API pública do BotoZap** — a plataforma multi-tenant sobre a
WhatsApp Cloud API oficial (a "Kapso brasileira"). Envie mensagens, gerencie contatos,
clientes, números, templates e webhooks direto do terminal ou de scripts.

A CLI é uma casca fina sobre o SDK oficial [`@botozap/sdk`](../sdk) — toda chamada de
rede passa por ele.

> Requer **Node ≥ 20.19**. Projeto usa **pnpm** (nunca npm/npx/yarn/bun).

> **Status: preview `0.x`.** Sem promessa de
> estabilidade de comandos/flags até a `1.0`. A [API REST](https://botozap.com.br/docs)
> é a interface oficial e estável — se algo faltar na CLI, chame
> `https://botozap.com.br/api/v1` direto (`curl` + `Authorization: Bearer`).
> A CLI cobre hoje um SUBCONJUNTO da API: transmissões (`broadcasts`) e `flows`
> existem no SDK/REST, mas ainda não têm comando. Bugs:
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

> **Segurança:** prefira `BOTOZAP_API_KEY` (env) ou `botozap login` a passar
> `--api-key` na linha de comando — argumentos de CLI ficam no histórico do shell
> e visíveis em `ps`/argv. A flag existe para conveniência e CI, mas trata a chave
> como segredo em argv. O `config.json` é gravado com permissão `0600` (diretório `0700`).

### Gravando a chave

```bash
# stub amigável: explica /chaves e oferece colar a chave
botozap login

# direto
botozap config set apiKey bz_live_xxxxxxxxxxxx
botozap config set baseUrl https://botozap.com.br/api/v1

botozap config get     # mostra config (apiKey mascarada)
botozap config path    # caminho do config.json
```

> **`botozap login` é um stub.** O BotoZap ainda não tem login OAuth por navegador
> (como `kapso login`); o comando apenas instrui a criar a chave em `/chaves` e grava
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
> por offset). **Itens** (`get`, `create`, `update`, `media ingest`, `webhooks test`)
> saem **desembrulhados** — o objeto direto, sem a chave `data` em volta — porque os
> métodos de item do SDK já entregam a entidade. `messages send` sempre respondeu o
> objeto direto (a rota `POST /messages` não usa envelope).

## Comandos

```
botozap messages      send | list | get
botozap conversations list | get | update
botozap contacts      list | get | create | update | delete
botozap media         ingest
botozap customers     list | get | create | update | delete
botozap setup-links   list | create | update      (--customer <id>)
botozap numbers       list | get | health
botozap templates     list | get | create
botozap webhooks      list | get | create | update | delete | test
botozap deliveries    list                          (webhook_deliveries)
botozap logs          list                          (api_logs)
botozap users         list
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

# Listar mensagens com filtro e paginação por cursor
botozap messages list --direction inbound --limit 20
botozap messages list --after <cursor>

# Encerrar uma conversa
botozap conversations update <id> --status ended

# Criar contato
botozap contacts create --wa-id 5511999999999 --profile-name "Maria"

# Ingerir mídia por URL
botozap media ingest --phone-number-id <id> --source https://exemplo.com/foto.jpg

# Clientes (offset)
botozap customers list --page 1 --per-page 25
botozap customers create --name "Acme LTDA" --external-customer-id acme-001

# Setup links de um cliente
botozap setup-links list --customer <customerId>
botozap setup-links create --customer <customerId>

# Números e saúde
botozap numbers list
botozap numbers health <phoneNumberId>

# Templates (componentes via arquivo JSON)
botozap templates create --name boas_vindas --language pt_BR \
  --category UTILITY --components ./components.json

# Webhooks (eventos válidos: messages, statuses)
botozap webhooks create --url https://meu.app/webhook \
  --events messages,statuses --secret s3cr3t
botozap webhooks test <id>

# Entregas e logs
botozap deliveries list --status failed
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

Com `-o json`, erros saem **estruturados no stderr** (stdout fica limpo para
pipes): `{ "error": { "code", "message", "status", "rate_limit"? } }`. O exit
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
