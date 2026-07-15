# @botozap/mcp

Servidor **MCP (Model Context Protocol)** para a API pública do **BotoZap** — a
plataforma dev-first sobre a WhatsApp Cloud API oficial (multi-tenant, a "Kapso
brasileira").

Ele expõe as operações da plataforma (`/api/v1`) como **ferramentas MCP**, para
que assistentes como **Claude Code**, **Cursor** e **Codex** consigam enviar
mensagens, gerenciar contatos/clientes/números, criar templates e webhooks etc.

Cada ferramenta MCP mapeia para uma operação do SDK oficial **`@botozap/sdk`**
(que autentica com a sua chave `bz_...`, monta a requisição e trata o envelope de
erro). É uma ponte fina: valida os argumentos (zod), delega ao SDK e devolve o
JSON da API.

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

| Variável            | Obrigatória | Default                              | Descrição                                  |
| ------------------- | ----------- | ------------------------------------ | ------------------------------------------ |
| `BOTOZAP_API_KEY`   | **Sim**     | —                                    | Sua chave `bz_...` (header `Authorization: Bearer`). |
| `BOTOZAP_API_URL`   | Não         | `https://botozap.com.br/api/v1`      | Base da API (útil para staging/local).      |

Sem `BOTOZAP_API_KEY` o servidor falha imediatamente com uma mensagem clara.

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

Transporte: **stdio**. Nomes em inglês (snake_case, melhor para tool-calling);
descrições em PT-BR.

**Mensagens** — `send_message`, `list_messages`, `get_message`
**Conversas** — `list_conversations`, `get_conversation`, `update_conversation`
**Contatos** — `list_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact`
**Mídia** — `ingest_media`
**Clientes** — `list_customers`, `get_customer`, `create_customer`, `update_customer`, `delete_customer`
**Links de setup** — `list_setup_links`, `create_setup_link`, `update_setup_link`
**Números** — `list_phone_numbers`, `get_phone_number`, `phone_number_health`
**Templates** — `list_templates`, `get_template`, `create_template`
**Webhooks** — `list_webhooks`, `get_webhook`, `create_webhook`, `update_webhook`, `delete_webhook`, `test_webhook`
**Entregas de webhook** — `list_webhook_deliveries`
**Logs** — `list_api_logs`
**Usuários** — `list_users`

Em caso de erro da API, a ferramenta devolve um resultado de erro (`isError`) com
a mensagem PT-BR do envelope `{ error: { code, message } }` no formato
`Erro [code]: message`.

## Chaves de sandbox

Uma chave de **sandbox** (prefixo `bz_sandbox_`) só habilita as ferramentas de
mensagem: `send_message`, `list_messages` e `get_message`. Qualquer outra
ferramenta responde `403 sandbox_forbidden` (vindo da API) — útil para testar a
integração de envio sem tocar dados reais.

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
