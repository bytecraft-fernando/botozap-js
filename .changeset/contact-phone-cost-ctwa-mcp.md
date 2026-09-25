---
"@botozap/mcp": minor
---

New tools `update_phone_number` (sets or clears the local `label`) and `get_meta_costs` (approximate Meta cost per currency, day and category; missing cost stays `null`). `create_contact` and `update_contact` accept `display_name` (`null` clears). Output schemas declare `display_name` on contacts, `label` on phone numbers and `entry_point`, `referral`, `fep_expires_at` and `fep_reply_by` on conversations.
