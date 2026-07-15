# Exemplo — Node.js (TypeScript)

Envio sandbox **tipado**, leitura **paginada por cursor** e erro estruturado
(`BotoZapError`) com `@botozap/sdk`.

> Os pacotes ainda não estão publicados no npm — este exemplo roda dentro do
> monorepo (workspace pnpm). A chave sandbox (`bz_sandbox_`) só tem acesso às
> rotas de mensagens (allow-list do sandbox) — exatamente o que este exemplo usa.

## Rodar

```bash
# na raiz do monorepo
pnpm install
pnpm --filter @botozap/sdk build

cd examples/node-typescript
BOTOZAP_API_KEY=bz_sandbox_xxx pnpm start
```

## O que ele mostra

- `SendResult` e `Message` importados do SDK — tipos e runtime coincidem;
- paginação por cursor: listas devolvem `{ data, paging }` inteiro e a próxima
  página vem de `paging.next`;
- `BotoZapError` com `code`/`status`/`message`/`headers` (429 → `Retry-After`).
