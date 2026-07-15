# botozap-js

Monorepo das ferramentas públicas do [BotoZap](https://botozap.com.br) — a
plataforma dev-first multi-tenant sobre a WhatsApp Cloud API oficial. O core da
plataforma é fechado; o que vive aqui é a camada que ajuda quem integra.

> **Status: em preparação.** Os pacotes ainda **não** estão publicados no npm.
> Enquanto isso, a [API REST](https://botozap.com.br/docs) é a interface
> oficial e estável — tudo aqui é um envelope fino sobre ela. Tudo é `0.x`,
> **sem promessa de estabilidade de API** até a `1.0`; se algo faltar ou
> quebrar nos pacotes, o fallback é sempre a API REST direto.

**Node suportado:** `>=20.19`, validado em CI nos majors 20.19, 22 e 24
(typecheck, testes, build, imports ESM/CJS, smokes de CLI/MCP e instalação dos
tarballs reais num projeto limpo). A matriz contratual completa também está
verde contra os handlers reais no repositório privado do core.

**Bugs:** [issues deste repositório](https://github.com/bytecraft-fernando/botozap-js/issues)
— nunca inclua sua chave de API no relato.

## Pacotes

| Pacote | O que é |
| --- | --- |
| [`@botozap/sdk`](./packages/sdk) | SDK Node.js — cliente tipado da API `/api/v1`, sem dependências de runtime |
| [`@botozap/cli`](./packages/cli) | CLI `botozap` — a API no terminal e em scripts |
| [`@botozap/mcp`](./packages/mcp) | Servidor MCP — as operações da API como ferramentas para agentes (Claude Code, Cursor, Codex) |

O SDK é a única implementação do cliente HTTP: CLI e MCP consomem
`@botozap/sdk` (workspace) — autenticação, envelopes, paginação, erros e tipos
vivem num lugar só.

## Exemplos

Em [`examples/`](./examples): envio sandbox em JavaScript e TypeScript,
receptor de webhook (HMAC + idempotência transacional) e configuração do MCP
com chave sandbox.

## Desenvolvimento

Requer Node ≥ 20.19 e [pnpm](https://pnpm.io) (exclusivamente — nunca
npm/yarn/bun).

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Versionamento com [Changesets](./.changeset) — tudo `0.x`, sem promessa de
estabilidade prematura.

## Licença

[MIT](./LICENSE)
