---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Entregas de webhook por canal: `webhookDeliveries.list` aceita
`channel_account_id` (o uuid do canal, ou `none` para as entregas sem canal,
como o teste), e cada entrega traz `channel_account_id`. CLI:
`deliveries list --channel-account-id <id>` e a coluna HTTP volta a mostrar o
código da resposta. MCP: `list_webhook_deliveries` aceita `channel_account_id`.
