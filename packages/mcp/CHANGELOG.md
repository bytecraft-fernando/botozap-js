# @botozap/mcp

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
