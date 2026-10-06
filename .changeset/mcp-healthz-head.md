---
"@botozap/mcp": patch
---

`/healthz` também responde a `HEAD` (200, sem corpo), para monitores externos que checam só com `HEAD`.
