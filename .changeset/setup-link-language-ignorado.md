---
"@botozap/sdk": patch
"@botozap/cli": patch
"@botozap/mcp": patch
---

Setup links: `language` passa a ser descrito como aceito por compatibilidade e
ignorado. A página do link é sempre em português e o link novo volta com
`language: null`; antes, SDK, CLI (`--language`) e MCP (`create_setup_link`)
diziam que o valor escolhia o idioma da página. O parâmetro continua aceito.
