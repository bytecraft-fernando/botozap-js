---
"@botozap/mcp": patch
---

Remoto: sessões duram mais para hosts que abrem várias sessões (Grok, ChatGPT).
O teto por credencial sobe de 5 para 16 e a ociosidade de 5 para 15 minutos;
antes, a sessão em uso era reciclada e as tools respondiam "Sessão MCP
inválida". O 404 de sessão desconhecida agora registra no log se ela foi
recolhida (ociosa/teto) ou nunca existiu.
