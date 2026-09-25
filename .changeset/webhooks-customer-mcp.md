---
"@botozap/mcp": minor
---

`create_webhook` and `update_webhook` accept `customer_id` (on update, `null` removes the filter), and the webhook output schema declares `customer_id`.
