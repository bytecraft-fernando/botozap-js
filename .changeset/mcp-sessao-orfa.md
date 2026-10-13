---
"@botozap/mcp": patch
---

Remoto: POST com sessão desconhecida e credencial válida é atendido sem sessão
em vez de 404. Hosts que não reabrem a sessão após o 404 (Grok) seguiam
chamando tools com um id antigo — de antes de um deploy ou já reciclado — e
ficavam presos em "Sessão MCP inválida". `initialize`, GET (SSE) e sessão viva
de outra credencial continuam 404.
