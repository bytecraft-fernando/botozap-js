---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Cor de marca da página do link de setup: `theme_config` deixa de ser reservado. `customers.createSetupLink` e `customers.updateSetupLink` aceitam `theme_config: { primary_color: "#RRGGBB" }` (formato da Kapso; as outras chaves são aceitas e ignoradas; `null` no update volta às cores padrão), e o `SetupLink` devolve `theme_config` como `SetupLinkTheme | null`. No MCP, `create_setup_link` e `update_setup_link` ganham `theme_config`; na CLI, `setup-links create --primary-color` e `setup-links update --primary-color` ou `--clear-color`.

Tipos: `SetupLink.theme_config` deixa de ser `unknown` e passa a `SetupLinkTheme | null`. Quem monta um `SetupLink` à mão (num mock, por exemplo) com outro valor precisa ajustar.

Publicação: numa API sem `theme_config`, a cor é ignorada em silêncio no create e no update que também leve `status` ou `expires_at`, e o link volta com `theme_config: null`; um update só com `theme_config` (`--primary-color` ou `--clear-color` sozinhos na CLI) recebe `422 no_fields`. O schema de saída do MCP aceita os dois, então não há ordem de publicação obrigatória.
