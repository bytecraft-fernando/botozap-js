---
"@botozap/sdk": minor
"@botozap/mcp": minor
---

Add optional `idempotencyKey` options to `messages.send`, `sendTemplate`, `sendMedia` and `conversations.reply`. Calls without this option retain their existing HTTP payload and behavior.

MCP send tools accept optional `idempotency_key`: call the read-only `prepare_send_intent` once before a new send, or reuse `draft.idempotency_key` returned by `stage_review_reply`. Keep the same key and payload after a timeout. Never generate a replacement key to bypass pending/conflicting sends. Existing tool calls remain valid without a key or preparation step and retain legacy behavior. New review UI sends always include a key; public API clients and ordinary SDK callers may also continue omitting the header.

Add an opt-in MCP Apps review panel (`BOTOZAP_MCP_UI_ENABLED=true`), thread entrypoint, Radar/history context, explicit confirmation and retry using the original intent. The UI bundle is packaged locally with no external assets. Deploy API idempotency support before upgrading these send tools. Plugin manifests are local candidates, not published directory listings.
