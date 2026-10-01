# Hotfix — contrato multicanal da conta revisora

Base `origin/main`: `e42dcd3a245dc40f1b570caeb1ee6a9d946a5405`; branch `fix/mcp-schema-bsuid`. Sem deploy, npm ou alteração do app; a versão continua 0.8.0 neste PR, conforme plano de publicar 0.8.1 depois.

## Causa comprovada

O contexto corrigido pelo coordenador é dez conversas WhatsApp e duas Instagram. BSUID e `phone: null` já eram aceitos, mas **`phone_number_id: null` do canal Instagram era recusado** nos schemas de contatos, conversas e mensagens. Foram executados os serializers reais do app com linhas fictícias na forma da conta revisora, sem ler credenciais ou dados privados.

Aplicando os schemas de `origin/main` às fixtures geradas, a prova anterior à correção retornou:

```text
list_contacts: data.10.phone_number_id / data.11.phone_number_id — Expected string, received null
list_conversations: data.10.phone_number_id / data.11.phone_number_id — Expected string, received null
list_messages: data.10.phone_number_id / data.11.phone_number_id — Expected string, received null
list_customers/open_botozap.customers: PASS
```

As funções reais estão em `src/app/api/v1/contacts/serialize.ts` (`serializeContact`, mantém os campos da linha), `conversations/serialize.ts` (`serializeConversation`, campo phone_number_id vem da linha, identidade/canal vêm dos helpers) e `messages/serialize.ts` (`serializeMessage`). O canal e a conta são serializados por `src/lib/api/channel.ts`; a identidade é calculada pelos helpers reais de `src/lib/identity.ts`. Cliente com telefone funcionava porque não acionava o caso nullable do Instagram.

Também foram reproduzidas falhas aditivas de `.strict()` no contato embutido da conversa, `paging` e `meta`: quebravam list_contacts/list_conversations/list_customers e as tools de UI que compartilham esses objetos. Eles agora fazem `strip`. O register já devolvia o resultado parseado, e os testes verificam tanto a projeção quanto a validação pelo **Client do SDK MCP contra o outputSchema anunciado**, sem desativar a validação.

A abertura inicial de `open_botozap` isoladamente **não apresentou erro** com o serializer real de customers; o erro genérico do host precisa ser reavaliado na conta real após corrigir as leituras downstream. Não se atribui a BSUID uma falha que não foi reproduzida.

## Comportamento corrigido

- Schemas de mensagens, contatos e conversas aceitam número interno nulo, preservando canal, conta de canal, wa_id, username e agent_paused_at. Não foram removidas as validações dos campos conhecidos; extras de entidades tipadas/paginação são removidos, sem repassar campos privados novos.
- Revisão, deep links e inbox resolvem o negócio da conversa Instagram pela **conta de canal autorizada**, sem exigir número WhatsApp. A tool auxiliar `get_channel_account` usa o método HTTP do SDK e a rota existente GET `/v1/channel_accounts/:id`, somente leitura (`numbers:read`), com gate de UI e app-only no perfil assistant. Continua ausente do catálogo padrão sem UI (fixture 0.6.0 preservada). O assistant passa a até 44 tools com UI; mantém 35 sem UI.
- A rota real é `src/app/api/v1/channel_accounts/[id]/route.ts`: scope numbers:read, sandbox permitido, filtro por account_id e ambiente; o serializer expõe customer_id, sem tokens. Stage de resposta/agendamento exige a política dessa leitura quando o canal é Instagram. A API e o wrapper OAuth revalidam a autorização real; não há confiança no deep link para autorizar.
- `reply_to_conversation` lê a conversa autorizada e envia pela identidade canônica: origem é o UUID da conta de canal para Instagram, ou o número interno para WhatsApp; destino é wa_id (IGSID/BSUID/telefone), sem exigir telefone. A API mantém a decisão sobre janela, canal, ambiente e destinatário. A chave de idempotência é preservada. Nenhum envio/retomada ocorre só ao abrir a tela.
- Exibição usa nome disponível, @username e telefone formatado; nunca mostra BSUID ou IGSID como telefone, nem repete o username quando ele já é o nome. Canal/origem são exibidos corretamente. A revisão aceita Instagram, oculta template aprovado e usa mensagem de disponibilidade apropriada; template aberto diretamente para Instagram explica a restrição sem erro de tool. Agendamento e acompanhamento usam a conversa/canal existente; ações continuam com confirmação explícita.
- Entradas globais passam account_name opcional da identidade para o resumo da conta. Nenhum payload privado ou telefone real da conta revisora foi incluído.

## Fixtures e testes

`capture-reviewer-contract.mjs` extrai funções reais com AST, executa offline e registra SHA-256 dos fontes em `tests/fixtures/app-reviewer.ts`. Gera contatos/conversas/mensagens de WhatsApp com telefone, WhatsApp com BSUID sem telefone e Instagram com username/IGSID e número nulo; customer e metadados usam toCustomer/buildOffsetMeta reais. Radar não tem serializer por linha: a rota repassa as linhas de listRadar/RPC; a fixture conserva essa forma, com contagens, e registra o hash do fonte.

```sh
pnpm --filter @botozap/mcp exec node scripts/capture-reviewer-contract.mjs /Users/fernando/Desenvolvimento/bytecraft/botozap
```

35 testes novos: 31 de contrato via MCP (tools de leitura, global, revisão, campos aditivos, perfil, template Instagram e payloads de envio canônicos com idempotência) e quatro de UI (identidade e confirmação dos três tipos de contato). O snapshot de outputSchema foi atualizado para os campos nullable; testes de resposta malformada continuam recusando contrato inválido.

Build, typecheck, **650 testes** (SDK 176, CLI 105, MCP 369), gate:tarballs, guarda HTTP e diff-check: verdes. Catálogo padrão empacotado mantém somente as adições já aprovadas get_profile/prepare_send_intent, sem remoções e com 149 rotas de IA.

Oito capturas de revisão Instagram, inline com moldura do host e fullscreen, desktop/mobile, claro/escuro: `screenshots/bsuid-instagram-*.png`. Axe A/AA zero, sem overflow, card vazio ou borda dupla; asserções exigem Instagram/@username, compositor disponível e template oculto. Resultado em `screenshots/validation-bsuid.json`. Simulador: `http://127.0.0.1:4174/chat?scenario=instagram`.

## Depois do merge

O responsável faz deploy e prepara/publica MCP 0.8.1. A sessão OAuth precisa autorizar GET `/v1/channel_accounts/:id` com numbers:read para resolver o negócio Instagram; se essa rota faltar ao grant, atualizar a autorização pelo fluxo existente. Revalidar na conta real a abertura de Pendências, histórico, resposta e confirmação dos três tipos de identidade, inclusive o erro inicial genérico do host que isoladamente não foi reproduzido. Este trabalho não fez deploy, publicação ou alterações de flags.
