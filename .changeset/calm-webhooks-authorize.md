---
"@botozap/sdk": patch
"@botozap/mcp": patch
---

Adiciona `headers.Authorization` aos Endpoints de webhook. O valor é aceito
somente na escrita, nunca aparece nos resultados do SDK/MCP e é persistido no
Vault pelo core BotoZap.
