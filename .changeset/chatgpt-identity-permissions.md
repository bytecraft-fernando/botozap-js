---
"@botozap/sdk": minor
"@botozap/mcp": minor
---

Add authenticated account introspection through `boto.me.get()`. MCP initializes from `/me`, limits its tools to the credential scopes and environment, and declares tool safety annotations.

Deploy the BotoZap API with `GET /v1/me` before upgrading MCP. MCP startup fails closed when introspection is unavailable; it does not fall back to the complete tool catalog.

Compact MCP JSON responses and publish the validated schema projection for typed entities. Preserve business content and pagination, expose webhook signing secrets only at creation, and clarify tool identifiers and side effects.

Compatibility changes:

- Tools outside the credential scopes or supported environment are omitted from discovery. OAuth additionally requires the concrete API routes used by each tool; operations still pass through API authorization.
- In Streamable HTTP, a session caches its identity for 60 seconds. API keys remain bound to their original fingerprint. OAuth bearer changes trigger introspection and must preserve the account, environment, user, client and grant. Tools and event polls share the cache and concurrent refresh; API calls still authorize each operation.
- Typed MCP results now discard fields outside their schemas in both `structuredContent` and legacy JSON text. The reviewed endpoint responses have no identified public field removed by this change; `list_users.data[].id` and its `user_id` alias were already declared and remain available. Webhook `secret` is retained only in `create_webhook`; it is excluded from list/get/update results. `authorization_secret_id`, `private_trace` and `internal_debug` are concrete extras discarded by regression fixtures, not fields currently returned by the reviewed API presenters.
- Deploy and verify `GET /v1/me` on every supported API base URL **before publishing either SDK or MCP**. Versionless `npx @botozap/mcp` or `pnpm dlx @botozap/mcp` can pick up the new release immediately; delaying the API deploy would break their session initialization.

The field audit and ordered release checks are recorded in `docs/chatgpt-phase1-release.md`.
