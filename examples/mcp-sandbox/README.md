# Exemplo — MCP + sandbox

Configuração mínima do servidor MCP do BotoZap (`@botozap/mcp`) usando uma
**chave sandbox** (`bz_sandbox_…`) — nenhuma credencial real, nenhum custo,
nenhum número de WhatsApp de verdade.

O pacote está publicado no npm. Fixamos `0.1.0` abaixo para que a configuração
seja reproduzível.

## 1. Verifique o pacote

```bash
pnpm dlx @botozap/mcp@0.1.0
```

## 2. Configuração no cliente MCP

A chave entra **só por variável de ambiente** — nunca como argumento de tool,
nunca em arquivo commitado. Gere uma chave sandbox em `/chaves` no painel.

Claude Code (`.mcp.json` do seu projeto):

```json
{
  "mcpServers": {
    "botozap": {
      "command": "pnpm",
      "args": ["dlx", "@botozap/mcp@0.1.0"],
      "env": {
        "BOTOZAP_API_KEY": "bz_sandbox_SUA_CHAVE_AQUI"
      }
    }
  }
}
```

Cursor e Codex usam o mesmo shape (`command`/`args`/`env`).

## 3. O que uma chave sandbox pode fazer

O sandbox tem allow-list no servidor: só as operações de **mensagens**
funcionam (`send_message`, `list_messages`, `get_message`). Qualquer outra
tool responde `403 sandbox_forbidden` — comportamento esperado, imposto pela
API, não pelo MCP.

Números mágicos para testar `send_message`:

| Destinatário | Comportamento |
| --- | --- |
| `+5500000000001` | `sent → delivered → read`, janela de 24h sempre aberta |
| `+5500000000002` | falha simulada (erro Meta `131026`) |
| `+5500000000003` | `delivered` + resposta inbound (~2s) que abre a janela real |

Peça ao agente, por exemplo: *"envie 'olá' para +5500000000001 pelo BotoZap
e depois busque a mensagem pelo id para ver o status"*.
