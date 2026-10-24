# @botozap/mcp

## 0.20.0

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

### Patch Changes

- Updated dependencies [394ca5e]
  - @botozap/sdk@0.23.0

## 0.19.0

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

### Patch Changes

- 8eba0bc: Prévia de template: o código de cupom do botão COPY_CODE aceita até 20 caracteres, como a
  Meta (OTP de autenticação segue em 15).
- Updated dependencies [8eba0bc]
  - @botozap/sdk@0.22.0

## 0.18.0

### Minor Changes

- 03f25cd: Entregas de webhook por canal: `webhookDeliveries.list` aceita
  `channel_account_id` (o uuid do canal, ou `none` para as entregas sem canal,
  como o teste), e cada entrega traz `channel_account_id`. CLI:
  `deliveries list --channel-account-id <id>` e a coluna HTTP volta a mostrar o
  código da resposta. MCP: `list_webhook_deliveries` aceita `channel_account_id`.

### Patch Changes

- Updated dependencies [03f25cd]
  - @botozap/sdk@0.21.0

## 0.17.1

### Patch Changes

- Updated dependencies [bef36f5]
  - @botozap/sdk@0.20.1

## 0.17.0

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

### Patch Changes

- Updated dependencies [532fd08]
  - @botozap/sdk@0.20.0

## 0.16.0

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

## 0.15.0

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

## 0.14.0

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

- ddd7d73: Anotações das ferramentas revisadas pelo comportamento real: todas as tools
  (catálogo completo e perfil `assistant`) passam a declarar `readOnlyHint`,
  `destructiveHint`, `idempotentHint` e `openWorldHint` como booleanos explícitos,
  validados na inicialização. Correções: `create_appointment`, `create_journey`,
  `create_comment_rule` e `create_message_rule` passam a `destructiveHint: true`
  (podem iniciar envios automáticos ao contato); `create_template` passa a
  `destructiveHint: false` (nunca sobrescreve; nome repetido é recusado);
  `ai_cases_update` é `openWorldHint: true` nos dois catálogos (retomar a IA faz o
  agente responder o contato); `ai_alerts_update` passa a `destructiveHint: false`
  (o alerta pode ser reaberto). Nomes, schemas e descrições não mudam.
- Updated dependencies [ed98a15]
  - @botozap/sdk@0.17.0

## 0.13.1

### Patch Changes

- 55d0eee: Setup links: `language` passa a ser descrito como aceito por compatibilidade e
  ignorado. A página do link é sempre em português e o link novo volta com
  `language: null`; antes, SDK, CLI (`--language`) e MCP (`create_setup_link`)
  diziam que o valor escolhia o idioma da página. O parâmetro continua aceito.
- Updated dependencies [55d0eee]
  - @botozap/sdk@0.16.1

## 0.13.0

### Minor Changes

- d51f908: Adiciona IA de comentários do Instagram (#740): configuração opt-in por Conta de canal, limite diário, prontidão e histórico paginado de decisões/envios.

  SDK: channelAccounts.getCommentAi, updateCommentAi e listCommentAiRuns, com tipos de configuração, histórico, custo de execução e evento de resposta. CLI: channel-accounts comment-ai get|set|runs, com --enabled, --agent e --daily-limit no set.

  MCP (catálogo completo): get_instagram_comment_ai, update_instagram_comment_ai e list_instagram_comment_ai_runs, com escopos agents:read/write, sem sandbox e anotações de efeito público. O perfil assistant permanece inalterado; PATCH via OAuth é exclusivo do painel.

### Patch Changes

- Updated dependencies [d51f908]
  - @botozap/sdk@0.16.0

## 0.12.0

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

## 0.11.0

### Minor Changes

- c75addc: Adiciona consulta, reassinatura e desconexão do Instagram e download binário do QR de Regras de mensagem no SDK, CLI e catálogo completo do MCP. Inclui ref_link, regras durante lives, condição de seguidor, perfil de seguidores nos contatos e filtros em contatos/conversas, preservando false, null e PATCH parcial. O MCP retorna link ig.me e imagem PNG; a desconexão é marcada como destrutiva. O catálogo assistant mantém sua composição, com os novos campos de contato expostos nas saídas de get_contact e list_contacts.

### Patch Changes

- Updated dependencies [c75addc]
  - @botozap/sdk@0.14.0

## 0.10.1

### Patch Changes

- Updated dependencies [8d27c17]
  - @botozap/sdk@0.13.0

## 0.10.0

### Minor Changes

- ab0ddbc: Add Instagram interactive button/card/gallery sends with human_agent and channel receipts, extended comment-rule fields and deletion, and messenger-profile read/update/delete/sync across SDK, CLI and MCP. Preserve WhatsApp interactive formats and partial PATCH semantics, and expose messenger-profile scopes and structured results.
- df51d96: Add Instagram comment-rule button and delivery fields, message-rule CRUD with trigger/action types and message-rules scopes, and comment-rule metrics by period across SDK, CLI and MCP. Preserve nullable fields and partial PATCH bodies, advertise typed MCP results, and support JSON input for comment and message rules in the CLI.

### Patch Changes

- 6398108: `/healthz` também responde a `HEAD` (200, sem corpo), para monitores externos que checam só com `HEAD`.
- 7dd7d16: Remoto: POST com sessão desconhecida e credencial válida é atendido sem sessão
  em vez de 404. Hosts que não reabrem a sessão após o 404 (Grok) seguiam
  chamando tools com um id antigo — de antes de um deploy ou já reciclado — e
  ficavam presos em "Sessão MCP inválida". `initialize`, GET (SSE) e sessão viva
  de outra credencial continuam 404.
- 4dfe117: Remoto: sessões duram mais para hosts que abrem várias sessões (Grok, ChatGPT).
  O teto por credencial sobe de 5 para 16 e a ociosidade de 5 para 15 minutos;
  antes, a sessão em uso era reciclada e as tools respondiam "Sessão MCP
  inválida". O 404 de sessão desconhecida agora registra no log se ela foi
  recolhida (ociosa/teto) ou nunca existiu.
- Updated dependencies [ab0ddbc]
- Updated dependencies [df51d96]
  - @botozap/sdk@0.12.0

## 0.9.0

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

## 0.8.3

### Correções

- Corrige a tela de template aprovado para filtrar pela conexão WABA do número autorizado, em vez de passar um UUID interno como ID Meta. Pré-seleciona o template solicitado por ID ou nome e preenche sugestões por ambos, com suporte aos parâmetros posicionais e nomeados. Janela aberta recebe rótulo adequado e permite preparar templates aprovados.

  Orienta administração, webhooks e credenciais de IA exclusivamente para o painel BotoZap, sem sugerir expor ações no plugin ou pedir segredos no chat.

## 0.8.2

### Correções

- Corrige o plantão sem `message_id`: acompanha a última mensagem enviada na conversa e mostra imediatamente o status atual do recibo, sem depender de eventos novos. Informa quando nenhuma mensagem enviada foi encontrada e preserva a leitura de respostas e digitação autorizadas.

  Orienta pedidos de acompanhar, monitorar, ver status ou "follow" somente para leitura, sem enviar, reenviar ou preparar outra mensagem. Todas as telas preferem abrir inline; a expansão exige clique explícito, inclusive ao trocar para template ou revisão de atendimento.

## 0.8.1

### Correções

- Corrige os schemas de contatos, conversas e mensagens para aceitar `phone_number_id` nulo no Instagram e preservar identidades WhatsApp com BSUID sem telefone. Remove campos aditivos de objetos tipados e paginação antes de devolver o resultado validado ao cliente MCP.

  Resolve revisão e envio pela conta de canal autorizada no Instagram, preserva o destinatário canônico e a confirmação explícita e adapta a exibição de identidade e as ações exclusivas do WhatsApp ao canal da conversa.

- Orienta `open_botozap` e `list_radar` como alternativas com UI habilitada, evitando telas duplicadas de Pendências. Pedidos de pendências e resposta usam no máximo uma tela de pendências antes do card; se preparar resposta é o objetivo principal e o radar está vazio, seguem direto ao card, com descoberta de IDs por consultas sem UI.

## 0.8.0

### Novidades

- Integra oito telas MCP Apps: pendências, revisão de resposta, Radar/conversa, template aprovado, plantão ao vivo, casos da IA, agendamento e entrada global com deep links. Ações de envio e retomada exigem confirmação explícita; acompanhamento ao vivo usa PiP quando suportado e fallback inline.
- Versiona URIs pelo conteúdo e metadados; declara CSP em todos os recursos, domínio configurável e rota de desafio de verificação do domínio.
- Agrupa alertas não resolvidos, conversas pausadas e casos por conversa, com prévias conforme o contrato real, motivos traduzidos e descoberta autorizada dos negócios sem abrir outra tela.
- Orienta escolha entre tools diretas e UI conforme o pedido e a disponibilidade da UI, preservando o catálogo padrão sem UI.
- Usa o nome da conta no perfil e cache compartilhado de identidade por instância, TTL de 60 segundos e isolamento por hash da credencial/URL. Falhas não são guardadas; vinculação OAuth e autorização da API permanecem em cada operação.
- Limita sessões OAuth ao perfil `assistant` por padrão, com mapeamento opcional por `client_id`, títulos/descrições claros e hints revisados. API keys preservam o catálogo completo; tools fora do perfil são omitidas e chamadas diretas recusadas, inclusive após atualizar a identidade.
- Atualiza a dependência exata do tarball para `@botozap/sdk@0.10.0`.

## 0.7.0

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
- Updated dependencies
- Updated dependencies [ca116b8]
- Updated dependencies [ef10a36]
- Updated dependencies [bc67b0c]
- Updated dependencies [9453f19]
  - @botozap/sdk@0.9.0

## 0.6.0

### Minor Changes

- 505f0a6: **Breaking:** `create_setup_link` no longer accepts `provision_phone_number` (it never had any effect; the value is dropped before the request) and the setup link output schema no longer declares it. The tool and schema descriptions now explain the redirects (`https` only, no credentials, up to 2048 characters; `status=completed`, `status=failed` or `status=cancelled` plus `setup_link_id`) and mark `theme_config` as reserved (always `null`).

### Patch Changes

- Updated dependencies [505f0a6]
  - @botozap/sdk@0.8.0

## 0.5.0

### Minor Changes

- 5ffc8f4: New tools `update_phone_number` (sets or clears the local `label`) and `get_meta_costs` (approximate Meta cost per currency, day and category; missing cost stays `null`). `create_contact` and `update_contact` accept `display_name` (`null` clears). Output schemas declare `display_name` on contacts, `label` on phone numbers and `entry_point`, `referral`, `fep_expires_at` and `fep_reply_by` on conversations.

### Patch Changes

- Updated dependencies [5ffc8f4]
  - @botozap/sdk@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [5e435ea]
  - @botozap/sdk@0.6.0

## 0.4.0

### Minor Changes

- 4127500: `create_webhook` and `update_webhook` accept `customer_id` (on update, `null` removes the filter), and the webhook output schema declares `customer_id`.

### Patch Changes

- Updated dependencies [eda9708]
- Updated dependencies [4127500]
- Updated dependencies [3b79628]
  - @botozap/sdk@0.5.0

## 0.3.0

### Minor Changes

- Add complete shared saved replies, Inbox notes/reminders/operator state, CRM opportunities and demands, Radar stage criteria and appointment alerts, journey configuration and run control, appointment scheduling and Google Calendar operations, and complete BYOK AI agents with versioned configuration, provider credentials, knowledge, memory, skills, follow-up graphs, routing, cases, alerts, notices, reviewed proposals, executions and usage. Add contact stage/field discovery and complete assignment management in CLI/MCP. Preserve server CAS, pagination, idempotency and account identity boundaries. Previously published methods remain available. The unpublished legacy agents draft is replaced by /ai; no managed credits or paid agent slots. Include #498 agent parity: commercial proposals, eligibility gate with explicit open-to-all confirmation, inference ledger, operator promises, knowledge diagnostics/catalog sync/citations/coverage, memory reactivation, skill near-miss curation, notice diagnostics, provider catalog snapshots, case timeline, bulk alert resolution, promised returns, the unified follow-up queue, capability usage, the evolution panel, style adjustments and the additive execution security trail; granular BYOK purposes, extended agent configuration and 20 MiB direct document uploads. Contacts accept `tags` on create, `tags`/`add_tags`/`remove_tags` on update and return `tags` (up to 20 × 40 characters).

### Patch Changes

- Updated dependencies
  - @botozap/sdk@0.4.0

## 0.2.6

### Patch Changes

- Corrige o artefato público que carregava `@botozap/sdk: workspace:*` na 0.2.5.
  A release é empacotada por pnpm e validada antes da instalação, sem permitir que
  overrides escondam dependências locais. Atualiza os quickstarts do pacote.

## 0.2.5

### Patch Changes

- 5219ae0: Recicla no teto a sessão mais antiga da mesma credencial quando ela mantém
  somente o listener GET/SSE aberto, sem interromper POSTs MCP em andamento.

## 0.2.4

### Patch Changes

- Publica tarballs com a dependência do SDK resolvida para uma versão do registro,
  sem expor o protocolo interno `workspace:*` aos consumidores do npm.

## 0.2.3

### Patch Changes

- 05e1c9f: Adiciona `headers.Authorization` aos Endpoints de webhook. O valor é aceito
  somente na escrita, nunca aparece nos resultados do SDK/MCP e é persistido no
  Vault pelo core BotoZap.
- e5ba3e0: Recupera a capacidade de sessão ao substituir a conexão abandonada mais antiga
  da mesma credencial quando o teto é atingido, sem preemptar requests ativos.
- Updated dependencies [05e1c9f]
  - @botozap/sdk@0.3.2

## 0.2.2

### Patch Changes

- 94912b5: Endurece o transporte Streamable HTTP para exposição pública com allowlists de
  Host e Origin, readiness em `/healthz`, rate limits antes da autenticação,
  timeouts defensivos, allowlist de proxy/CIDR e recusa de bind público inseguro.

## 0.2.1

### Patch Changes

- Publica novamente o candidato agent-native validado em versões patch para
  promovê-lo diretamente ao canal `latest` do npm.
- Updated dependencies
  - @botozap/sdk@0.3.1

## 0.2.0

### Minor Changes

- 05733ec: Adiciona o stream durável `events.list` ao SDK e um resource MCP assinável por
  cursor. O servidor stdio anuncia subscriptions, envia
  `notifications/resources/updated` enquanto a assinatura está ativa e preserva
  as tools e o fallback de replay após reconexão.
- de26959: Adiciona output schemas e structured content às tools centrais de Mensagens,
  Números e Templates, preservando o fallback textual e expondo erros estruturados.
  Sincroniza também o tipo `SendResult` do SDK com o campo aditivo `sent_to` da API.
- 2b68e8a: Adiciona transporte remoto Streamable HTTP stateful, autenticação Bearer presa à
  sessão e notifications de Eventos entre processos por event bus PostgreSQL,
  preservando o transporte stdio e todas as tools existentes.
- d3b1e57: Completa output schemas e structured content nas 35 tools publicadas, incluindo
  paginação, gestão e operações sem corpo, com fallback textual compatível.
- da01362: Adiciona `conversations.reply` ao SDK e a tool MCP
  `reply_to_conversation`, que resolvem Contato e Número pela Conversa e
  delegam ao endpoint canônico de mensagens, preservando janela, quota, billing
  e isolamento multi-tenant no servidor.
- 42c65ef: Adiciona envio tipado de image, video, audio e document pelo SDK e pela tool MCP `send_media_message`, com limites e campos específicos por tipo.

### Patch Changes

- e923a96: Torna o push remoto resiliente a queda ou indisponibilidade inicial do event
  bus, sinais concorrentes, restart e clientes abandonados. Adiciona heartbeat de
  reconciliação por cursor, limites de sessão/assinatura, cleanup por cancelamento
  ou expiração e testes de carga e isolamento entre Conta e ambiente. Leituras de
  Eventos do SDK agora aceitam `AbortSignal`, permitindo cancelar I/O em voo.
- Updated dependencies [05733ec]
- Updated dependencies [de26959]
- Updated dependencies [e923a96]
- Updated dependencies [da01362]
- Updated dependencies [42c65ef]
  - @botozap/sdk@0.3.0
