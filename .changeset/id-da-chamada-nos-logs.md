---
"@botozap/sdk": patch
"@botozap/cli": patch
"@botozap/mcp": patch
---

Id da chamada nos logs da API: `request_id` (o mesmo `x-request-id` da resposta) no tipo `ApiLog` do SDK, na saída de `list_api_logs` do MCP e na coluna "ID DA CHAMADA" de `botozap logs list`.
