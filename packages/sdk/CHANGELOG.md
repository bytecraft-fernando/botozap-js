# @botozap/sdk

## 0.25.0

### Minor Changes

- 259b5db: Código da Meta nas recusas e reenvio de entrega de webhook.

  - `BotoZapError.metaCode` (e `SendFailureDetails.metaCode`) traz o código
    numérico da Meta (`error.meta_code`, ex.: `131026`) quando ela recusa um envio
    ou um pedido de consentimento; só vem quando é inteiro. A CLI mostra
    `— código da Meta: N` no erro e `meta_code` no `-o json`. No MCP o texto do
    erro ganha `Código da Meta: N.` e, no catálogo completo, o erro estruturado
    ganha `meta_code`; o perfil `assistant` (OAuth) segue anunciando e devolvendo
    o erro revisado, com o código só no texto.
  - `webhookDeliveries.replay(id)` (`POST /v1/webhook_deliveries/{id}/replay`,
    tipo `WebhookDeliveryReplay`) reenvia uma entrega `exhausted` ou `limited`,
    como o Reenviar do painel, com a mesma `X-Idempotency-Key`; erros
    `delivery_not_replayable` e `forward_limit_reached` (409) e
    `replay_rate_limited` (429). CLI `deliveries replay <id>`; tool
    `replay_webhook_delivery` (`webhooks:write`, idempotente, `openWorldHint`),
    só no catálogo completo: o perfil `assistant` (OAuth) não muda.

## 0.24.0

### Minor Changes

- c56cd71: **Quebra de compatibilidade:** o Node mínimo passa a ser o 22.12. O Node 20 saiu de suporte em abril de 2026 e deixa de ser testado. Quem ainda roda Node 20 deve atualizar o Node antes de instalar esta versão; as versões anteriores dos pacotes continuam funcionando no 20.19.

## 0.23.0

### Minor Changes

- 394ca5e: Conversas antigas do app WhatsApp Business (coexistência, botozap#1004):
  `phoneNumbers.getHistoryImport` e `phoneNumbers.setHistoryImport` (`GET` e
  `PUT /v1/phone_numbers/{id}/history-import`, `{ window_days: 0 | 30 | 180 }`), com os
  tipos `HistoryImport`, `HistoryImportStatus`, `HistoryImportWindowDays` e
  `SetHistoryImportParams` e os erros `history_import_not_available` (404) e
  `history_import_locked` (409). CLI `numbers history-import get <id>` e
  `numbers history-import set <id> --days 0|30|180`; tools
  `get_phone_number_history_import` (leitura) e `set_phone_number_history_import`
  (escolha única por conexão, `destructiveHint`), só no catálogo completo: o perfil
  `assistant` (OAuth) não muda.

## 0.22.0

### Minor Changes

- 8eba0bc: Paridade com a API de 23/10/2026. "Digitando…" e leitura: `conversations.typing` e
  `conversations.markRead` (`POST /v1/conversations/{id}/typing` e `/read`; CLI
  `conversations typing` e `read`; tools `conversation_typing` e `mark_conversation_read`),
  com o erro `no_inbound_message` (409). Responder citando: `reply_to: { message_id }` em
  texto, template, mídia, interactive e localização (não em reação) e em
  `conversations.reply`; o recibo e as mensagens trazem `reply_to`, e as mensagens trazem
  `played_at` (voz ouvida, evento `whatsapp.message.played`) e `transcription` (áudio
  recebido já transcrito pela IA); erros `reply_target_not_found` e
  `reply_target_unavailable` (CLI `--reply-to` em send, send-media, send-interactive e
  send-location; MCP `reply_to` em `send_message` e `send_media_message` e
  `reply_to_message_id` em `reply_to_conversation`). Mensagem de voz: `voice: true` em áudio
  (CLI `send-media --voice`; MCP `voice` em `send_media_message`), com `invalid_voice` e
  `unsupported_voice`. Modelos prontos de Régua:
  `journeys.catalog` e `journeys.enableModel` (CLI `journeys catalog` e `enable-model`;
  tools `list_journey_models` e `enable_journey_model`). Diagnóstico do agente:
  `ai.agents.diagnostic` (CLI `ai agents diagnostic`; tool `ai_agents_diagnostic`). IA:
  `AiToolId` e o enum das tools `ai_*` aceitam `conversations.reply_options`.
  Configurações do número do WhatsApp: `phoneNumbers.getProfile`, `updateProfile`,
  `uploadProfilePhoto`, `getConversationalAutomation`, `updateConversationalAutomation`,
  `clearConversationalAutomation`, `phoneNumbers.qrCodes` (`list`, `create`, `get`,
  `update`, `delete`) e `phoneNumbers.blockedUsers` (`list`, `block`, `unblock`), com os
  códigos de erro da Meta (`coexistence_not_supported`, `block_window_closed`,
  `meta_unconfirmed`…); CLI `numbers profile|prompts|qr|blocked`; tools
  `get_phone_number_profile`, `update_phone_number_profile` (por OAuth a API responde 403),
  `get_conversational_automation`, `update_conversational_automation`,
  `clear_conversational_automation`, `list_qr_codes`, `create_qr_code`, `get_qr_code`,
  `update_qr_code`, `delete_qr_code`, `list_blocked_users`, `block_contact` e
  `unblock_contact`. Tudo novo do MCP fica só no catálogo completo: o perfil `assistant`
  (OAuth) não ganha tools, e `send_message`, `reply_to_conversation`, `list_messages` e
  `get_message` mantêm nele a mesma entrada, saída e descrição revisadas.

## 0.21.0

### Minor Changes

- 03f25cd: Entregas de webhook por canal: `webhookDeliveries.list` aceita
  `channel_account_id` (o uuid do canal, ou `none` para as entregas sem canal,
  como o teste), e cada entrega traz `channel_account_id`. CLI:
  `deliveries list --channel-account-id <id>` e a coluna HTTP volta a mostrar o
  código da resposta. MCP: `list_webhook_deliveries` aceita `channel_account_id`.

## 0.20.1

### Patch Changes

- bef36f5: CLI: `--idempotency-key` em `messages send` (inclusive `--input`/`--stdin`), `send-media`, `send-interactive`, `send-location` e `react`, enviado no header `Idempotency-Key`. SDK: o README orienta derivar a chave do evento e lista todos os métodos de envio que aceitam `idempotencyKey`.

## 0.20.0

### Minor Changes

- 532fd08: Paridade com a API de 16 a 20/10/2026. Consentimento: pedido de consentimento
  (`conversations.requestConsent`, `botozap conversations request-consent`, tool
  `request_consent`), que vale para WhatsApp e Instagram e devolve `channel`, com as
  recusas `outside_window` (WhatsApp) e `window_closed` (Instagram); consentimentos do
  contato (`contacts.listConsents` e `recordConsent`, `botozap contacts consents` e
  `record-consent`, tools `list_contact_consents` e `record_contact_consent`) com as
  origens `contact_keyword`, `template_button` e `meta_opt_out`; `warnings` no retorno
  de `contacts.create`; `consent_basis` em `messages.sendTemplate`. Palavras de saída e
  de volta e textos de confirmação do Cliente (`opt_out_keywords`, `opt_in_keywords`,
  `opt_out_confirmation`, `opt_in_confirmation`) em `customers.update` e no objeto, e
  `opt_out_buttons` em `templates.create`, `templates.update` (novo,
  `PATCH /v1/templates/{id}`) e no objeto (MCP: tool `update_template`; o
  `create_template` do MCP não muda para manter o perfil `assistant` idêntico). Erros
  novos em `BotoZapErrorCode`: `consent_opted_out` (409), `consent_revoked` (422),
  `not_connected` (409), `ip_not_allowed` (403), `admin_required` e `gone` (410), com
  `isConsentOptedOut`, `isConsentRevoked` e `isNotConnected`. Conversas:
  `conversations.delete` (`botozap conversations delete`, com confirmação ou `--yes`;
  tool MCP `delete_conversation`, marcada como destrutiva). Exportação de dados:
  `exports.create`/`list`/`get` (`exports:read` e `exports:write`; CLI `exports`; tools
  `create_export`, `list_exports` e `get_export`). Registro de atividades:
  `teamEvents.list` com filtros (CLI `team-events list`; tool `list_team_events`).
  Plano: `guarantee` (garantia de 7 dias) em `billing.get`, no CLI e em `get_billing`.
  IA: o catálogo tem só `openai` e `anthropic`; as entradas do SDK
  (`AiEnabledProvider`; `AiAgentConfig`, `AiBindingTarget` e `AiRouterConfig` agora são
  tipos de entrada) e as tools `ai_*` do MCP aceitam só esses dois (outro provedor
  responde 422 `provider_not_enabled`); a leitura mantém os seis históricos
  (`AiProvider`, `AiAgentConfigRead`, `AiBindingTargetRead`).
  Descrições: `delete_contact` diz que a recusa fica guardada como código cifrado e
  que a mídia é apagada; `send_message` (só no catálogo completo) explica
  `consent_revoked` e `not_connected`; sai o rótulo `data_use_ack_required` do
  `agent-inbox`. Tudo novo do MCP fica só no catálogo completo (chave de API).

## 0.19.0

### Minor Changes

- 8d6d00f: Limites do Free: 1 Cliente e 1 número. Quem passa do teto (por exemplo, depois do
  teste grátis) fica suspenso, sem exclusão: continua recebendo, mas não envia, e
  volta sozinho ao assinar. SDK: `plan_suspended?: boolean` em `Customer` e
  `PhoneNumber`; `isFreeCap` (402 `free_cap`: 2º Cliente no Free ou envio por
  Cliente suspenso) e `isFreeNumberCap` (402 `free_number_cap`: envio por Número
  suspenso ou setup além do teto); `free_cap` entra em `PLAN_ERROR_CODES`, então
  `isPlanError` passa a reconhecê-lo. Docs de `customers.create`, Regras de
  mensagem e Perguntas e menu citam o 403 `plan_restricted` do Free. CLI: coluna
  SUSPENSO em `customers list` e `numbers list`. MCP, só no catálogo completo:
  `plan_suspended` na saída de `list_customers`, `get_customer`, `create_customer`,
  `update_customer`, `list_phone_numbers`, `get_phone_number` e
  `update_phone_number`, e descrições com as recusas do Free (`free_cap`,
  `free_number_cap`, `plan_restricted`) em leituras, envios, `create_customer`,
  Regras de mensagem e Perguntas e menu. O perfil `assistant` (OAuth) não muda:
  mesmas tools, anotações, descrições e saída.

## 0.18.0

### Minor Changes

- 48db398: Link de setup com canal: cada link conecta um canal só, `whatsapp` (padrão) ou
  `instagram`. No Instagram, o Cliente confirma que a conta é profissional e que as
  mensagens estão liberadas e entra com o Instagram; `allowed_connection_types` não
  vale (a API responde `422 invalid_connection_types`) e o link volta com
  `allowed_connection_types: []` e `url` em `/instagram/setup/<token>`. Canal fora
  desses dois responde `422 invalid_channel`. `whatsapp_setup_status` mantém o nome
  e vale para os dois canais.

  SDK: `channel?: "whatsapp" | "instagram"` em `CreateSetupLinkParams` e
  `channel: "whatsapp" | "instagram"` em `SetupLink`. CLI: `setup-links create
--channel <whatsapp|instagram>` e coluna CANAL no `setup-links list`. MCP:
  `create_setup_link` aceita `channel` opcional (padrão `whatsapp`) e o schema de
  saída dos links de setup passa a trazer `channel`.

  Requer a API com o campo `channel` nos links de setup (app BotoZap, branch
  `feat/setup-link-instagram`): publique o MCP só depois desse deploy, porque o
  schema de saída exige `channel`.

## 0.17.0

### Minor Changes

- ed98a15: Plano e slots adicionais (só chave de API, scopes `billing:read` e
  `billing:write`). O plano pago inclui 1 negócio; cada negócio a mais ocupa um
  slot de R$ 47/mês. SDK ganha `billing.get()`, `billing.slots.create({ idempotencyKey })`
  e `billing.slots.cancel(id)`, os tipos `Billing`, `BillingPlan`, `BusinessSlot`,
  `ConnectionBilling`, `ConnectionBillingOutcome`, `ConnectionBillingRefusal` e
  `CustomerBusinessSlot`, `connection_billing` no link de setup, `business_slot` no
  Cliente e `isBusinessPaymentRequired` para o 402 `business_payment_required` do
  envio (negócio pausado por fatura vencida há mais de 7 dias). CLI ganha
  `billing`, `billing slots create [--idempotency-key]` e `billing slots cancel <id>`.
  MCP ganha `get_billing`, `create_business_slot` e `cancel_business_slot`, só no
  catálogo de chave de API, com `readOnlyHint`, `destructiveHint`, `openWorldHint` e
  `idempotentHint` explícitos; os links de setup passam a trazer `connection_billing`.

## 0.16.1

### Patch Changes

- 55d0eee: Setup links: `language` passa a ser descrito como aceito por compatibilidade e
  ignorado. A página do link é sempre em português e o link novo volta com
  `language: null`; antes, SDK, CLI (`--language`) e MCP (`create_setup_link`)
  diziam que o valor escolhia o idioma da página. O parâmetro continua aceito.

## 0.16.0

### Minor Changes

- d51f908: Adiciona IA de comentários do Instagram (#740): configuração opt-in por Conta de canal, limite diário, prontidão e histórico paginado de decisões/envios.

  SDK: channelAccounts.getCommentAi, updateCommentAi e listCommentAiRuns, com tipos de configuração, histórico, custo de execução e evento de resposta. CLI: channel-accounts comment-ai get|set|runs, com --enabled, --agent e --daily-limit no set.

  MCP (catálogo completo): get_instagram_comment_ai, update_instagram_comment_ai e list_instagram_comment_ai_runs, com escopos agents:read/write, sem sandbox e anotações de efeito público. O perfil assistant permanece inalterado; PATCH via OAuth é exclusivo do painel.

## 0.15.0

### Minor Changes

- 45169ad: Webhooks por canal: `channel_account_ids` em create/update (ausente = todos no
  create e sem mudança no update; `null` volta a todos) e, na leitura,
  `channel_account_ids` e `channels_health` (saúde por canal, só dos canais em
  falha). CLI ganha `--channel-account-id` (repetível) e `--all-channels`, e mostra
  canais e saúde por canal em `webhooks get/list`. MCP aceita `channel_account_ids`
  em `create_webhook`/`update_webhook` e devolve os campos novos na saída
  estruturada.

## 0.14.0

### Minor Changes

- c75addc: Adiciona consulta, reassinatura e desconexão do Instagram e download binário do QR de Regras de mensagem no SDK, CLI e catálogo completo do MCP. Inclui ref_link, regras durante lives, condição de seguidor, perfil de seguidores nos contatos e filtros em contatos/conversas, preservando false, null e PATCH parcial. O MCP retorna link ig.me e imagem PNG; a desconexão é marcada como destrutiva. O catálogo assistant mantém sua composição, com os novos campos de contato expostos nas saídas de get_contact e list_contacts.

## 0.13.0

### Minor Changes

- 8d27c17: Busca de conhecimento híbrida: `AiKnowledgeHit` ganha `score` (fusão vetorial +
  textual), `vector_rank` e `text_rank`; `similarity` passa a ser `number | null`
  (nula quando o trecho veio só da busca por palavras).

## 0.12.0

### Minor Changes

- ab0ddbc: Add Instagram interactive button/card/gallery sends with human_agent and channel receipts, extended comment-rule fields and deletion, and messenger-profile read/update/delete/sync across SDK, CLI and MCP. Preserve WhatsApp interactive formats and partial PATCH semantics, and expose messenger-profile scopes and structured results.
- df51d96: Add Instagram comment-rule button and delivery fields, message-rule CRUD with trigger/action types and message-rules scopes, and comment-rule metrics by period across SDK, CLI and MCP. Preserve nullable fields and partial PATCH bodies, advertise typed MCP results, and support JSON input for comment and message rules in the CLI.

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
