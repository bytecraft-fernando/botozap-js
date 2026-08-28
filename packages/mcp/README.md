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
pnpm dlx @botozap/mcp@0.2.4
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
| `BOTOZAP_MCP_ALLOWED_HOSTS` | Remoto | loopback em localhost | CSV saneado (trim, vazio descartado) dos valores de `Host` aceitos em `/mcp`. Obrigatória fora de localhost. |
| `BOTOZAP_MCP_ALLOWED_ORIGINS` | Remoto | vazio | CSV saneado das `Origin` aceitas em `/mcp` (match exato). Sem `Origin` continua aceito; `Origin` presente só passa se estiver na lista. |
| `BOTOZAP_MCP_RATE_LIMIT_PER_CLIENT` | Remoto | `120` | Requisições por minuto por cliente/IP antes da autenticação. |
| `BOTOZAP_MCP_RATE_LIMIT_GLOBAL` | Remoto | `1200` | Teto global de requisições por minuto por processo. |
| `BOTOZAP_MCP_TRUSTED_PROXY_CIDRS` | Remoto | vazio | CSV de CIDRs autorizados a alcançar `/mcp`; com Cloudflare, use somente as faixas oficiais e o rate limit passa a usar `CF-Connecting-IP`. |
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
BOTOZAP_MCP_ALLOWED_HOSTS=mcp.botozap.com.br \
BOTOZAP_EVENT_BUS_DATABASE_URL=postgresql://... \
pnpm dlx @botozap/mcp@0.2.4
```

Bind em `0.0.0.0` ou `::` sem `BOTOZAP_MCP_ALLOWED_HOSTS` recusa o boot (fail-closed). Em `127.0.0.1`/`::1`/`localhost` a allowlist padrão de loopback é aplicada e o desenvolvimento local segue igual.

Todo request a `/mcp` valida `Host` e `Origin` **antes** de Bearer e do parse do corpo, como exige o transporte Streamable HTTP (spec 2025-11-25): `Host` precisa estar na allowlist; `Origin` ausente é aceita (clientes server-to-server); `Origin` presente só passa por match exato. Desvio responde `403` JSON-RPC (`-32000`) sem autenticar.

`GET /healthz` é público, mínimo e sem segredo: responde `200` com `{"ok": true}` para readiness (Fly). Não exige Bearer, não consulta sessão e não revela estado interno — o health check interno pode usar um `Host` que não está na allowlist de `/mcp`.

Quando `BOTOZAP_MCP_TRUSTED_PROXY_CIDRS` está definida, `/mcp` exige que o
`Fly-Client-IP` pertença a uma das redes configuradas; isso bloqueia acesso
direto ao origin mesmo com `Host` forjado. Em deploy atrás da Cloudflare,
mantenha a lista sincronizada com `https://www.cloudflare.com/ips/`; somente
depois dessa validação o rate limiter confia em `CF-Connecting-IP`.

Use uma conexão PostgreSQL persistente/direta ou pooler em modo de sessão;
pooler em modo de transação não preserva `LISTEN`. O bus carrega somente um
sinal vazio. Ao recebê-lo, cada sessão consulta `/events` com sua própria chave
e só envia `notifications/resources/updated` se houver Evento no cursor
autorizado. O payload autoritativo permanece no stream durável.

Se o bus cair — inclusive durante o boot — o servidor continua disponível em
modo degradado, reconecta com backoff de 250 ms a 10 s e mantém um heartbeat de
reconciliação pelo cursor a cada 15 s. Um sinal que chega enquanto outra leitura
está em voo fica pendente para um novo probe imediato; não depende do próximo
heartbeat.

O processo mantém no máximo 1.000 sessões, 5 sessões por chave e 8 resources de
Eventos por sessão. `resources/unsubscribe` interrompe o consumo daquele
resource; `DELETE /mcp` encerra a sessão e libera listeners/timers. Uma sessão
que perde o transporte sem enviar `DELETE` é recolhida após 5 minutos sem
request ativo (varredura a cada 30 s). Esses limites são conservadores para o
preview `0.x` e podem mudar antes da `1.0`.

## Usar com Claude Code

Via CLI:

```bash
claude mcp add botozap \
  --env BOTOZAP_API_KEY=bz_live_suachaveaqui \
  -- pnpm dlx @botozap/mcp@0.2.4
```

Ou no JSON do MCP (`.mcp.json` do projeto ou config do usuário):

```json
{
  "mcpServers": {
    "botozap": {
      "command": "pnpm",
      "args": ["dlx", "@botozap/mcp@0.2.4"],
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
      "args": ["dlx", "@botozap/mcp@0.2.4"],
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
`paging.cursor`. Depois de uma desconexão, leia a partir do último cursor salvo e
drene todas as páginas de catch-up (`paging.next`). Só então assine uma nova URI
com o cursor final em `after`; o probe inicial da assinatura fecha a corrida com
um Evento persistido entre a última leitura e o subscribe. Notifications são
hints at-least-once e podem se repetir; deduplique por `event.id` antes de
produzir qualquer resposta. O mesmo Evento conserva `id`, `cursor` e identidade
de mensagem em retries e replay.

No stdio, o tail usa intervalo padrão de 1,5 segundo e para no `unsubscribe` ou
no fim da sessão. No remoto, o PostgreSQL acorda o processo MCP mesmo quando o
Evento foi persistido por outra instância; a consulta escopada continua sendo a
fonte do payload e o heartbeat cobre sinais perdidos. Receber a notification não
significa que todo host inicia automaticamente uma nova execução do agente.

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
nunca aparece em resultado de ferramenta, mensagem de erro, `/healthz` ou
resposta `403` de `Host`/`Origin`.
