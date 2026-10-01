# P2 — O agente precisa de você

Branch `fix/mcp-agent-needs-you`, criada de `origin/main` `de1a699`. Sem deploy, publicação, alteração de flags ou arquivos do app. Direção visual: as referências Intercom/Attio e ChatGPT já registradas em DESIGN.md, com priorização por pessoa, informação curta e tokens do host; a lista compacta substitui as pills segundo o briefing aprovado.

## Correções

- A API pública do app declara `open`, `acknowledged` e `resolved` em `src/lib/ai/cases/index.ts` linhas 13, 24 e 27; `src/app/api/v1/ai/alerts/route.ts` aceita um status por consulta. A tool consulta **open + acknowledged**, percorre todas as páginas de cada status e exclui resolvidos. A lista e o detalhe mostram **Reconhecido** para acknowledged. Críticos permanecem primeiro, seguidos pelos demais alertas, conversas pausadas e casos.
- **Revisar conversa** faz leituras autorizadas de conversa/número, verifica o negócio e monta o mesmo `mountReview` usado pelo global/deep link, com histórico e compositor vazio. Não manda instrução textual ao modelo nem envia mensagem. A tool de staging continua com seu contrato original; a revisão usa o fluxo de leituras do global. Falha de leitura preserva a caixa de atendimento com orientação de acesso. Ao voltar ao inline, reaparece a lista de atendimentos, sem card vazio.
- Uma conversa cuja leitura confirma IA pausada oferece **Retomar IA** somente se a identidade possui a política de `control_conversation_agent`. O botão abre confirmação que explica o possível envio automático; apenas **Confirmar retomada** chama a tool existente com action resume. A rota é POST /v1/conversations/:id/agent-control, scope agents:write, escrita destrutiva/open-world, já presente na política e tool-routes. O servidor revalida a autorização. Cliques repetidos na confirmação e respostas incertas não repetem a chamada automaticamente.
- Cada linha mostra nome/telefone, motivo, prévia curta da última mensagem **inbound** e tempo de espera. Inline mostra três itens e **Abrir em tela cheia** antes da lista; fullscreen mostra todos os itens carregados. Alertas/casos mostram título/detalhe/motivo. A API de conversas só expõe agent_paused_at, sem autor/motivo da pausa: exibimos o tempo e “aguardando humano”, sem inventar dados.
- Previews são consultadas uma vez por conversa distinta, com direction=inbound, limit=1 e ordem created_at (a API entrega as mais recentes primeiro). Lotes de quatro limitam concorrência. A tool só faz essas leituras se a política existente de list_messages permite scope/rota; erro ou falta de permissão deixa uma orientação para conferir o histórico, sem simular mensagem. Não acrescentamos permissões obrigatórias à caixa de atendimento por causa das previews opcionais.
- `summary` no structuredContent **e** no JSON textual inclui alertas não resolvidos, contagens open/acknowledged, severidade/status de cada alerta, conversas pausadas, existência de outra página e casos abertos. Inclui instrução explícita de que zero casos não significa zero alertas/conversas pausadas. Categorias independentes podem incluir a mesma conversa; não são contagem de pessoas únicas. Pausadas continuam limitadas à página de 100, com link de continuação no BotoZap.
- `formatPhone` é o helper único de formatação visual: +5511989669559 vira **+55 11 98966-9559**; atende também telefones fixos brasileiros e preserva nomes, usernames e identificadores que não são telefones. Revisor/Radar, carrossel, template, agendamento, plantão e caixa de atendimento utilizam o helper em identidades/origens renderizadas. Identificadores nos payloads e verificações de destinatário não foram alterados.

## Validação

**Build, typecheck, 584 testes (176 SDK, 105 CLI, 303 MCP), gate:tarballs, guarda HTTP do CI e diff check verdes.** A fixture tools-only 0.6.0 mantém somente os acréscimos já existentes get_profile/prepare_send_intent; nenhuma tool padrão ou contrato de envio foi modificado.

Testes cobrem os status não resolvidos e contagens no texto/structuredContent; previews inbound e autorização; lista inline/fullscreen; abertura real do histórico/compositor e recusa de acesso; confirmação e chamada única para retomar; retorno ao inline e helper de telefone. Testes anteriores de assumir/devolver casos continuam verificando confirmação e revision CAS.

Roteiro `/chat?scenario=cases-p2` no simulador **http://127.0.0.1:4174**: alerta crítico acknowledged + oito pausadas + zero casos, incluindo telefone sem formato nos dados de entrada. **20 capturas** (cinco estados × desktop/mobile × claro/escuro), com axe A/AA zero, sem overflow, sem borda dupla no inline e sem card vazio; evidências em [validation-p2.json](screenshots/validation-p2.json).

- [Resumo inline mobile](screenshots/p2-p2-inline-mobile-light.png)
- [Lista fullscreen desktop](screenshots/p2-p2-fullscreen-desktop-dark.png)
- [Histórico e compositor mobile](screenshots/p2-p2-review-mobile-dark.png)
- [Confirmação de retomada](screenshots/p2-p2-resume-confirm-desktop-dark.png)

Nenhum teste de produção ou deploy foi executado. Após uma implantação autorizada, falta repetir o cenário na conta piloto no ChatGPT real; a revisão mantém a disponibilidade WhatsApp existente (conversa com phone_number_id) e orienta abrir o BotoZap quando o canal não permite esse revisor.
