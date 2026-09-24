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
adapter. `providers.saveBinding` aceita `default`, `followup`, `proposal`,
`transcription` e `embedding`. `agent_turn` e `agent_operator` são configurados na
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

O SDK usa multipart. Documento: até 10 MiB; ZIP: até 5 MiB. A CLI lê o arquivo
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

`knowledge.upload` (10 MiB) e `skills.importZip` (5 MiB) calculam SHA-256, preparam a intenção, enviam bytes por PUT direto ao armazenamento e finalizam pelo mesmo `upload_id`. CLI e MCP usam esse transporte automaticamente. As rotas multipart anteriores permanecem para compatibilidade; arquivos grandes devem usar o transporte direto para não atravessar o limite HTTP da hospedagem.

Nenhum token BotoZap ou cookie é enviado ao armazenamento. O SDK preserva em memória a intenção para retries com os mesmos bytes: falha do PUT repete o PUT; falha ao finalizar repete apenas a finalização. `upload_expired` confirmado permite começar outra intenção. Para persistir a retomada entre processos, use `onUploadPrepared: ({upload_id}) => salvar(upload_id)`; após o PUT, `ai.uploads.complete({customer_id,id:upload_id})` devolve o mesmo recurso em caso de resposta anterior perdida. A API de baixo nível `ai.uploads.prepare` permite administrar também o PUT e seus headers exatos. Não registre nem compartilhe a URL assinada.

`memory.checkpoints` lista os resumos, evidências, fatos pendentes e estado de compactação das conversas. Pode filtrar `agent_id` e `conversation_id`; não devolve texto bruto usado na inferência.

| Método SDK | HTTP | Rota |
| --- | --- | --- |
| memory.checkpoints | GET | /ai/memory/checkpoints |
| uploads.prepare | POST | /ai/uploads |
| uploads.complete | POST | /ai/uploads/:id/complete |
