# @botozap/sdk

## 0.8.0

### Minor Changes

- 505f0a6: **Breaking (types only):** remove `provision_phone_number` from `CreateSetupLinkParams` and `SetupLink`. Number provisioning is not offered: the option never had any effect and the API ignores it and stops returning it. Code that still passes it gets a TypeScript error; just drop the field. No runtime change.

  Document the setup link redirects as the API ships them: `success_redirect_url`/`failure_redirect_url` must be `https://`, without credentials and up to 2048 characters (otherwise `422 invalid_redirect_url`). After a final state the customer goes to the success URL with `setup_link_id` and `status=completed`, to the failure URL with `status=failed` when the link is exhausted, or with `status=cancelled` when they choose to go back on a retryable error (the link stays valid). The partner's query string is preserved and the link token is never sent. `theme_config` is documented as reserved (always `null`).

## 0.7.0

### Minor Changes

- 5ffc8f4: Cover the API additions of 2026-09-25:

  - `Contact.display_name` (the name the business gives the contact, 1–200 characters; `null` when unset) and `display_name` on `CreateContactParams`/`UpdateContactParams` (`null` or `""` clears it). It is independent from `profile_name`, which comes from the channel.
  - `phoneNumbers.update(id, { label })` is back: `PATCH /v1/phone_numbers/:id` now accepts the local `label` (up to 100 characters, no control characters; `null` or `""` clears). `PhoneNumber.label` is typed and `UpdatePhoneNumberParams` is exported.
  - New `usage.metaCosts({ customer_id?, from?, to? })` for `GET /v1/usage/meta-costs` (scope `customers:read`), fully typed as `MetaCostReport` (per-currency `totals`, `by_day`, `by_category` with `cost`, `estimated_cost` and `cost_source`; `unavailable`/`unavailable_reason`, `estimate` and `sync`). Missing Meta cost stays `null`, never `0`.
  - `Conversation` declares `entry_point` (`"ctwa" | "organic" | null`), `referral` (`ConversationReferral`: `source_id`, `source_url`, `headline`, `ctwa_clid`, `received_at`), `fep_expires_at` and `fep_reply_by`.

## 0.6.0

### Minor Changes

- 5e435ea: `Appointment.google_etag` and `Appointment.google_base_data` become optional and deprecated: they are internal Google Calendar sync data and the API stops sending them on 2026-10-26.

## 0.5.0

### Minor Changes

- eda9708: `AiAgent` gains `lifecycle`, `serving`, `serving_via` and `channel_account_id`, returned by `ai.agents.list` and `ai.agents.get`.
- 4127500: **Breaking:** remove WhatsApp Flows (`client.flows`, the `Flow`/`FlowVersion` types and the `CreateFlowParams`/`ListFlowsParams`/`FlowPhoneParams`/`CreateFlowVersionParams`/`SetFlowDataEndpointParams` exports). The API no longer serves `/v1/flows/*`; every call already failed with 404. AI follow-up flows (`ai.followupFlows`) are unaffected.

  Align three types with the API:

  - `CreateWebhookParams`/`UpdateWebhookParams` accept `customer_id` (limits deliveries to one Customer of the account; `null` on update removes the filter) and `Webhook` declares `customer_id`.
  - **Breaking (types only):** `broadcasts.addRecipients` takes `BroadcastRecipientInput[]` (`{ to_recipient, components? }`) instead of `unknown[]`; plain strings were always rejected per item by the API. `AddRecipientsResult.errors` is typed as `AddRecipientsError[]` (`{ index, to_recipient?, reason }`).
  - **Breaking (types only):** `BotoZapEvent.message_id` is `string | null` (the WhatsApp `wamid`, `null` outside WhatsApp) and the event declares `external_id` (channel message id: `wamid` on WhatsApp, `mid` on Instagram).

- 3b79628: `webhooks.update` accepts `secret` to rotate the signing secret (`PATCH /v1/webhooks/:id`).

## 0.4.1

### Patch Changes

- Fix types that diverged from the API, found by the core's SDK contract matrix: `ai.routers.activateMember` now takes `expected_agent_revision` (the typed call used to send `expected_revision` and always got 422; CLI/MCP were not affected); `JourneyConfig`/`Journey` accept `appointment_service_id` for appointment-triggered journeys; `StageRule.account_id` is optional because `radar.configureStageRule` does not return it; `ConversationNote` declares `author_agent_id` for notes written by an AI agent. No runtime change.

## 0.4.0

### Minor Changes

- Add complete shared saved replies, Inbox notes/reminders/operator state, CRM opportunities and demands, Radar stage criteria and appointment alerts, journey configuration and run control, appointment scheduling and Google Calendar operations, and complete BYOK AI agents with versioned configuration, provider credentials, knowledge, memory, skills, follow-up graphs, routing, cases, alerts, notices, reviewed proposals, executions and usage. Add contact stage/field discovery and complete assignment management in CLI/MCP. Preserve server CAS, pagination, idempotency and account identity boundaries. Previously published methods remain available. The unpublished legacy agents draft is replaced by /ai; no managed credits or paid agent slots. Include #498 agent parity: commercial proposals, eligibility gate with explicit open-to-all confirmation, inference ledger, operator promises, knowledge diagnostics/catalog sync/citations/coverage, memory reactivation, skill near-miss curation, notice diagnostics, provider catalog snapshots, case timeline, bulk alert resolution, promised returns, the unified follow-up queue, capability usage, the evolution panel, style adjustments and the additive execution security trail; granular BYOK purposes, extended agent configuration and 20 MiB direct document uploads. Contacts accept `tags` on create, `tags`/`add_tags`/`remove_tags` on update and return `tags` (up to 20 × 40 characters).

## 0.3.2

### Patch Changes

- 05e1c9f: Adiciona `headers.Authorization` aos Endpoints de webhook. O valor é aceito
  somente na escrita, nunca aparece nos resultados do SDK/MCP e é persistido no
  Vault pelo core BotoZap.

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
