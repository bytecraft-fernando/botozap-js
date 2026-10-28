---
"@botozap/sdk": minor
"@botozap/mcp": minor
---

Declaração do dono em follow-up de Marketing.

- `AiFlowSettings.marketing_consent` (`required` | `declared`, só em
  `marketing`): com `declared`, quem publica declara que os contatos do fluxo
  autorizaram marketing. No envio, contato sem registro ganha `granted` com a
  origem nova `owner_declaration`; `revoked` sempre bloqueia. O MCP aceita o
  campo nas configurações do fluxo.
- `ConsentOrigin` ganha `owner_declaration`, e as descrições do MCP e os READMEs
  citam a origem.
