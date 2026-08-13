# @botozap/sdk

## 0.2.0 (2026-08-13)

### Novidades

- **`media.get(id)`** — busca os metadados de uma mídia RECEBIDA pelo `media_id`
  da Cloud API (`GET /v1/media/:id`), incluindo `download_url` (URL assinada e
  efêmera, válida até `expires_at`). Novo tipo exportado: `MediaAsset`.
- **Erro distinguível em 2xx** — um corpo `{ error }` agora lança `BotoZapError`
  mesmo com status 2xx. Caso concreto: o 202 `media_not_ready` de `media.get`
  (mídia ainda sendo espelhada) vira um erro com `code: "media_not_ready"` e o
  segundo que falta em `err.headers["retry-after"]`, em vez de passar como
  sucesso malformado.

### Notas

- `GET /v1/media/:id/download` (302 para a mesma URL assinada) não ganha método
  dedicado de propósito: `download_url` já entrega a URL sem o hop de redirect.

## 0.1.0 (2026-07-15)

Primeira versão pública: `messages`, `customers`, `templates`, `broadcasts`,
`contacts`, `conversations`, `webhooks`, `phoneNumbers`, `flows`, `media.upload`,
`users`, `apiLogs`, `webhookDeliveries`; desempacote de `{ data }`, paginação por
cursor/offset e `BotoZapError` com headers da resposta.
