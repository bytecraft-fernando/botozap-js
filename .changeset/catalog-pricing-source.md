---
"@botozap/sdk": patch
---

Type `pricing.source` on `AiCatalogModel`. `"openrouter"` marks a reference list price of the provider's own endpoint read from OpenRouter's public catalog, used when the provider's model list has no prices (OpenAI, Anthropic, Google, DeepSeek). Absent means the price came from the provider itself.
