---
"@botozap/cli": minor
"@botozap/sdk": patch
---

CLI: `--idempotency-key` em `messages send` (inclusive `--input`/`--stdin`), `send-media`, `send-interactive`, `send-location` e `react`, enviado no header `Idempotency-Key`. SDK: o README orienta derivar a chave do evento e lista todos os métodos de envio que aceitam `idempotencyKey`.
