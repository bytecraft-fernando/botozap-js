---
"@botozap/sdk": minor
"@botozap/mcp": minor
---

Support OAuth bearer credentials and rotating access-token providers in the SDK. MCP publishes protected-resource metadata, validates each request against account introspection, and binds OAuth sessions to the user, client, grant and account so token refresh preserves the connection.

Require current scopes and allowed routes for tools and background event reads. API-key authentication retains its existing behavior. Enable OAuth only after deploying the coordinated BotoZap authorization endpoints and grant policies.
