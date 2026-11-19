---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Cor de marca da página do link de setup: `theme_config` deixa de ser reservado. `customers.createSetupLink` e `customers.updateSetupLink` aceitam `theme_config: { primary_color: "#RRGGBB" }` (formato da Kapso; as outras chaves são aceitas e ignoradas; `null` no update volta às cores padrão), e o `SetupLink` devolve `theme_config` como `SetupLinkTheme | null`. No MCP, `create_setup_link` e `update_setup_link` ganham `theme_config`; na CLI, `setup-links create --primary-color` e `setup-links update --primary-color` ou `--clear-color`.
