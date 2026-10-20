---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Paridade com a API de 16 a 20/10/2026. Consentimento: pedido de consentimento
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
