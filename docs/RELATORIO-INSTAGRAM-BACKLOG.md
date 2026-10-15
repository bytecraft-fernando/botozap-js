# Paridade do backlog do Instagram — tarefa G

Base: `origin/main`, `5d1b784a38ef92c203cd79948548d6d33e502b0f`, na branch `ig-bk-g-botozap-js`. Referências de implementação: merges locais dos PRs #37, #38 e #41 e respectivos changesets; rotas, serializadores, exemplos e documentação de `/v1` no checkout `botozap/ig-bk-integracao`. Nenhum deploy, PR, publicação npm ou `changeset version` foi executado.

## Matriz de nomes novos

| Rota | Método SDK (`channelAccounts`) | Comando CLI (prefixo `botozap`) | Tool MCP |
| --- | --- | --- | --- |
| `GET /v1/channel_accounts/:id/connection` | `getConnection(id)` | `channel-accounts connection get <channel_account_id>` | `get_instagram_connection` |
| `POST /v1/channel_accounts/:id/connection/resubscribe` | `resubscribeConnection(id)` | `channel-accounts connection resubscribe <channel_account_id>` | `resubscribe_instagram_connection` |
| `DELETE /v1/channel_accounts/:id/connection` | `disconnect(id)` | `channel-accounts connection disconnect <channel_account_id>` | `disconnect_instagram_connection` |
| `GET /v1/channel_accounts/:id/message-rules/:ruleId/qr` | `getMessageRuleQr(id, ruleId, { format?: "png" \| "svg" })` | `channel-accounts message-rules qr <channel_account_id> <rule_id> --out <arquivo> --format png\|svg` | `get_message_rule_qr` |

O SDK inclui ainda o helper autenticado `BotoZap.requestBinary(method, path, opts)`, retornando `ArrayBuffer` sem converter bytes em texto e preservando erros JSON/headers da API. A tool de QR consulta também `GET /v1/channel_accounts/:id/message-rules/:ruleId` para obter `ref_link`: ambas as rotas estão na política da tool. Ela retorna `{ data: { ref_link } }` em `structuredContent`, fallback textual idêntico e um bloco MCP `image/png` em base64. A CLI exige `--out`, valida formatos e só grava depois do download bem-sucedido.

## Campos e filtros

- `InstagramConnection`: status, username, subscribed_at, token_expires_at, revoked_reason, health, subscribed_fields e diagnostic com code/message/next_step/help_url. Reassinar/desconectar retornam o mesmo estado confirmado; conexão não aceita sandbox. A desconexão usa chave de API; OAuth permanece no painel. Políticas registram escopos e rotas; desconexão tem `destructiveHint: true`.
- Regras de mensagem: `ref_link`, `require_follow`, `non_follower_text`; eventos de falha aceitam `message_id: null`, compatível com referral sem mensagem.
- Regras de comentário: `live`, `require_follow`, `non_follower_text`, inclusive POST, PATCH, GET e listagem. Métricas preservam `posts[].live`; erro `422 feature_unavailable` passa pelo SDK/CLI/MCP.
- Contatos: `ig_follows_business`, `ig_followed_by_business`, `ig_follower_count`, `ig_verified`, `ig_follow_checked_at`, somente leitura, com null quando desconhecidos. Filtro `ig_follows_business` nas listagens de contatos e conversas; `false` e ausência mantêm significados diferentes.
- CLI: `--live true|false` nas regras de comentário; `--require-follow true|false`, `--non-follower-text` e `--clear-non-follower-text` na criação/edição de ambos os tipos. `--follows-business true|false` nas listagens. Flags de seguidores complementam JSON nas regras de mensagem, recusando duplicatas; flags de comentário mantêm exclusividade com fonte JSON.
- Schemas MCP aceitam servidores anteriores que omitem campos aditivos opcionais, sem removê-los quando presentes.

## Perfil assistant e release

`packages/mcp/src/catalog-profile.ts` permanece sem alterações. Nenhuma tool entrou ou saiu do perfil `assistant`. A ampliação de `contactSchema` muda a saída de `get_contact` e `list_contacts` desse perfil quando o MCP for publicado na Fly; os filtros opcionais entram nas duas tools existentes de listagem. Isso deve ser considerado na revisão do ChatGPT. A Fly segue segurada pela issue #760; não foi feito deploy.

O changeset `.changeset/instagram-backlog.md` é minor nos três pacotes: **SDK 0.13.0 → 0.14.0; CLI 0.8.1 → 0.9.0; MCP 0.10.1 → 0.11.0**. Arquivos de versão não foram alterados; release separado.

## Validação

Testes de métodos, comandos e tools, binários PNG/SVG, autenticação, filtros true/false/ausência, null em PATCH, campos novos em CRUD, métricas de live, erros HTTP/feature_unavailable e bloqueio por escopo/sandbox/rota/perfil. Snapshots do catálogo e das quatro tools novas atualizados. Validações finais executadas:

- `pnpm -r build`: passou para os três pacotes.
- `pnpm -r test`: passou, SDK 244 + CLI 184 + MCP 455 = 883 testes de pacotes; também passaram os 5 testes do exemplo `agent-endpoint` (888 no workspace).
- `pnpm -r lint`: executado; o pnpm confirmou que nenhum pacote define script `lint` (`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`). O equivalente usado pela CI, `pnpm -r typecheck`, passou, incluindo o exemplo TypeScript e o código web do MCP.
- `git diff --check`: passou; `catalog-profile.ts` foi comparado com `origin/main` e permanece idêntico.
- `pnpm exec changeset status --output=/tmp/ig-backlog-changeset-status.json`: confirmou os três minors e as versões acima sem executar a versão.

O SHA final e o resultado do push são informados no resultado da tarefa ao coordenador.
