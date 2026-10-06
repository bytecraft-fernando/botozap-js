---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Instagram nas ferramentas públicas.

SDK: `SendResult.wamid` passa a ser `string | null` e ganha `external_id` e
`channel` — no Instagram a API devolve `wamid: null` com o `mid` em
`external_id`, e o SDK deixava de aceitar esse recibo (`malformed_response`) em
`send`, `sendMedia` e `sendReaction`. `messages.send` e `conversations.reply`
aceitam `quick_replies`; `conversations.reply` usa a Conta de canal como origem
em Conversas do Instagram; `conversations.list` filtra por `channel` e
`channel_account_id`. Novo recurso `channelAccounts` (`list`, `get` e Regras de
comentário: `listCommentRules`, `getCommentRule`, `createCommentRule`,
`updateCommentRule`). `ChannelAccount.instagram` traz a saúde da conexão
(`token_status`, `token_expires_at`, `token_refreshed_at`); `Message` tipa
`content.edited` (`{ count, at }`), `revoked_at`, `channel` e `external_id`.

CLI: `messages send --quick-reply`/`--quick-replies-json`, novo
`messages send-media` (WhatsApp ou Instagram), `conversations list --channel
--channel-account-id` e o comando `channel-accounts` (com `comment-rules`).

MCP: o output schema de envio aceita o recibo do Instagram (antes
`send_message`, `send_media_message` e `reply_to_conversation` devolviam erro
em envio entregue) e as telas reconhecem o recibo por `external_id`. Tools
novas no catálogo completo: `list_channel_accounts`, `list_comment_rules`,
`get_comment_rule`, `create_comment_rule`, `update_comment_rule`;
`get_channel_account` fica disponível sem UI no catálogo completo. O perfil
`assistant` não muda.
