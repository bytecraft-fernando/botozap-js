---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Conversas antigas do app WhatsApp Business (coexistência, botozap#1004):
`phoneNumbers.getHistoryImport` e `phoneNumbers.setHistoryImport` (`GET` e
`PUT /v1/phone_numbers/{id}/history-import`, `{ window_days: 0 | 30 | 180 }`), com os
tipos `HistoryImport`, `HistoryImportStatus`, `HistoryImportWindowDays` e
`SetHistoryImportParams` e os erros `history_import_not_available` (404) e
`history_import_locked` (409). CLI `numbers history-import get <id>` e
`numbers history-import set <id> --days 0|30|180`; tools
`get_phone_number_history_import` (leitura) e `set_phone_number_history_import`
(escolha única por conexão, `destructiveHint`), só no catálogo completo: o perfil
`assistant` (OAuth) não muda.
