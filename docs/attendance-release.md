# Publicação das ferramentas de Atendimento e CRM

Este candidato acrescenta recursos à API consumida por SDK, CLI e MCP; os métodos
anteriores e seus envelopes continuam disponíveis. Publicar o servidor antes dos
pacotes, com migrations e scopes das ondas correspondentes. Nenhum comando deste
roteiro executa publicação automaticamente.

| Domínio | SDK | CLI | Scopes |
| --- | --- | --- | --- |
| Respostas compartilhadas | `savedReplies` | `saved-replies` | `saved_replies:read/write` |
| Notas, retornos, arquivo e adiamento | `inbox` | `inbox-tools` | `inbox:read/write` |
| Oportunidades e demandas | `opportunities`, `demands` | `opportunities`, `demands` | `crm:read/write` |
| Radar e critérios de etapas | `radar` | `radar` | `crm:read/write` |
| Etapas e campos personalizados | `contactStages`, `contactFields` | `contact-stages`, `contact-fields` | `contacts:read/write` |
| Réguas e execuções | `journeys` | `journeys` | `journeys:read/write` |
| Agenda, serviços, jornadas e exceções | `appointments` | `appointments` | `appointments:read/write` |
| Calendários, sincronização e conflitos | `calendar` | `calendar` | `calendar:read/write` |
| IA BYOK completa, incluindo paridade #498 | `ai.*` | `ai` | `agents:read/write` |
| Atribuições a membros | `conversations.*Assignment(s)` | `assignments` | `conversations:read/write` |

MCP expõe cada operação com schema de entrada e saída estruturada. Atribuições
usam `list_users` para descobrir membros existentes. Respostas pessoais e
rascunhos não são expostos por API key; uma chave representa a Conta, não uma
pessoa. A autorização inicial Google acontece em `/calendarios` com sessão humana;
os pacotes gerenciam somente conexões já autorizadas. Os tokens Google não passam
pelos clientes públicos.

## Concorrência e paginação

- Respostas salvas: `expected_updated_at` integral, incluindo microssegundos, em
  PATCH e DELETE. Não converter para `Date` antes de devolver a versão.
- Inbox: `expected_version` em alterações/exclusão; criação de nota e retorno
  não pede versão. Arquivar/adiar usa `state.operator_version`.
- CRM: `expected_version` nas edições. Vínculos de conversas preservam o contato.
- Radar: `expected_version=0` cria critério; edições usam a versão lida.
- Réguas: PUT substitui a configuração completa e exige `version`; DELETE
  arquiva com `?version=`, retorna registro e preserva histórico. Ocorrências
  usam `occurrence_key` único. Nenhuma falha causa repetição automática no SDK.
- Agenda: campos novos em PATCH exigem `expected_revision`; PATCH legado
  `scheduled_at`/`note` continua compatível. Configurações aceitam PATCH parcial
  com revisão; DELETE de exceção envia revisão no JSON. Criar compromisso aceita
  `{ idempotencyKey }` como segundo argumento do SDK, ou `idempotency_key` no
  input CLI/MCP, enviado exclusivamente no header `Idempotency-Key`.
- IA: [contratos versionados em `/ai`](./ai.md). Revisões opacas de agentes,
  credenciais e bibliotecas são strings; casos/propostas/avisos usam números.
  Preview usa `operation_key` UUID estável e não envia WhatsApp.
- Calendar: selecionar calendário e resolver conflito exigem `expected_revision`.
  `resolveConflict` recebe **ID do compromisso**, não ID da conexão.
- Réguas usam cursor `limit/after`; CRM/Inbox/Agenda/Calendar usam página/offset.
  Histórico/vínculos CRM e histórico Agenda têm 20 itens/página; configurações
  Agenda têm 100. Catálogos de etapas, campos e calendários retornam arrays em
  `{data}` sem paginação; SDK desembrulha esses arrays.

## Exemplo integrado

```ts
import { BotoZap } from '@botozap/sdk';
const bz = new BotoZap({ apiKey: process.env.BOTOZAP_API_KEY! });
const replies = await bz.savedReplies.list({ customer_id: customerId, include_account: true });
const tools = await bz.inbox.get(conversationId);
await bz.inbox.mutate(conversationId, {
  operation: 'reminder_create', body: 'Retomar proposta',
  due_at: '2026-10-01T14:00:00-03:00', assigned_user_id: memberId,
});
const lead = await bz.opportunities.create({
  customer_id: customerId, contact_id: contactId, title: 'Renovação',
  owner_user_id: memberId, next_step: 'Apresentar proposta',
  next_step_at: '2026-10-01T14:00:00-03:00', value_cents: 250000,
});
await bz.opportunities.linkConversation(lead.id, conversationId);
const agenda = await bz.appointments.create({
  contact_id: contactId, scheduled_at: '2026-10-01T14:00:00-03:00',
  ends_at: '2026-10-01T15:00:00-03:00', time_zone: 'America/Sao_Paulo',
  owner_user_id: memberId, opportunity_id: lead.id,
}, { idempotencyKey: 'renewal-meeting-2026-10-01' });
```

CLI aceita `--input-file arquivo.json` em cada comando novo, preservando objetos,
listas, booleanos, null e timestamps sem escape de shell. `--help` mostra campos
obrigatórios; `-o json` fornece saída para scripts. Exemplo de arquivo para
`botozap saved-replies update UUID --input-file reply.json -o json`:

```json
{"title":"Apresentação","body":"Olá {{primeiro_nome}}!","expected_updated_at":"2026-09-22T03:05:06.123456+00:00"}
```

## Checklist de release

- [ ] Servidor com migrations/scopes correspondentes e testes de isolamento.
- [x] `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`.
  Resultado local (com paridade #498): 146 testes SDK, 80 CLI e 120 MCP, todos aprovados.
- [x] `pnpm gate:tarballs`: instala os três tarballs em consumidor limpo, verifica
  ESM/CJS, tipos, bins e MCP real sem credenciais live.
  Com #498: 145 rotas IA descobertas no tarball do MCP (257 ferramentas), sem publicar.
- [x] Versões/changelogs gerados por Changesets: SDK 0.4.0, CLI 0.2.0 e MCP 0.3.0.
  Candidatos empacotados com pnpm, ainda não publicados.
- [ ] Validar smoke do servidor com chave de teste autorizada e scopes mínimos;
  confirmar 403 quando scope ausente e 409 em CAS obsoleto, sem tocar produção.
- [ ] Validar Google OAuth/Calendar, provedor de IA/prévias e envios automáticos com credenciais externas
  próprias, quando disponíveis; testes locais cobrem contratos com mocks.
- [ ] Publicação npm somente após autorização explícita, sobre tarballs validados;
  SDK antes de CLI/MCP. O deploy remoto MCP é outra ação, também posterior.

As operações novas não exigem regenerar chaves antigas para manter integrações
anteriores funcionando. Chaves restritas precisam dos scopes novos apenas para
usar os recursos novos. Os gates de plano, ambiente, canal e consentimento
continuam sendo decididos no servidor.

Radar aceita `entity_type: appointment` e motivos de confirmação, resultado,
conflito e falha de calendário. A definição antiga de agentes desta candidata foi
substituída antes da publicação. Os contratos públicos das ondas anteriores permanecem.

Os gates acima registram a candidata anterior. Para o port completo de IA, gere
novos tarballs e repita o gate; não reutilize os arquivos antigos em release-artifacts.
