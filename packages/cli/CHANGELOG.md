# @botozap/cli

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
