---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Plano e slots adicionais (só chave de API, scopes `billing:read` e
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
