# IA BYOK no SDK, CLI e MCP

Esta candidata acompanha a API `/api/v1/ai`. Credenciais de IA são fornecidas pelo
Cliente. As estimativas de uso e limites locais não representam crédito, tarifa
ou cobrança do BotoZap. As assinaturas existentes do produto permanecem.

SDK: `client.ai.<módulo>.<método>({customer_id, ...})`. CLI:
`botozap ai <módulo-em-kebab-case> <método-em-kebab-case> --input-file dados.json`.
MCP: `ai_<módulo_em_snake_case>_<método_em_snake_case>`. Todos os IDs de caminho
são campos do objeto de entrada. O SDK codifica cada segmento antes de enviar.

`agents:read/write` e chave live são exigidos conforme a operação; sandbox é
rejeitado pelo servidor. O `customer_id` deve pertencer à Conta da chave. Nunca
inclua `account_id`, `actor_id` ou tokens de canal. Aprovar ações, memória ou
propostas usa a identidade da chave autenticada, cujo criador deve continuar
owner/admin da Conta; a API confirma isso novamente na transação.

## Criar, conferir e publicar um agente

```ts
import { BotoZap } from '@botozap/sdk';
const bz = new BotoZap({ apiKey: process.env.BOTOZAP_API_KEY! });
const credential = await bz.ai.credentials.create({
  customer_id: customerId, provider: 'openai', label: 'Atendimento',
  key: process.env.MY_OPENAI_KEY!,
});
const draft = await bz.ai.agents.create({
  customer_id: customerId, name: 'Recepção',
  config: {
    system_prompt: 'Atenda com base nas informações verificadas do negócio.',
    provider: 'openai', model: 'gpt-4.1-mini', credential_id: credential.id,
    channel_account_id: channelId, tool_ids: ['knowledge.search'],
    knowledge_source_ids: [sourceId],
  },
});
const attempt = crypto.randomUUID(); // persista antes da chamada
const preview = await bz.ai.agents.preview({
  customer_id: customerId, id: draft.agent_id, version_id: draft.version_id,
  operation_key: attempt, messages: [{role: 'user', content: 'Como funciona?'}],
});
// Confira resposta e tool_trace. Preview simula efeitos, sem enviar ao WhatsApp.
await bz.ai.agents.publish({
  customer_id: customerId, id: draft.agent_id,
  version_id: draft.version_id, expected_revision: draft.revision,
});
// A operação usa outra revisão: releia o agente antes de ativar.
const current = await bz.ai.agents.get({customer_id: customerId, id: draft.agent_id});
await bz.ai.agents.operation({
  customer_id: customerId, id: draft.agent_id,
  expected_revision: current.agent.operation_revision, mode: 'assisted', paused: false,
});
```

Publicação fixa uma versão. Modo assistido exige revisão explícita de cada plano;
`executions.decide` aprova exatamente o conteúdo registrado e pode enviar a resposta.
O operador é uma execução separada que executa ações sem enviar mensagem.
O runtime exige a confirmação literal `CONFIRMAR XXXXXXXX` do compromisso proposto;
a integração não deve produzir essa confirmação em nome do contato.

`proposals.decide` com `apply` em playbook **publica nova versão atomicamente**,
validando a versão base e ausência de rascunho concorrente. Revise texto/evidência
antes da decisão. Propostas de memória inserem entrada aprovada na memória.

## Credenciais e seleção de modelos

Os seis provedores são Anthropic, OpenAI, Google, OpenRouter, DeepSeek e xAI.
`credentials` permite criar, consultar, renomear, rotacionar mantendo ID,
revalidar, inativar e excluir quando não estiver em uso. As respostas contêm apenas
metadados, últimos quatro caracteres e estado de validação; nunca a chave.

`providers.models` lista modelos obtidos para uma credencial e capacidades do
adapter. `providers.saveBinding` aceita as finalidades de `AI_CONFIGURABLE_PURPOSES`:
`default`, `followup`, `proposal`, `transcription`, `embedding` e as finalidades
granulares `guard`, `evaluator`, `classification`, `compaction`, `case_chat`,
`learning_judge`, `learning_distiller`, `vision` e `commercial_proposal`. Sem
vínculo próprio, as granulares herdam o padrão do Cliente (judge/distiller passam
antes por `proposal`). `agent_turn` e `agent_operator` são configurados na
versão do agente; `router`, no roteador. Fallback exige outra credencial própria
explícita. Não há fallback para uma chave de plataforma.

## Concorrência, tentativas e paginação

- Preserve `expected_revision` opaco como string integral. Não use `Number` em
  revisões de agentes, bibliotecas, credenciais, roteadores e follow-ups.
- Casos, alertas, propostas, avisos, orçamento e tarifas usam revisão numérica.
- `operation_key` e `request_key` são UUIDs persistidos pelo chamador; não gere
  outra chave para consultar/repetir uma tentativa incerta. SDK não faz retry automático.
- `unknown` não significa falha confirmada. Concilie evidências antes de avançar.
  `followups.resolveEffect` não reenvia; enviado exige `wamid`. Sem recibo de envio,
  inferência incerta só pode ser encerrada com `cancelled`.
- Agentes, execuções, casos/mensagens, alertas, propostas e avisos/jobs retornam
  `OffsetList` com `data` e `meta` (`page`, `per_page`). Bibliotecas e catálogos
  retornam arrays. Inscrições de follow-up usam `limit` até 200, sem offset fictício.
- Medição de tokens pode ser parcial ou indisponível. Ausência não equivale a zero.

## Documentos e pacotes de skill

```ts
await bz.ai.knowledge.upload({customer_id: customerId, name: 'Catálogo',
  file: new Blob([documentBytes], {type:'application/pdf'}), file_name:'catalogo.pdf'});
await bz.ai.skills.importZip({customer_id: customerId,
  file:new Blob([zipBytes], {type:'application/zip'}), file_name:'atendimento.zip'});
```

O SDK usa upload direto (abaixo). Documento: até 20 MiB; ZIP: até 5 MiB. A CLI lê o arquivo
explicitamente indicado por `file_path` no JSON e aceita `file_name` e `mime_type`.
O MCP recebe `file_base64` e `file_name`; nunca lê caminhos do servidor. Substituir
skill exige `id` e `expected_revision` juntos. Fontes/skills em versões publicadas
não podem ser removidas enquanto estiverem em uso.

## Operação

Roteadores ativos aplicam edições imediatamente, com CAS. Assumir canal ocupado
por agente direto exige `replace_current:true` e `expected_owner_agent_id` da
confirmação. Ativar um membro não toma o canal. Arquivar preserva histórico.

Follow-ups publicam um grafo validado; `rollback` restaura e publica atomicamente.
Templates e variáveis são aprovados antes do envio. Assistido exige aprovação do
snapshot. Consentimento, janela WhatsApp e horários continuam verificados pelo servidor.

Avisos usam contato autorizado do Cliente e template Utility aprovado.
`notices.test` envia mensagem real: requer `confirm_send:true` após confirmação.
`notices.retry` aceita somente falha confirmada, nunca `unknown`.

Pausa humana da conversa permanece em `bz.conversations.controlAgent(id, 'pause')`,
CLI `botozap ai conversation-control <id>` com `action` no JSON e MCP
`control_conversation_agent`. Retomar pode permitir novas respostas automáticas.

## Inventário de operações

A tabela corresponde às rotas existentes. As ferramentas ainda precisam ser
publicadas após os gates de release; nenhum comando abaixo publica pacotes.

| SDK (`ai.`) | Método | Rota |
| --- | --- | --- |
| `agents.list` | GET | `/ai/agents` |
| `agents.get` | GET | `/ai/agents/:id` |
| `agents.create` | POST | `/ai/agents` |
| `agents.saveDraft` | PUT | `/ai/agents/:id` |
| `agents.publish` | POST | `/ai/agents/:id/publish` |
| `agents.restore` | POST | `/ai/agents/:id/restore` |
| `agents.duplicate` | POST | `/ai/agents/:id/duplicate` |
| `agents.operation` | POST | `/ai/agents/:id/operation` |
| `agents.archive` | POST | `/ai/agents/:id/archive` |
| `agents.preview` | POST | `/ai/agents/:id/preview` |
| `credentials.list` | GET | `/ai/credentials` |
| `credentials.get` | GET | `/ai/credentials/:id` |
| `credentials.create` | POST | `/ai/credentials` |
| `credentials.update` | PATCH | `/ai/credentials/:id` |
| `credentials.revalidate` | POST | `/ai/credentials/:id/revalidate` |
| `credentials.remove` | DELETE | `/ai/credentials/:id` |
| `providers.get` | GET | `/ai/providers` |
| `providers.saveBinding` | PUT | `/ai/providers` |
| `providers.removeBinding` | DELETE | `/ai/providers` |
| `providers.models` | GET | `/ai/providers/:provider/models` |
| `executions.list` | GET | `/ai/executions` |
| `executions.get` | GET | `/ai/executions/:id` |
| `executions.decide` | POST | `/ai/executions/:id/decision` |
| `knowledge.list` | GET | `/ai/knowledge` |
| `knowledge.get` | GET | `/ai/knowledge/:id` |
| `knowledge.create` | POST | `/ai/knowledge` |
| `knowledge.update` | PATCH | `/ai/knowledge/:id` |
| `knowledge.remove` | DELETE | `/ai/knowledge/:id` |
| `knowledge.reindex` | POST | `/ai/knowledge/:id/reindex` |
| `knowledge.chunks` | GET | `/ai/knowledge/:id/chunks` |
| `knowledge.search` | POST | `/ai/knowledge/search` |
| `knowledge.upload` | POST | `/ai/knowledge/upload` |
| `memory.get` | GET | `/ai/memory` |
| `memory.publish` | PUT | `/ai/memory` |
| `memory.setEnabled` | PATCH | `/ai/memory` |
| `memory.versions` | GET | `/ai/memory/versions` |
| `memory.entries` | GET | `/ai/memory/entries` |
| `memory.createEntry` | POST | `/ai/memory/entries` |
| `memory.updateEntry` | PATCH | `/ai/memory/entries/:id` |
| `memory.archiveEntry` | DELETE | `/ai/memory/entries/:id` |
| `memory.approveEntry` | POST | `/ai/memory/entries/:id/approve` |
| `skills.list` | GET | `/ai/skills` |
| `skills.get` | GET | `/ai/skills/:id` |
| `skills.create` | POST | `/ai/skills` |
| `skills.update` | PATCH | `/ai/skills/:id` |
| `skills.remove` | DELETE | `/ai/skills/:id` |
| `skills.versions` | GET | `/ai/skills/:id/versions` |
| `skills.reference` | GET | `/ai/skills/:id/references` |
| `skills.importZip` | POST | `/ai/skills/import` |
| `followupFlows.list` | GET | `/ai/followup-flows` |
| `followupFlows.get` | GET | `/ai/followup-flows/:id` |
| `followupFlows.create` | POST | `/ai/followup-flows` |
| `followupFlows.update` | PUT | `/ai/followup-flows/:id` |
| `followupFlows.control` | PATCH | `/ai/followup-flows/:id` |
| `followupFlows.publish` | POST | `/ai/followup-flows/:id/publish` |
| `followupFlows.versions` | GET | `/ai/followup-flows/:id/versions` |
| `followupFlows.rollback` | POST | `/ai/followup-flows/:id/rollback` |
| `followupFlows.models` | GET | `/ai/followup-flows/from-model` |
| `followupFlows.installModel` | POST | `/ai/followup-flows/from-model` |
| `followups.list` | GET | `/ai/followups/enrollments` |
| `followups.get` | GET | `/ai/followups/enrollments/:id` |
| `followups.enroll` | POST | `/ai/followups/enrollments` |
| `followups.control` | POST | `/ai/followups/enrollments/:id/control` |
| `followups.decideEffect` | POST | `/ai/followups/effects/:id/decision` |
| `followups.resolveEffect` | POST | `/ai/followups/effects/:id/resolve` |
| `routers.list` | GET | `/ai/routers` |
| `routers.get` | GET | `/ai/routers/:id` |
| `routers.create` | POST | `/ai/routers` |
| `routers.update` | PUT | `/ai/routers/:id` |
| `routers.archive` | DELETE | `/ai/routers/:id` |
| `routers.operation` | POST | `/ai/routers/:id/operation` |
| `routers.test` | POST | `/ai/routers/:id/test` |
| `routers.activateMember` | POST | `/ai/routers/:id/members/:agent_id/activate` |
| `cases.list` | GET | `/ai/cases` |
| `cases.get` | GET | `/ai/cases/:id` |
| `cases.messages` | GET | `/ai/cases/:id/messages` |
| `cases.update` | PATCH | `/ai/cases/:id` |
| `alerts.list` | GET | `/ai/alerts` |
| `alerts.update` | PATCH | `/ai/alerts/:id` |
| `notices.get` | GET | `/ai/notices` |
| `notices.update` | PATCH | `/ai/notices` |
| `notices.options` | GET | `/ai/notices/options` |
| `notices.jobs` | GET | `/ai/notices/jobs` |
| `notices.test` | POST | `/ai/notices/test` |
| `notices.retry` | POST | `/ai/notices/jobs/:id/retry` |
| `proposals.list` | GET | `/ai/proposals` |
| `proposals.decide` | PATCH | `/ai/proposals/:id` |
| `proposals.analyze` | POST | `/ai/proposals/analyze` |
| `proposals.settings` | GET | `/ai/proposals/settings` |
| `proposals.saveSettings` | PATCH | `/ai/proposals/settings` |
| `usage.get` | GET | `/ai/usage` |
| `usage.budget` | GET | `/ai/usage/budget` |
| `usage.saveBudget` | PATCH | `/ai/usage/budget` |
| `usage.rates` | GET | `/ai/usage/rates` |
| `usage.saveRate` | PUT | `/ai/usage/rates` |
| `usage.reprice` | POST | `/ai/usage/rates/reprice` |


Casos: decisão humana e consulta interna
---------------------------------------
`ai.cases.reply` recebe `action: resolved | need_lead_info | escalate`, `expected_revision` numérica, `body` e `operation_key` UUID. As duas primeiras ações retomam o agente publicado para repassar a solução ou pedir informação; em modo assistido o envio aguarda aprovação. `escalate` mantém o atendimento humano. Confira `queued`, `queue_reason` e `service_stale`: decisão registrada não é prova de mensagem enviada. Um novo controle humano invalida a execução pendente.

`ai.cases.consult` usa a chave própria para uma consulta interna sem ferramentas nem envio. Retorna `status`, persona, consumo medido ou `null`. Se o agente estiver pausado/arquivado/sem publicação, usa a persona neutra e o provedor padrão do Cliente. Reutilize a UUID para consultar resultado incerto, sem iniciar outra inferência. `chatHistory` é paginado por offset.

Conhecimento a partir de operações reais
----------------------------------------
`knowledge.importSource` importa serviços ativos da Agenda, produtos informados (`price` decimal em texto) ou conversa encerrada. Para conversas: consulte `conversations`, obtenha autorização explícita via `conversationPermission`, mostre o texto anonimizado de `conversationPreview` à pessoa e só depois envie `permission_revision`, `preview_hash` e `reviewed:true`. Mudança da conversa ou da autorização exige nova revisão. O MCP não deve declarar autorização ou revisão sozinho.

`skills.catalog` lista versões disponíveis e a cópia instalada; `skills.install` instala uma versão específica no Cliente. IDs de versão e slug são enviados explicitamente.

Configuração de mídia: `config.media` permite `images_enabled`, `documents_enabled` e `video_frames_enabled`. Ativar não substitui suporte do modelo nem credencial própria. O resumo de uso expõe `input_audio_tokens`, `input_text_tokens` e `audio_seconds` como números ou `null`, sem inventar medição ausente.

| Método SDK | HTTP | Rota |
| --- | --- | --- |
| cases.reply | POST | /ai/cases/:id/reply |
| cases.consult | POST | /ai/cases/:id/chat |
| cases.chatHistory | GET | /ai/cases/:id/chat |
| knowledge.importSource | POST | /ai/knowledge/import |
| knowledge.conversations | GET | /ai/knowledge/conversations |
| knowledge.conversationPermission | PATCH | /ai/knowledge/conversations/:id/permission |
| knowledge.conversationPreview | GET | /ai/knowledge/conversations/:id/preview |
| skills.catalog | GET | /ai/skills/catalog |
| skills.install | POST | /ai/skills/catalog/:slug/install |

## Upload direto e retomada

`knowledge.upload` (20 MiB) e `skills.importZip` (5 MiB) calculam SHA-256, preparam a intenção, enviam bytes por PUT direto ao armazenamento e finalizam pelo mesmo `upload_id`. CLI e MCP usam esse transporte automaticamente. As rotas multipart anteriores permanecem para compatibilidade; arquivos grandes devem usar o transporte direto para não atravessar o limite HTTP da hospedagem.

Nenhum token BotoZap ou cookie é enviado ao armazenamento. O SDK preserva em memória a intenção para retries com os mesmos bytes: falha do PUT repete o PUT; falha ao finalizar repete apenas a finalização. `upload_expired` confirmado permite começar outra intenção. Para persistir a retomada entre processos, use `onUploadPrepared: ({upload_id}) => salvar(upload_id)`; após o PUT, `ai.uploads.complete({customer_id,id:upload_id})` devolve o mesmo recurso em caso de resposta anterior perdida. A API de baixo nível `ai.uploads.prepare` permite administrar também o PUT e seus headers exatos. Não registre nem compartilhe a URL assinada.

`memory.checkpoints` lista os resumos, evidências, fatos pendentes e estado de compactação das conversas. Pode filtrar `agent_id` e `conversation_id`; não devolve texto bruto usado na inferência.

| Método SDK | HTTP | Rota |
| --- | --- | --- |
| memory.checkpoints | GET | /ai/memory/checkpoints |
| uploads.prepare | POST | /ai/uploads |
| uploads.complete | POST | /ai/uploads/:id/complete |

## Paridade de agentes (#498)

Publicado no npm em 24/09/2026: SDK 0.4.0 (patch 0.4.1 corrige tipos), CLI 0.2.0 e
MCP 0.3.0 incluem as rotas abaixo. Os contratos seguem o código da API integrada; nada é inferido.

**Configuração do agente.** `config` aceita as ferramentas novas do catálogo
governado (`contacts.search`, `conversations.history`, `crm.search`, `radar.read`,
`cases.note`, `cases.close`, `followups.schedule`, `followups.list` e demais valores
de `AiToolId`), `platform_skills` (`none`/`all`), `data_access.other_contacts`
(opt-in obrigatório para publicar ferramentas que leem outros contatos),
`accountability` (declaração de promessas e sugestão de etapa; cada uma gera
inferência BYOK adicional) e, em `safety`, `additional_rules`, `disclosure_text`,
`commercial_limits`, `guard_sensitivity` e `semantic_evaluator`. A camada do
Cliente só acrescenta regras à política obrigatória da plataforma.

**Confirmações que continuam com a pessoa.**

- `eligibility.saveChannel` substitui modo e lista inteira de telefones de teste
  com CAS (`expected_revision` string). Mudar um canal para `open` libera a IA
  para qualquer contato e exige `confirm_open_to_all: true`; sem isso a API
  responde `open_confirmation_required`. O SDK/CLI/MCP não preenchem esse campo.
- `eligibility.revokeAuthorization` revoga imediatamente (204); resposta ainda
  não admitida para envio não sai mais.
- `commercialProposals.decide` usa `seq` como lock: `409 proposal_changed` exige
  reler a proposta; `409 next_step_changed` indica que o próximo passo do negócio
  mudou (aprove sem efeito ou gere outra proposta). `approve` aplica o efeito no CRM atomicamente;
  `apply_effect: false` aprova sem efeito. Repetir a mesma decisão devolve
  `replayed: true` sem reaplicar. `request` exige `request_key` estável
  (`[A-Za-z0-9_.:-]{1,200}`); responde 202 quando enfileira. Gerar propostas e
  alterar `settings` exigem chave criada por owner/admin ainda autorizado.
- `eligibility.authorizations` só devolve nome e telefone completos quando a chave
  também tem `contacts:read`; com apenas `agents:read`, `contact_name` é `null` e
  `contact_phone` vem mascarado (`••••1234`).
- `styleAdjustments.save` liga/desliga um ajuste da lista fechada
  (`sem_travessao_longo`) com CAS por item; `expected_revision` é `"0"` quando
  nunca foi salvo.
- `memory.reactivateEntry` e `skills.decideNearMiss` são novas aprovações e
  exigem chave criada por owner/admin ainda autorizado.
- `alerts.resolveBulk` resolve só alertas criados até `created_before` que casam
  com `filters`, até 500 por chamada; `remaining` indica o restante.
- `followups.schedulePromise` reabre a conversa pelo agente no horário ajustado à
  janela publicada e pode enviar mensagem. Preserve `operation_key` UUID: repetir
  devolve o mesmo retorno (200 em vez de 201). `outside_window: "template"` envia
  template fora da janela. `resolvePromise` concilia resultado incerto com
  evidência e nunca reenvia.
- `providers.syncCatalog` lê o catálogo com a chave própria na revisão informada;
  nunca altera tarifas. Falha do provedor responde `502 provider_*` sem alteração.

**Leitura e diagnóstico.** `knowledge.searchDiagnostics` e `knowledge.coverage`
são POST com escopo `agents:read`. `knowledge.citations` exige exatamente um de
`execution_id` ou `conversation_id`; citações são dado interno da equipe.
`inferences.list` é paginado por offset e traz `meta.summary` com falhas e pontos
do período (padrão 7 dias, máximo 366). `followups.queue`/`followups.promises`
usam cursor: repita com `cursor = next_cursor` até `null`. `usage.get` aceita
`agent_id` e `purpose`; `agents`, `handoff` e p50/p95 diários são adicionais.
Execuções (`executions.list/get`) e a prévia (`agents.preview`) trazem `security`
aditivo: resumo, eventos de proteção sem texto nem chaves e `events_unavailable`
quando a trilha não pôde ser lida (nunca significa "sem eventos").
`agents.capabilityUsage` e `evolution.get` devolvem erro explícito por fonte em vez
de zero. `cases.reply` pode responder `queued: false` com `queue_reason`; decisão
registrada não é prova de envio. Alertas trazem `resolved_by_api_key` quando
resolvidos por chave. `cases.list` filtra `kind`/`source`; `alerts.list` filtra `kind`/`severity` e cada
linha traz `kind_label`, `guidance` e `links` calculados pelo servidor.

| SDK (`ai.`) | Método | Rota | Scope |
| --- | --- | --- | --- |
| `alerts.resolveBulk` | POST | `/ai/alerts/resolve` | write |
| `cases.events` | GET | `/ai/cases/:id/events` | read |
| `commercialProposals.list` | GET | `/ai/commercial-proposals` | read |
| `commercialProposals.request` | POST | `/ai/commercial-proposals` | write |
| `commercialProposals.decide` | POST | `/ai/commercial-proposals/:id/decision` | write |
| `commercialProposals.jobs` | GET | `/ai/commercial-proposals/jobs` | read |
| `commercialProposals.settings` | GET | `/ai/commercial-proposals/settings` | read |
| `commercialProposals.saveSettings` | PATCH | `/ai/commercial-proposals/settings` | write |
| `eligibility.get` | GET | `/ai/eligibility` | read |
| `eligibility.saveSettings` | PUT | `/ai/eligibility/settings` | write |
| `eligibility.channel` | GET | `/ai/eligibility/channels/:id` | read |
| `eligibility.saveChannel` | PUT | `/ai/eligibility/channels/:id` | write |
| `eligibility.authorizations` | GET | `/ai/eligibility/authorizations` | read |
| `eligibility.revokeAuthorization` | POST | `/ai/eligibility/authorizations/:id/revoke` | write |
| `inferences.list` | GET | `/ai/inferences` | read |
| `knowledge.searchDiagnostics` | POST | `/ai/knowledge/search/diagnostics` | read |
| `knowledge.catalogItems` | GET | `/ai/knowledge/:id/catalog` | read |
| `knowledge.syncCatalog` | POST | `/ai/knowledge/:id/catalog` | write |
| `knowledge.citations` | GET | `/ai/knowledge/citations` | read |
| `knowledge.coverage` | POST | `/ai/knowledge/coverage` | read |
| `memory.entryEvents` | GET | `/ai/memory/entries/:id/events` | read |
| `memory.reactivateEntry` | POST | `/ai/memory/entries/:id/reactivate` | write |
| `notices.diagnostics` | GET | `/ai/notices/diagnostics` | read |
| `notices.effect` | GET | `/ai/notices/effect` | read |
| `operator.metrics` | GET | `/ai/operator-metrics` | read |
| `operator.promises` | GET | `/ai/promises` | read |
| `providers.catalog` | GET | `/ai/providers/catalog` | read |
| `providers.syncCatalog` | POST | `/ai/providers/catalog` | write |
| `skills.nearMisses` | GET | `/ai/skills/near-misses` | read |
| `skills.decideNearMiss` | POST | `/ai/skills/near-misses/:id` | write |
| `skills.composition` | GET | `/ai/skills/composition` | read |
| `followups.queue` | GET | `/ai/followups/queue` | read |
| `followups.promises` | GET | `/ai/followups/promises` | read |
| `followups.schedulePromise` | POST | `/ai/followups/promises` | write |
| `followups.getPromise` | GET | `/ai/followups/promises/:id` | read |
| `followups.cancelPromise` | POST | `/ai/followups/promises/:id/cancel` | write |
| `followups.resolvePromise` | POST | `/ai/followups/promises/:id/resolve` | write |
| `agents.capabilityUsage` | GET | `/ai/agents/:id/capability-usage` | read |
| `evolution.get` | GET | `/ai/evolution` | read |
| `styleAdjustments.list` | GET | `/ai/style-adjustments` | read |
| `styleAdjustments.save` | PUT | `/ai/style-adjustments` | write |

CLI: `botozap ai <módulo> <método>` em kebab-case (ex.: `botozap ai eligibility
save-channel --input-file gate.json`). MCP: `ai_<módulo>_<método>` em snake_case
(ex.: `ai_commercial_proposals_decide`). Chamadas de escrita não são repetidas
automaticamente em erro ou timeout.
