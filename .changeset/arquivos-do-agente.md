---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Arquivos do agente (#1447): fotos, vídeos e PDFs que o agente de IA manda na conversa. SDK: `ai.files` (`list`, `get` com `usages` e `preview_url`, `update`, `remove` e `upload` pelo upload direto com `kind: "file"`), `AiAgentFile` e `file_id` no `messages.sendMedia` no lugar do `link`. MCP: `ai_files_list`, `ai_files_get`, `ai_files_update`, `ai_files_remove`, `kind: "file"` (com `description` e `caption`) no `ai_uploads_prepare` e `file_id` no `send_media_message`. CLI: os comandos `ai files`.

Tipos: `link` passa a ser opcional em `SendImageParams`, `SendVideoParams` e `SendDocumentParams` (um dos dois, `link` ou `file_id`; o SDK recusa os dois ou nenhum); código que lia `params.link` como `string` precisa tratar o `undefined`. `AiToolId` ganha `conversations.attach_files`, e `AiAgentConfig`, `file_ids`. MCP: `ai_files_upload` (conteúdo em `file_base64`) e os arquivos na configuração de `ai_agents_create`/`ai_agents_save_draft`. CLI: `ai files upload` (`file_path`) e `messages send-media --file-id`.
