# @botozap/cli

## 0.15.0

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
  (`AiEnabledProvider`) e as tools `ai_*` do MCP aceitam só esses dois (outro provedor
  responde 422 `provider_not_enabled`) e a leitura mantém os seis históricos.
  Descrições: `delete_contact` diz que a recusa fica guardada como código cifrado e
  que a mídia é apagada; `send_message` (só no catálogo completo) explica
  `consent_revoked` e `not_connected`; sai o rótulo `data_use_ack_required` do
  `agent-inbox`. Tudo novo do MCP fica só no catálogo completo (chave de API).

### Patch Changes

- Updated dependencies [532fd08]
  - @botozap/sdk@0.20.0

## 0.14.0

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

### Patch Changes

- Updated dependencies [8d6d00f]
  - @botozap/sdk@0.19.0

## 0.13.0

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

### Patch Changes

- Updated dependencies [48db398]
  - @botozap/sdk@0.18.0

## 0.12.0

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

### Patch Changes

- Updated dependencies [ed98a15]
  - @botozap/sdk@0.17.0

## 0.11.1

### Patch Changes

- ed42fd4: Remove a comparação com a Kapso da descrição da CLI (`--help`) e do README.
- 55d0eee: Setup links: `language` passa a ser descrito como aceito por compatibilidade e
  ignorado. A página do link é sempre em português e o link novo volta com
  `language: null`; antes, SDK, CLI (`--language`) e MCP (`create_setup_link`)
  diziam que o valor escolhia o idioma da página. O parâmetro continua aceito.
- Updated dependencies [55d0eee]
  - @botozap/sdk@0.16.1

## 0.11.0

### Minor Changes

- d51f908: Adiciona IA de comentários do Instagram (#740): configuração opt-in por Conta de canal, limite diário, prontidão e histórico paginado de decisões/envios.

  SDK: channelAccounts.getCommentAi, updateCommentAi e listCommentAiRuns, com tipos de configuração, histórico, custo de execução e evento de resposta. CLI: channel-accounts comment-ai get|set|runs, com --enabled, --agent e --daily-limit no set.

  MCP (catálogo completo): get_instagram_comment_ai, update_instagram_comment_ai e list_instagram_comment_ai_runs, com escopos agents:read/write, sem sandbox e anotações de efeito público. O perfil assistant permanece inalterado; PATCH via OAuth é exclusivo do painel.

### Patch Changes

- Updated dependencies [d51f908]
  - @botozap/sdk@0.16.0

## 0.10.0

### Minor Changes

- 45169ad: Webhooks por canal: `channel_account_ids` em create/update (ausente = todos no
  create e sem mudança no update; `null` volta a todos) e, na leitura,
  `channel_account_ids` e `channels_health` (saúde por canal, só dos canais em
  falha). CLI ganha `--channel-account-id` (repetível) e `--all-channels`, e mostra
  canais e saúde por canal em `webhooks get/list`. MCP aceita `channel_account_ids`
  em `create_webhook`/`update_webhook` e devolve os campos novos na saída
  estruturada.

### Patch Changes

- Updated dependencies [45169ad]
  - @botozap/sdk@0.15.0

## 0.9.0

### Minor Changes

- c75addc: Adiciona consulta, reassinatura e desconexão do Instagram e download binário do QR de Regras de mensagem no SDK, CLI e catálogo completo do MCP. Inclui ref_link, regras durante lives, condição de seguidor, perfil de seguidores nos contatos e filtros em contatos/conversas, preservando false, null e PATCH parcial. O MCP retorna link ig.me e imagem PNG; a desconexão é marcada como destrutiva. O catálogo assistant mantém sua composição, com os novos campos de contato expostos nas saídas de get_contact e list_contacts.

### Patch Changes

- Updated dependencies [c75addc]
  - @botozap/sdk@0.14.0

## 0.8.1

### Patch Changes

- Updated dependencies [8d27c17]
  - @botozap/sdk@0.13.0

## 0.8.0

### Minor Changes

- ab0ddbc: Add Instagram interactive button/card/gallery sends with human_agent and channel receipts, extended comment-rule fields and deletion, and messenger-profile read/update/delete/sync across SDK, CLI and MCP. Preserve WhatsApp interactive formats and partial PATCH semantics, and expose messenger-profile scopes and structured results.
- df51d96: Add Instagram comment-rule button and delivery fields, message-rule CRUD with trigger/action types and message-rules scopes, and comment-rule metrics by period across SDK, CLI and MCP. Preserve nullable fields and partial PATCH bodies, advertise typed MCP results, and support JSON input for comment and message rules in the CLI.

### Patch Changes

- Updated dependencies [ab0ddbc]
- Updated dependencies [df51d96]
  - @botozap/sdk@0.12.0

## 0.7.0

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

### Patch Changes

- Updated dependencies [0df58da]
  - @botozap/sdk@0.11.0

## 0.6.1

### Correções

- Atualiza a dependência interna para `@botozap/sdk@0.10.0`. O especificador `workspace:*` vira versão exata no tarball, por isso a CLI recebe patch para distribuir a dependência atualizada. Sem mudanças de comandos.

## 0.6.0

### Minor Changes

- Cover the API additions of 2026-09-29:

  - SDK: `messages.sendInteractive` (button/list/cta_url in Cloud API shape, typed as `InteractivePayload`), `messages.sendLocation` and `messages.sendReaction` (target is the internal UUID or wamid of a received message; `emoji: ""` removes it; `SendResult.reaction` echoes target and action). `messages.list({ sort: "created_at" | "event_at" })`; `Message.source` (`MessageSource`), `created_at`, `event_at` and `Conversation.last_message`. `WEBHOOK_CATEGORIES` with the opt-in `app_messages` category; `WebhookDeliveryStatus` gains `limited`. `ai.providers.get()` types `providers` as `AiProviderInfo` with `accepts_new_credentials`; `AI_CREDENTIAL_PROVIDERS` (openai, anthropic). `BotoZapErrorCode`, `PLAN_ERROR_CODES` and `isPlanError` for `plan_restricted`, `free_form_limit_reached` and `free_number_cap`.
  - CLI: `messages send-interactive`, `messages send-location`, `messages react` (`--remove`), `messages list --sort` and an ORIGEM column; help for `app_messages` and `limited`.
  - MCP: `send_message` accepts `interactive`, `location` and `reaction`; `list_messages` accepts `sort`; `send_message` output includes `reaction`; delivery status `limited`; webhook tools document `app_messages`.

### Patch Changes

- Updated dependencies
- Updated dependencies [ca116b8]
- Updated dependencies [ef10a36]
- Updated dependencies [bc67b0c]
- Updated dependencies [9453f19]
  - @botozap/sdk@0.9.0

## 0.5.0

### Minor Changes

- 505f0a6: `setup-links create` accepts `--connection-types`, `--language`, `--success-redirect-url` and `--failure-redirect-url` (it used to send an empty body), and its help explains the redirects: `status=completed` on success, `status=failed` when the link is exhausted, `status=cancelled` when the customer goes back on a retryable error (the link stays valid), always with `setup_link_id`; URLs must be `https`, without credentials, up to 2048 characters. There is no number provisioning option.

### Patch Changes

- Updated dependencies [505f0a6]
  - @botozap/sdk@0.8.0

## 0.4.0

### Minor Changes

- 5ffc8f4: `contacts create`/`contacts update` accept `--display-name`, and `contacts update --clear-display-name` removes it. New `numbers update <id> --label <name>` (or `--clear-label`) and `usage meta-costs [--customer-id] [--from] [--to]`, which prints missing Meta cost as "indisponível", never 0. `numbers list` shows the label and the connection status (the status column used to read a field the API does not return), and `conversations list` shows contact, origin (`entry_point`) and last message time.

### Patch Changes

- Updated dependencies [5ffc8f4]
  - @botozap/sdk@0.7.0

## 0.3.1

### Patch Changes

- Updated dependencies [5e435ea]
  - @botozap/sdk@0.6.0

## 0.3.0

### Minor Changes

- 4127500: `webhooks create` and `webhooks update` accept `--customer-id <uuid>` to limit deliveries to one Customer of the account; `webhooks update --clear-customer` removes the filter. The README no longer mentions WhatsApp Flows, which the API removed.

### Patch Changes

- Updated dependencies [eda9708]
- Updated dependencies [4127500]
- Updated dependencies [3b79628]
  - @botozap/sdk@0.5.0

## 0.2.0

### Minor Changes

- Add complete shared saved replies, Inbox notes/reminders/operator state, CRM opportunities and demands, Radar stage criteria and appointment alerts, journey configuration and run control, appointment scheduling and Google Calendar operations, and complete BYOK AI agents with versioned configuration, provider credentials, knowledge, memory, skills, follow-up graphs, routing, cases, alerts, notices, reviewed proposals, executions and usage. Add contact stage/field discovery and complete assignment management in CLI/MCP. Preserve server CAS, pagination, idempotency and account identity boundaries. Previously published methods remain available. The unpublished legacy agents draft is replaced by /ai; no managed credits or paid agent slots. Include #498 agent parity: commercial proposals, eligibility gate with explicit open-to-all confirmation, inference ledger, operator promises, knowledge diagnostics/catalog sync/citations/coverage, memory reactivation, skill near-miss curation, notice diagnostics, provider catalog snapshots, case timeline, bulk alert resolution, promised returns, the unified follow-up queue, capability usage, the evolution panel, style adjustments and the additive execution security trail; granular BYOK purposes, extended agent configuration and 20 MiB direct document uploads. Contacts accept `tags` on create, `tags`/`add_tags`/`remove_tags` on update and return `tags` (up to 20 × 40 characters).

### Patch Changes

- Updated dependencies
  - @botozap/sdk@0.4.0

## 0.1.4

### Patch Changes

- Publica tarballs com a dependência do SDK resolvida para uma versão do registro,
  sem expor o protocolo interno `workspace:*` aos consumidores do npm.

## 0.1.3

### Patch Changes

- Updated dependencies [05e1c9f]
  - @botozap/sdk@0.3.2

## 0.1.2

### Patch Changes

- Publica novamente o candidato agent-native validado em versões patch para
  promovê-lo diretamente ao canal `latest` do npm.
- Updated dependencies
  - @botozap/sdk@0.3.1

## 0.1.1

### Patch Changes

- Updated dependencies [05733ec]
- Updated dependencies [de26959]
- Updated dependencies [e923a96]
- Updated dependencies [da01362]
- Updated dependencies [42c65ef]
  - @botozap/sdk@0.3.0
