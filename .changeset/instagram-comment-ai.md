---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Adiciona IA de comentários do Instagram (#740): configuração opt-in por Conta de canal, limite diário, prontidão e histórico paginado de decisões/envios.

SDK: channelAccounts.getCommentAi, updateCommentAi e listCommentAiRuns, com tipos de configuração, histórico, custo de execução e evento de resposta. CLI: channel-accounts comment-ai get|set|runs, com --enabled, --agent e --daily-limit no set.

MCP (catálogo completo): get_instagram_comment_ai, update_instagram_comment_ai e list_instagram_comment_ai_runs, com escopos agents:read/write, sem sandbox e anotações de efeito público. O perfil assistant permanece inalterado; PATCH via OAuth é exclusivo do painel.
