---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Arquivos do agente (#1447): fotos, vídeos e PDFs que o agente de IA manda na conversa. SDK: `ai.files` (`list`, `get` com `usages` e `preview_url`, `update`, `remove` e `upload` pelo upload direto com `kind: "file"`), `AiAgentFile` e `file_id` no `messages.sendMedia` no lugar do `link`. MCP: `ai_files_list`, `ai_files_get`, `ai_files_update`, `ai_files_remove`, `kind: "file"` (com `description` e `caption`) no `ai_uploads_prepare` e `file_id` no `send_media_message`. CLI: os comandos `ai files`.
