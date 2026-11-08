---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Envios sem confirmação da Meta, como o aviso na conversa no painel: `conversations.listPendingSends(id)` lista os envios manuais do WhatsApp (API ou painel) que a Meta não confirmou em cerca de 5 minutos, e `conversations.markPendingSend(id, sendId, "sent" | "not_sent")` diz se o envio chegou ao contato (`sent` põe a mensagem no histórico sem o id da Meta; `not_sent` libera para enviar de novo; nada é reenviado) (SDK). Entram `list_pending_sends` e `mark_pending_send`, só no catálogo completo (MCP). `botozap conversations pending-sends <id>` e `botozap conversations mark-send <id> <sendId> --outcome sent|not_sent` (CLI).
