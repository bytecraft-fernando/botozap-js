---
"@botozap/mcp": minor
"@botozap/sdk": minor
---

Adiciona o stream durável `events.list` ao SDK e um resource MCP assinável por
cursor. O servidor stdio anuncia subscriptions, envia
`notifications/resources/updated` enquanto a assinatura está ativa e preserva
as tools e o fallback de replay após reconexão.
