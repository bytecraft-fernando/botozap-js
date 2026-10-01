# P4 — plantão somente leitura e abertura inline

## Causa e correção

`message_id` era opcional na tool, mas o helper procurava outbound somente com `id === messageId || wamid === messageId`. Sem ID, nenhum recibo era selecionado, logo o status já persistido nunca virava eventos de timeline. Agora, sem ID, consulta a última outbound autorizada com `direction=outbound`, `sort=created_at`, `limit=1`; a rota real `src/app/api/v1/messages/route.ts` aceita esses parâmetros e usa ordem descendente. Converte status `sent`, `delivered` e `read` em evidências imediatas, mesmo com stream vazio/cursor posterior aos webhooks.

O resultado devolve `message_id`, `receipt_status` e `receipt_found`. A UI fixa o ID retornado nos próximos polls, continua exibindo os eventos de resposta/digitação autorizados e informa claramente quando não existe outbound. Nenhuma mutação é necessária para abrir ou atualizar o plantão. O teste usa uma mensagem na forma serializada real do app, da fixture existente, com status read; não usa IDs ou dados privados do revisor.

As descrições de `open_live_conversation`, `send_message`, `reply_to_conversation` e `stage_review_reply` orientam pedidos de acompanhar/monitorar/ver status/“follow” SOMENTE para `open_live_conversation`, nunca envio, reenvio ou novo rascunho. A orientação só se aplica com UI negociada/habilitada; a skill local de plantão recebeu a mesma regra. Isso orienta o modelo, não cria um bloqueio semântico de pedidos no servidor.

## Display

Os oito resources anunciam `preferredDisplayMode: inline`; o HTML também recebe `data-initial-mode=inline`, inclusive review/global. Removidos pedidos automáticos de fullscreen no bootstrap de revisão, troca para template e navegação de casos. Editar o rascunho mantém o modo atual. Template, agendamento e plantão têm botão explícito de expansão; Pendências/casos preservam o botão existente. O plantão também deixa de pedir PiP automaticamente no bootstrap, preservando a abertura inline.

Testes verificam preferência/HTML de todos os resources e que alterar o metadado de fullscreen para inline altera o hash do URI. O bundle alterado também invalida os URIs pelo hash de conteúdo. O host ainda controla o modo final; a validação no ChatGPT real ficará com o responsável depois do deploy.

## Validação e release

- Build, typecheck, 656 testes (SDK 176, CLI 105, MCP 375), gate:tarballs, guarda HTTP e diff-check passaram.
- Capturas `screenshots/p4-*.png` de reply/global/template/cases/booking/live: inline e fullscreen, desktop/mobile, claro/escuro. Axe A/AA zero, sem overflow, card vazio ou borda dupla; a captura verifica que não há expansão automática antes de pedir um modo. Evidência consolidada em `screenshots/validation-p4.json`.
- Changeset patch aplicado: MCP 0.8.2; SDK 0.10.0 e CLI 0.6.1 inalterados, pois suas implementações/dependências não mudaram.
- `pnpm release:mcp --dry-run` passou, tarball MCP 0.8.2; não houve publicação real, deploy ou alteração de flags.

Após merge: responsável publica/deploya e revalida a mensagem já lida sem message_id, pedido “follow … without sending anything else” e abertura inline no ChatGPT real. A skill do plugin foi atualizada no fonte, sem publicação no portal.
