---
"@botozap/mcp": patch
---

Segurança: `@modelcontextprotocol/sdk` 1.29 → 1.32.2, com `proxy-addr`, `body-parser`, `fast-uri`, `ip-address`, `hono` e `qs` corrigidos nas dependências dele. O servidor agora recusa um `tools/call` cujos argumentos somem mais de 10.000 elementos de array e membros de objeto (`maxToolInputElements`), antes da validação: o zod 3 aloca um erro por elemento inválido, e um único corpo de 1 MiB chegava a ~190 MiB de heap.
