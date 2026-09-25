---
"@botozap/cli": minor
---

`setup-links create` accepts `--connection-types`, `--language`, `--success-redirect-url` and `--failure-redirect-url` (it used to send an empty body), and its help explains the redirects: `status=completed` on success, `status=failed` when the link is exhausted, `status=cancelled` when the customer goes back on a retryable error (the link stays valid), always with `setup_link_id`; URLs must be `https`, without credentials, up to 2048 characters. There is no number provisioning option.
