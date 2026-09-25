---
"@botozap/sdk": minor
---

**Breaking:** remove WhatsApp Flows (`client.flows`, the `Flow`/`FlowVersion` types and the `CreateFlowParams`/`ListFlowsParams`/`FlowPhoneParams`/`CreateFlowVersionParams`/`SetFlowDataEndpointParams` exports). The API no longer serves `/v1/flows/*`; every call already failed with 404. AI follow-up flows (`ai.followupFlows`) are unaffected.

Align three types with the API:

- `CreateWebhookParams`/`UpdateWebhookParams` accept `customer_id` (limits deliveries to one Customer of the account; `null` on update removes the filter) and `Webhook` declares `customer_id`.
- **Breaking (types only):** `broadcasts.addRecipients` takes `BroadcastRecipientInput[]` (`{ to_recipient, components? }`) instead of `unknown[]`; plain strings were always rejected per item by the API. `AddRecipientsResult.errors` is typed as `AddRecipientsError[]` (`{ index, to_recipient?, reason }`).
- **Breaking (types only):** `BotoZapEvent.message_id` is `string | null` (the WhatsApp `wamid`, `null` outside WhatsApp) and the event declares `external_id` (channel message id: `wamid` on WhatsApp, `mid` on Instagram).
