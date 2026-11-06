---
"@botozap/mcp": patch
"@botozap/sdk": patch
---

Etapa do funil criada pelo cliente vem com `key: null`. O MCP deixa de recusar a resposta de `list_contact_stages` e `create_contact_stage` nesse caso, e o tipo `ContactStage.key` do SDK passa a `string | null`.
