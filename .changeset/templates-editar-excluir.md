---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Editar e excluir template fora do painel: `templates.update(id, { components, category })` edita e reenvia à análise da Meta, e `templates.delete(id)` exclui na Meta e aqui (SDK); `update_template` ganha `components`/`category` e entra `delete_template` (MCP); `botozap templates update --components` e `botozap templates delete` (CLI).
