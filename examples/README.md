# Exemplos

Todos os exemplos consomem **apenas pacotes públicos** (no checkout, via
workspace) — nada do core privado. Nenhum exemplo contém credencial real:
API keys entram sempre por variável de ambiente (`BOTOZAP_API_KEY`,
`BOTOZAP_WEBHOOK_SECRET`).

| Exemplo | O que mostra |
| --- | --- |
| [`node-javascript`](./node-javascript) | envio sandbox, leitura da resposta, `BotoZapError` |
| [`node-typescript`](./node-typescript) | envio sandbox tipado, leitura paginada por cursor, erro estruturado |
| [`webhook-receiver`](./webhook-receiver) | bytes crus + HMAC constant-time + idempotência transacional + ACK 2xx pós-commit |
| [`mcp-sandbox`](./mcp-sandbox) | configuração mínima do `@botozap/mcp` com chave sandbox |
