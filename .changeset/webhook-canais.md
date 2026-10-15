---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Webhooks por canal: `channel_account_ids` em create/update (ausente = todos no
create e sem mudança no update; `null` volta a todos) e, na leitura,
`channel_account_ids` e `channels_health` (saúde por canal, só dos canais em
falha). CLI ganha `--channel-account-id` (repetível) e `--all-channels`, e mostra
canais e saúde por canal em `webhooks get/list`. MCP aceita `channel_account_ids`
em `create_webhook`/`update_webhook` e devolve os campos novos na saída
estruturada.
