# @botozap/sdk

## 0.3.1

### Patch Changes

- Publica novamente o candidato agent-native validado em versões patch para
  promovê-lo diretamente ao canal `latest` do npm.

## 0.3.0

### Minor Changes

- 05733ec: Adiciona o stream durável `events.list` ao SDK e um resource MCP assinável por
  cursor. O servidor stdio anuncia subscriptions, envia
  `notifications/resources/updated` enquanto a assinatura está ativa e preserva
  as tools e o fallback de replay após reconexão.
- da01362: Adiciona `conversations.reply` ao SDK e a tool MCP
  `reply_to_conversation`, que resolvem Contato e Número pela Conversa e
  delegam ao endpoint canônico de mensagens, preservando janela, quota, billing
  e isolamento multi-tenant no servidor.
- 42c65ef: Adiciona envio tipado de image, video, audio e document pelo SDK e pela tool MCP `send_media_message`, com limites e campos específicos por tipo.

### Patch Changes

- de26959: Adiciona output schemas e structured content às tools centrais de Mensagens,
  Números e Templates, preservando o fallback textual e expondo erros estruturados.
  Sincroniza também o tipo `SendResult` do SDK com o campo aditivo `sent_to` da API.
- e923a96: Torna o push remoto resiliente a queda ou indisponibilidade inicial do event
  bus, sinais concorrentes, restart e clientes abandonados. Adiciona heartbeat de
  reconciliação por cursor, limites de sessão/assinatura, cleanup por cancelamento
  ou expiração e testes de carga e isolamento entre Conta e ambiente. Leituras de
  Eventos do SDK agora aceitam `AbortSignal`, permitindo cancelar I/O em voo.

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
