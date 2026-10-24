---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Código da Meta nas recusas e reenvio de entrega de webhook.

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
