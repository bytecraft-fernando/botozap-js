# @botozap/mcp

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
