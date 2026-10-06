# @botozap/sdk

## 0.11.0

### Minor Changes

- 0df58da: Instagram nas ferramentas públicas.

  SDK: `SendResult.wamid` passa a ser `string | null` e ganha `external_id` e
  `channel` — no Instagram a API devolve `wamid: null` com o `mid` em
  `external_id`, e o SDK deixava de aceitar esse recibo (`malformed_response`) em
  `send`, `sendMedia` e `sendReaction`. `messages.send` e `conversations.reply`
  aceitam `quick_replies`; `conversations.reply` usa a Conta de canal como origem
  em Conversas do Instagram; `conversations.list` filtra por `channel` e
  `channel_account_id`. Novo recurso `channelAccounts` (`list`, `get` e Regras de
  comentário: `listCommentRules`, `getCommentRule`, `createCommentRule`,
  `updateCommentRule`). `ChannelAccount.instagram` traz a saúde da conexão
  (`token_status`, `token_expires_at`, `token_refreshed_at`); `Message` tipa
  `content.edited` (`{ count, at }`), `revoked_at`, `channel` e `external_id`.

  CLI: `messages send --quick-reply`/`--quick-replies-json`, novo
  `messages send-media` (WhatsApp ou Instagram), `conversations list --channel
--channel-account-id` e o comando `channel-accounts` (com `comment-rules`).

  MCP: o output schema de envio aceita o recibo do Instagram (antes
  `send_message`, `send_media_message` e `reply_to_conversation` devolviam erro
  em envio entregue) e as telas reconhecem o recibo por `external_id`. Tools
  novas no catálogo completo: `list_channel_accounts`, `list_comment_rules`,
  `get_comment_rule`, `create_comment_rule`, `update_comment_rule`;
  `get_channel_account` fica disponível sem UI no catálogo completo. O perfil
  `assistant` não muda.

## 0.10.0

### Novidades

- Adiciona `customer_id` e `agent_paused` aos filtros de conversas e tipa `agent_paused_at`, para consultar atendimentos que aguardam intervenção humana.
- Adiciona `account_name` opcional à introspecção `boto.me.get()`, compatível com APIs que ainda não enviam esse campo.
- Tipa `pricing.source` em `AiCatalogModel`: `openrouter` identifica preço de referência do catálogo público; sem esse campo, o preço veio do próprio provedor.

## 0.9.0

### Minor Changes

- Cover the API additions of 2026-09-29:

  - SDK: `messages.sendInteractive` (button/list/cta_url in Cloud API shape, typed as `InteractivePayload`), `messages.sendLocation` and `messages.sendReaction` (target is the internal UUID or wamid of a received message; `emoji: ""` removes it; `SendResult.reaction` echoes target and action). `messages.list({ sort: "created_at" | "event_at" })`; `Message.source` (`MessageSource`), `created_at`, `event_at` and `Conversation.last_message`. `WEBHOOK_CATEGORIES` with the opt-in `app_messages` category; `WebhookDeliveryStatus` gains `limited`. `ai.providers.get()` types `providers` as `AiProviderInfo` with `accepts_new_credentials`; `AI_CREDENTIAL_PROVIDERS` (openai, anthropic). `BotoZapErrorCode`, `PLAN_ERROR_CODES` and `isPlanError` for `plan_restricted`, `free_form_limit_reached` and `free_number_cap`.
  - CLI: `messages send-interactive`, `messages send-location`, `messages react` (`--remove`), `messages list --sort` and an ORIGEM column; help for `app_messages` and `limited`.
  - MCP: `send_message` accepts `interactive`, `location` and `reaction`; `list_messages` accepts `sort`; `send_message` output includes `reaction`; delivery status `limited`; webhook tools document `app_messages`.

- ca116b8: Add authenticated account introspection through `boto.me.get()`. MCP initializes from `/me`, limits its tools to the credential scopes and environment, and declares tool safety annotations.

  Deploy the BotoZap API with `GET /v1/me` before upgrading MCP. MCP startup fails closed when introspection is unavailable; it does not fall back to the complete tool catalog.

  Compact MCP JSON responses and publish the validated schema projection for typed entities. Preserve business content and pagination, expose webhook signing secrets only at creation, and clarify tool identifiers and side effects.

  Compatibility changes:

  - Tools outside the credential scopes or supported environment are omitted from discovery. OAuth additionally requires the concrete API routes used by each tool; operations still pass through API authorization.
  - In Streamable HTTP, a session caches its identity for 60 seconds. API keys remain bound to their original fingerprint. OAuth bearer changes trigger introspection and must preserve the account, environment, user, client and grant. Tools and event polls share the cache and concurrent refresh; API calls still authorize each operation.
  - Typed MCP results now discard fields outside their schemas in both `structuredContent` and legacy JSON text. The reviewed endpoint responses have no identified public field removed by this change; `list_users.data[].id` and its `user_id` alias were already declared and remain available. Webhook `secret` is retained only in `create_webhook`; it is excluded from list/get/update results. `authorization_secret_id`, `private_trace` and `internal_debug` are concrete extras discarded by regression fixtures, not fields currently returned by the reviewed API presenters.
  - Deploy and verify `GET /v1/me` on every supported API base URL **before publishing either SDK or MCP**. Versionless `npx @botozap/mcp` or `pnpm dlx @botozap/mcp` can pick up the new release immediately; delaying the API deploy would break their session initialization.

  The field audit and ordered release checks are recorded in `docs/chatgpt-phase1-release.md`.

- ef10a36: Add optional `idempotencyKey` options to `messages.send`, `sendTemplate`, `sendMedia` and `conversations.reply`. Calls without this option retain their existing HTTP payload and behavior.

  MCP send tools accept optional `idempotency_key`: call the read-only `prepare_send_intent` once before a new send, or reuse `draft.idempotency_key` returned by `stage_review_reply`. Keep the same key and payload after a timeout. Never generate a replacement key to bypass pending/conflicting sends. Existing tool calls remain valid without a key or preparation step and retain legacy behavior. New review UI sends always include a key; public API clients and ordinary SDK callers may also continue omitting the header.

  Add an opt-in MCP Apps review panel (`BOTOZAP_MCP_UI_ENABLED=true`), thread entrypoint, Radar/history context, explicit confirmation and retry using the original intent. The UI bundle is packaged locally with no external assets. Deploy API idempotency support before upgrading these send tools. Plugin manifests are local candidates, not published directory listings.

- 9453f19: Support OAuth bearer credentials and rotating access-token providers in the SDK. MCP publishes protected-resource metadata, validates each request against account introspection, and binds OAuth sessions to the user, client, grant and account so token refresh preserves the connection.

  Require current scopes and allowed routes for tools and background event reads. API-key authentication retains its existing behavior. Enable OAuth only after deploying the coordinated BotoZap authorization endpoints and grant policies.

### Patch Changes

- bc67b0c: Preserve the API's validated `outcome` and `retry` enums on SDK/MCP errors. Confirmed rejection releases the idempotency claim, so the same key can retry after backoff or correction. The review UI unlocks a confirmed rejection and keeps unknown outcomes protected. Existing calls without keys remain unchanged.

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
