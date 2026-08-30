---
"@botozap/mcp": patch
---

Recicla no teto a sessão mais antiga da mesma credencial quando ela mantém
somente o listener GET/SSE aberto, sem interromper POSTs MCP em andamento.
