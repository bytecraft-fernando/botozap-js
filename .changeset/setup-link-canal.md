---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Link de setup com canal: cada link conecta um canal só, `whatsapp` (padrão) ou
`instagram`. No Instagram, o Cliente confirma que a conta é profissional e que as
mensagens estão liberadas e entra com o Instagram; `allowed_connection_types` não
vale (a API responde `422 invalid_connection_types`) e o link volta com
`allowed_connection_types: []` e `url` em `/instagram/setup/<token>`. Canal fora
desses dois responde `422 invalid_channel`. `whatsapp_setup_status` mantém o nome
e vale para os dois canais.

SDK: `channel?: "whatsapp" | "instagram"` em `CreateSetupLinkParams` e
`channel: "whatsapp" | "instagram"` em `SetupLink`. CLI: `setup-links create
--channel <whatsapp|instagram>` e coluna CANAL no `setup-links list`. MCP:
`create_setup_link` aceita `channel` opcional (padrão `whatsapp`) e o schema de
saída dos links de setup passa a trazer `channel`.

Requer a API com o campo `channel` nos links de setup (app BotoZap, branch
`feat/setup-link-instagram`): publique o MCP só depois desse deploy, porque o
schema de saída exige `channel`.
