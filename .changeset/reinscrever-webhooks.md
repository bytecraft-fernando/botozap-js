---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Mensagens que pararam de chegar com a autorização valendo: `phoneNumbers.resubscribeWebhooks(id)` (SDK), a tool `resubscribe_phone_number_webhooks` (MCP) e `botozap numbers resubscribe-webhooks <id>` (CLI) chamam `POST /v1/phone_numbers/{id}/webhook-subscription` e inscrevem o BotoZap de novo na Meta, sem refazer a conexão. A saúde do número (`phone_number_health`) passa a explicar `checks.webhook_subscription`.
