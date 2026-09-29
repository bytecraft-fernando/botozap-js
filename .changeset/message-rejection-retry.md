---
"@botozap/sdk": patch
"@botozap/mcp": patch
---

Preserve the API's validated `outcome` and `retry` enums on SDK/MCP errors. Confirmed rejection releases the idempotency claim, so the same key can retry after backoff or correction. The review UI unlocks a confirmed rejection and keeps unknown outcomes protected. Existing calls without keys remain unchanged.
