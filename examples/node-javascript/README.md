# Exemplo — Node.js (JavaScript)

Envio de mensagem no **sandbox determinístico** do BotoZap com `@botozap/sdk`:
sem credenciais Meta, sem número real, sem custo.

> Os pacotes ainda não estão publicados no npm — este exemplo roda dentro do
> monorepo (workspace pnpm).

## Rodar

```bash
# na raiz do monorepo
pnpm install
pnpm --filter @botozap/sdk build

# gere uma chave SANDBOX (bz_sandbox_…) em /chaves no painel
cd examples/node-javascript
BOTOZAP_API_KEY=bz_sandbox_xxx node index.mjs
```

## O que ele mostra

- `boto.messages.send()` — a resposta do `POST /messages` vem direta (sem
  envelope `{ data }`), com `wamid`, `status` e `sandbox: true`;
- tratamento de `BotoZapError` — `code`, `status`, `message` e `headers`
  (útil no `429` para ler `Retry-After`/`X-RateLimit-*`);
- números mágicos do sandbox (`+5500000000001/2/3`) para simular entrega,
  falha e resposta inbound.
