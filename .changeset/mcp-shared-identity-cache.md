---
"@botozap/mcp": patch
---

Reduce redundant `/v1/me` calls on the hosted remote MCP server (#629). Add a
process-wide identity cache, shared across sessions of the same server
instance and keyed by a hash of the credential (never the raw secret) plus the
API base URL, with the same 60s TTL as the existing per-session cache, an
LRU-bounded size, and deduplication of concurrent lookups for the same
credential. A different credential never reuses another one's cached
identity, introspection failures are never cached, the OAuth session binding
check still runs on every resolved identity, and the API still authorizes
every operation on the real call regardless of this cache.
