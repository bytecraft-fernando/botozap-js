---
"@botozap/sdk": minor
---

Cover the API additions of 2026-09-25:

- `Contact.display_name` (the name the business gives the contact, 1–200 characters; `null` when unset) and `display_name` on `CreateContactParams`/`UpdateContactParams` (`null` or `""` clears it). It is independent from `profile_name`, which comes from the channel.
- `phoneNumbers.update(id, { label })` is back: `PATCH /v1/phone_numbers/:id` now accepts the local `label` (up to 100 characters, no control characters; `null` or `""` clears). `PhoneNumber.label` is typed and `UpdatePhoneNumberParams` is exported.
- New `usage.metaCosts({ customer_id?, from?, to? })` for `GET /v1/usage/meta-costs` (scope `customers:read`), fully typed as `MetaCostReport` (per-currency `totals`, `by_day`, `by_category` with `cost`, `estimated_cost` and `cost_source`; `unavailable`/`unavailable_reason`, `estimate` and `sync`). Missing Meta cost stays `null`, never `0`.
- `Conversation` declares `entry_point` (`"ctwa" | "organic" | null`), `referral` (`ConversationReferral`: `source_id`, `source_url`, `headline`, `ctwa_clid`, `received_at`), `fep_expires_at` and `fep_reply_by`.
