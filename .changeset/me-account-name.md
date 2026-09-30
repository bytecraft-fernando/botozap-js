---
"@botozap/sdk": patch
"@botozap/mcp": patch
---

Add optional `account_name` to `boto.me.get()` (#629). It stays absent against
an older API that does not send the field yet.

MCP's `get_profile` uses it in the `nickname` (`"<account_name> — produção"` or
`"— sandbox"`) so multiple connected accounts are distinguishable in ChatGPT's
profile switcher, falling back to the previous generic text when the API does
not send it.
