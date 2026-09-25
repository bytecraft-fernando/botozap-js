---
"@botozap/sdk": minor
---

**Breaking (types only):** remove `provision_phone_number` from `CreateSetupLinkParams` and `SetupLink`. Number provisioning is not offered: the option never had any effect and the API ignores it and stops returning it. Code that still passes it gets a TypeScript error; just drop the field. No runtime change.

Document the setup link redirects as the API ships them: `success_redirect_url`/`failure_redirect_url` must be `https://`, without credentials and up to 2048 characters (otherwise `422 invalid_redirect_url`). After a final state the customer goes to the success URL with `setup_link_id` and `status=completed`, to the failure URL with `status=failed` when the link is exhausted, or with `status=cancelled` when they choose to go back on a retryable error (the link stays valid). The partner's query string is preserved and the link token is never sent. `theme_config` is documented as reserved (always `null`).
