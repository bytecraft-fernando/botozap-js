---
"@botozap/mcp": patch
---

Anotações das ferramentas revisadas pelo comportamento real: todas as tools
(catálogo completo e perfil `assistant`) passam a declarar `readOnlyHint`,
`destructiveHint`, `idempotentHint` e `openWorldHint` como booleanos explícitos,
validados na inicialização. Correções: `create_appointment`, `create_journey`,
`create_comment_rule` e `create_message_rule` passam a `destructiveHint: true`
(podem iniciar envios automáticos ao contato); `create_template` passa a
`destructiveHint: false` (nunca sobrescreve; nome repetido é recusado);
`ai_cases_update` é `openWorldHint: true` nos dois catálogos (retomar a IA faz o
agente responder o contato); `ai_alerts_update` passa a `destructiveHint: false`
(o alerta pode ser reaberto). Nomes, schemas e descrições não mudam.
