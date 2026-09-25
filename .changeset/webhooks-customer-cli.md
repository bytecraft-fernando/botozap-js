---
"@botozap/cli": minor
---

`webhooks create` and `webhooks update` accept `--customer-id <uuid>` to limit deliveries to one Customer of the account; `webhooks update --clear-customer` removes the filter. The README no longer mentions WhatsApp Flows, which the API removed.
