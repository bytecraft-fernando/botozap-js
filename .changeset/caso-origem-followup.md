---
"@botozap/sdk": patch
---

Casos abertos pela etapa "Avisar a equipe" de um follow-up têm a origem `followup`: `AiCaseSource` passa a incluí-la, na leitura do caso e no filtro `source` de `ai.cases.list`. O filtro de `ai_cases_list` no MCP fica como está, porque a definição anunciada ao ChatGPT é congelada (nova revisão da OpenAI); a origem aparece normalmente nos casos que ele devolve.
