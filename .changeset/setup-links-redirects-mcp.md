---
"@botozap/mcp": minor
---

**Breaking:** `create_setup_link` no longer accepts `provision_phone_number` (it never had any effect; the value is dropped before the request) and the setup link output schema no longer declares it. The tool and schema descriptions now explain the redirects (`https` only, no credentials, up to 2048 characters; `status=completed`, `status=failed` or `status=cancelled` plus `setup_link_id`) and mark `theme_config` as reserved (always `null`).
