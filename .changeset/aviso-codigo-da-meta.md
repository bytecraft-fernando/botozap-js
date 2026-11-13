---
"@botozap/sdk": minor
---

Avisos de casos no WhatsApp: `AiNoticeJob` ganha `meta_error_code`, o código da Meta quando ela recusou o aviso, na hora (`last_error: "meta_rejected"`) ou depois, pelo status da mensagem (`last_error: "meta_failed"`: a API agora fecha como `failed` o aviso que a Meta aceitou e não entregou). Um `pending` com `last_error` é um aviso adiado por recusa passageira, esperando a hora de tentar de novo.
