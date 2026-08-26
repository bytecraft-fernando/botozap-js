# @botozap/mcp

Servidor **MCP (Model Context Protocol)** para a API pública do **BotoZap** — a
plataforma dev-first sobre a WhatsApp Cloud API oficial (multi-tenant, a "Kapso
brasileira").

Ele expõe as operações da plataforma (`/api/v1`) como **ferramentas MCP** e o
stream durável de Eventos como **resource assinável**, para que assistentes como
**Claude Code**, **Cursor** e **Codex** consigam operar o canal e receber um
sinal de baixa latência quando o WhatsApp mudar.

Cada ferramenta MCP mapeia para uma operação do SDK oficial **`@botozap/sdk`**
(que autentica com a sua chave `bz_...`, monta a requisição e trata o envelope de
erro). É uma ponte fina: valida os argumentos e resultados (zod), delega ao SDK
e devolve o JSON da API.

Todas as tools anunciam `outputSchema` e devolvem o resultado em
`structuredContent`, além do `content[].text` em JSON mantido para clientes
antigos. Isso inclui paginação por cursor/offset, operações de gestão e os
`DELETE` sem corpo — estes preservam `null` no texto legado e devolvem
`{ success: true }` na saída estruturada. Erros preservam `isError` e também
expõem `{ error: { code, message, status } }` em `structuredContent`, sem
credenciais.

> **Status: preview público `0.x`.** Sem promessa de estabilidade de tools e
> argumentos até a `1.0`; fixe a versão para integrações reproduzíveis.

## Requisitos

- **Node.js ≥ 20.19** (ESM).
- Uma chave de API do BotoZap (gere em **/chaves** no painel).
- **pnpm** (este monorepo usa pnpm exclusivamente).

## Instalação

O pacote pode ser executado diretamente do npm:

```bash
pnpm dlx @botozap/mcp@0.1.0
```

Para desenvolver o monorepo localmente:

```bash
pnpm install
pnpm build
pnpm --filter @botozap/mcp smoke
pnpm --filter @botozap/mcp test
```

## Configuração (variáveis de ambiente)

| Variável | Quando | Default | Descrição |
| --- | --- | --- | --- |
| `BOTOZAP_API_KEY` | Obrigatória em stdio | — | Chave `bz_...` usada pelo processo stdio. |
| `BOTOZAP_API_URL` | Opcional | `https://botozap.com.br/api/v1` | Base da API (útil para staging/local). |
| `BOTOZAP_MCP_TRANSPORT` | Remoto | `stdio` | Use `streamable-http` para iniciar o endpoint remoto. |
| `BOTOZAP_MCP_HOST` | Remoto | `127.0.0.1` | Interface TCP do endpoint remoto. |
| `BOTOZAP_MCP_PORT` | Remoto | `3001` | Porta do endpoint remoto (`0` escolhe uma porta livre). |
| `BOTOZAP_EVENT_BUS_DATABASE_URL` | Obrigatória no remoto | — | Conexão PostgreSQL de sessão que suporta `LISTEN/NOTIFY`. |

Sem a configuração obrigatória do transporte escolhido, o servidor falha
imediatamente com uma mensagem clara e sem imprimir o valor recebido.

### Streamable HTTP (operador da plataforma)

O mesmo binário pode manter sessões remotas stateful em `/mcp`. Nesse modo cada
cliente envia sua própria chave BotoZap no header `Authorization: Bearer`; a
sessão fica vinculada a essa credencial e a Conta/ambiente continuam derivados
pela API. A chave nunca entra na URL do endpoint, URI do resource ou
notification.

```bash
BOTOZAP_MCP_TRANSPORT=streamable-http \
BOTOZAP_MCP_HOST=0.0.0.0 \
BOTOZAP_MCP_PORT=3001 \
BOTOZAP_EVENT_BUS_DATABASE_URL=postgresql://... \
pnpm dlx @botozap/mcp@0.1.0
```

Use uma conexão PostgreSQL persistente/direta ou pooler em modo de sessão;
pooler em modo de transação não preserva `LISTEN`. O bus carrega somente um
sinal vazio. Ao recebê-lo, cada sessão consulta `/events` com sua própria chave
e só envia `notifications/resources/updated` se houver Evento no cursor
autorizado. O payload autoritativo permanece no stream durável.

## Usar com Claude Code

Via CLI:

```bash
claude mcp add botozap \
  --env BOTOZAP_API_KEY=bz_live_suachaveaqui \
  -- pnpm dlx @botozap/mcp@0.1.0
```

Ou no JSON do MCP (`.mcp.json` do projeto ou config do usuário):

```json
{
  "mcpServers": {
    "botozap": {
      "command": "pnpm",
      "args": ["dlx", "@botozap/mcp@0.1.0"],
      "env": {
        "BOTOZAP_API_KEY": "bz_live_suachaveaqui"
      }
    }
  }
}
```

## Usar com Cursor

Edite `~/.cursor/mcp.json` (global) ou `.cursor/mcp.json` (no projeto):

```json
{
  "mcpServers": {
    "botozap": {
      "command": "pnpm",
      "args": ["dlx", "@botozap/mcp@0.1.0"],
      "env": {
        "BOTOZAP_API_KEY": "bz_live_suachaveaqui"
      }
    }
  }
}
```

## Ferramentas disponíveis

Transportes: **stdio** (padrão, local) e **Streamable HTTP** (remoto stateful).
Nomes em inglês (snake_case, melhor para tool-calling); descrições em PT-BR.

**Mensagens** — `send_message`, `list_messages`, `get_message`
**Conversas** — `reply_to_conversation`, `list_conversations`, `get_conversation`, `update_conversation`
**Contatos** — `list_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact`
**Mídia** — `send_media_message`, `ingest_media`
**Clientes** — `list_customers`, `get_customer`, `create_customer`, `update_customer`, `delete_customer`
**Links de setup** — `list_setup_links`, `create_setup_link`, `update_setup_link`
**Números** — `list_phone_numbers`, `get_phone_number`, `phone_number_health`
**Templates** — `list_templates`, `get_template`, `create_template`
**Webhooks** — `list_webhooks`, `get_webhook`, `create_webhook`, `update_webhook`, `delete_webhook`, `test_webhook`
**Entregas de webhook** — `list_webhook_deliveries`
**Logs** — `list_api_logs`
**Usuários** — `list_users`

## Resource de Eventos

Os dois transportes anunciam `resources.subscribe` e o template
`botozap://events{?after,limit}`. Um cliente persistente pode assinar, por
exemplo, `botozap://events?after=42&limit=100` e receber
`notifications/resources/updated` quando existir um Evento posterior ao cursor
42. O tail da API existe somente enquanto há assinatura ativa; clientes que usam
apenas tools não iniciam consultas de Eventos. A chave usada pelo servidor
precisa incluir o escopo `events:read`.

A notification é deliberadamente só um sinal e não carrega mensagem, Contato
ou credencial. Ao recebê-la, releia o mesmo resource, processe `data` e persista
`paging.cursor`. Depois de uma desconexão, leia ou assine uma nova URI com esse
cursor em `after` para recuperar o intervalo autoritativo. Notifications são
hints e podem se repetir; deduplique por `event.id` ou pela identidade estável
do Evento.

No stdio, o tail usa intervalo padrão de 1,5 segundo e para no `unsubscribe` ou
no fim da sessão. No remoto, o PostgreSQL acorda o processo MCP mesmo quando o
Evento foi persistido por outra instância; a consulta escopada continua sendo a
fonte do payload. Receber a notification não significa que todo host inicia
automaticamente uma nova execução do agente.

Em caso de erro da API, a ferramenta devolve um resultado de erro (`isError`) com
a mensagem PT-BR do envelope `{ error: { code, message } }` no formato
`Erro [code]: message`. `code`, `message` e o status HTTP também ficam
disponíveis de forma programática em todas as tools.

## Chaves de sandbox

Uma chave de **sandbox** (prefixo `bz_sandbox_`) habilita as ferramentas de
mensagem (`send_message`, `send_media_message`, `list_messages` e `get_message`) e o resource de
Eventos do próprio Sandbox. Qualquer outra ferramenta responde
`403 sandbox_forbidden` (vindo da API) — útil para testar a integração sem tocar
dados reais.

**Números mágicos** (destinatários simulados, sem custo, sem número real):

| `to`             | Comportamento simulado                                  |
| ---------------- | ------------------------------------------------------- |
| `+5500000000001` | happy path: `sent → delivered → read`, janela sempre aberta |
| `+5500000000002` | falha: `sent → failed` (erro Meta `131026`)             |
| `+5500000000003` | `sent → delivered` + resposta inbound simulada (abre a janela de 24h) |

### Smokes de sandbox

Há dois smokes, com propósitos distintos:

- **Hermético (roda no `test`, CI):** `tests/sandbox-smoke.test.ts` usa um
  `fetch` stub fiel ao contrato do sandbox — não precisa de credencial nem rede.
  Verifica que o texto (acento + emoji) sobrevive intacto, que a chave vira
  `Authorization: Bearer`, que a resposta (`sandbox: true` + `wamid.sandbox.<...>`)
  chega ao agente, e que **a chave nunca aparece** no resultado.

- **Externo (manual, exige credencial):** `pnpm --filter @botozap/mcp smoke:sandbox`
  bate na API real. Exige `dist/` compilado (`pnpm --filter @botozap/mcp build`
  antes) e as variáveis `BOTOZAP_API_KEY` (uma chave **`bz_sandbox_`**) e
  `BOTOZAP_API_URL`. Recusa qualquer chave que não seja sandbox e **nunca imprime
  a chave** (redação defensiva em toda saída, inclusive erros). **Nunca** entra no
  `test` — não roda em PR/fork, que não têm credencial.

  ```bash
  pnpm --filter @botozap/mcp build
  BOTOZAP_API_KEY=bz_sandbox_suachave BOTOZAP_API_URL=https://.../api/v1 \
    pnpm --filter @botozap/mcp smoke:sandbox
  ```

## Segurança

A conta é sempre derivada da chave de API no servidor do BotoZap (multi-tenant,
IDOR-safe). A chave é um segredo — não a comite nem a logue. O servidor MCP só
escreve logs em **stderr** (stdout é reservado para o protocolo MCP); a chave
nunca aparece em resultado de ferramenta nem em mensagem de erro.
