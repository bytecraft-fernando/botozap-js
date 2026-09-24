# @botozap/cli

## 0.2.0

> Candidata ainda não publicada no npm (#498); a publicação depende de autorização explícita.

### Minor Changes

- Add complete shared saved replies, Inbox notes/reminders/operator state, CRM opportunities and demands, Radar stage criteria and appointment alerts, journey configuration and run control, appointment scheduling and Google Calendar operations, and complete BYOK AI agents with versioned configuration, provider credentials, knowledge, memory, skills, follow-up graphs, routing, cases, alerts, notices, reviewed proposals, executions and usage. Add contact stage/field discovery and complete assignment management in CLI/MCP. Preserve server CAS, pagination, idempotency and account identity boundaries. Previously published methods remain available. The unpublished legacy agents draft is replaced by /ai; no managed credits or paid agent slots. Include #498 agent parity: commercial proposals, eligibility gate with explicit open-to-all confirmation, inference ledger, operator promises, knowledge diagnostics/catalog sync/citations/coverage, memory reactivation, skill near-miss curation, notice diagnostics, provider catalog snapshots, case timeline, bulk alert resolution, promised returns and the unified follow-up queue; granular BYOK purposes, extended agent configuration and 20 MiB direct document uploads. Contacts accept `tags` on create, `tags`/`add_tags`/`remove_tags` on update and return `tags` (up to 20 × 40 characters).

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
