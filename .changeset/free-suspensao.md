---
"@botozap/sdk": minor
"@botozap/cli": minor
"@botozap/mcp": minor
---

Limites do Free: 1 Cliente e 1 número. Quem passa do teto (por exemplo, depois do
teste grátis) fica suspenso, sem exclusão: continua recebendo, mas não envia, e
volta sozinho ao assinar. SDK: `plan_suspended?: boolean` em `Customer` e
`PhoneNumber`; `isFreeCap` (402 `free_cap`: 2º Cliente no Free ou envio por
Cliente suspenso) e `isFreeNumberCap` (402 `free_number_cap`: envio por Número
suspenso ou setup além do teto); `free_cap` entra em `PLAN_ERROR_CODES`, então
`isPlanError` passa a reconhecê-lo. Docs de `customers.create`, Regras de
mensagem e Perguntas e menu citam o 403 `plan_restricted` do Free. CLI: coluna
SUSPENSO em `customers list` e `numbers list`. MCP, só no catálogo completo:
`plan_suspended` na saída de `list_customers`, `get_customer`, `create_customer`,
`update_customer`, `list_phone_numbers`, `get_phone_number` e
`update_phone_number`, e descrições com as recusas do Free (`free_cap`,
`free_number_cap`, `plan_restricted`) em leituras, envios, `create_customer`,
Regras de mensagem e Perguntas e menu. O perfil `assistant` (OAuth) não muda:
mesmas tools, anotações, descrições e saída.
