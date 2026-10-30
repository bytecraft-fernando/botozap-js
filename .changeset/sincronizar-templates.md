---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Sincronizar templates com a Meta fora do painel: `templates.sync()` (SDK), a tool `sync_templates` (MCP) e `botozap templates sync` (CLI) chamam `POST /v1/templates/sync`, que traz o status real, importa os criados no WhatsApp Manager e tira os excluídos lá. `customer_id` limita a um Cliente.
