import type { BotoZap } from "../../client.js";
import type { OffsetList } from "../../types.js";
import type {
  AiUploadReceiptCallback,
  AiArtifactUploadInput,
  AiPreparedUpload,
  AiConversationCheckpoint,
  AiCaseReplyInput,
  AiCaseReply,
  AiCaseChat,
  AiKnowledgeImport,
  AiKnowledgeConversation,
  AiKnowledgePreview,
  AiPlatformSkill,
  AiFlowVersion,
  AiFollowupEffect,
  AiFollowupEvent,
  AiSkillVersion,
  AiRouterTest,
  AiProviderModel,
  AiUsageSummary,
  AiBudget,
  AiRate,
  AiAgent,
  AiAgentInput,
  AiAgentVersion,
  AiAlert,
  AiBinding,
  AiBindingTarget,
  AiBudgetInput,
  AiCase,
  AiCredential,
  AiDraftResult,
  AiEnrollment,
  AiExecution,
  AiFlow,
  AiFlowInput,
  AiKnowledgeChunk,
  AiKnowledgeSource,
  AiMemory,
  AiMemoryEntry,
  AiNoticeJob,
  AiNoticeSettings,
  AiPage,
  AiProposal,
  AiProvider,
  AiConfigurablePurpose,
  AiRateInput,
  AiRecord,
  AiRevision,
  AiRouter,
  AiRouterConfig,
  AiScope,
  AiSkill,
  AiSkillInput,
  AiSourceKind,
} from "./types.js";
import { assertAudioPricing } from "./audio-pricing.js";
import { uploadArtifact } from "./upload.js";
import { AI_OPERATIONS, type AiOperation } from "./operations.js";
export * from "./types.js";
export * from "./operations.js";

function request<T>(client: BotoZap, op: AiOperation, raw: object): Promise<T> {
  const input = { ...raw } as Record<string, unknown>;
  if (
    op.group === "usage" &&
    op.name === "saveRate" &&
    input.audio_pricing !== undefined
  )
    assertAudioPricing(input.audio_pricing);
  const path = op.path.replace(/:([a-z_]+)/g, (_, key: string) => {
    const value = input[key];
    if (typeof value !== "string" || !value)
      throw new Error(`Campo obrigatório: ${key}`);
    delete input[key];
    return encodeURIComponent(value);
  });
  if (op.shape === "multipart") {
    const { file, file_name, ...fields } = input;
    if (!(file instanceof Blob) || typeof file_name !== "string")
      throw new Error("Informe file Blob e file_name.");
    const limit = op.group === "skills" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (!file.size || file.size > limit)
      throw new Error("Arquivo vazio ou excede o limite do upload.");
    return uploadArtifact<T>(client, {
      ...fields,
      file,
      file_name,
      kind: op.group === "skills" ? "skill" : "knowledge",
    });
  }
  const opts =
    op.method === "GET"
      ? { query: input as Record<string, string | number | undefined> }
      : { body: input };
  if (op.shape === "empty") return client.request<T>(op.method, path, opts);
  if (op.shape === "offset")
    return client.requestOffsetList<T>(op.method, path, opts);
  return client.requestItem<T>(op.method, path, opts);
}
export class AiAgentsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/agents */
  list(input: AiPage): Promise<OffsetList<AiAgent>> {
    return request(this.client, AI_OPERATIONS[0]!, input);
  }
  /** GET /ai/agents/:id */
  get(
    input: AiScope & { id: string },
  ): Promise<{ agent: AiAgent; versions: AiAgentVersion[] }> {
    return request(this.client, AI_OPERATIONS[1]!, input);
  }
  /** POST /ai/agents */
  create(input: AiAgentInput): Promise<AiDraftResult> {
    return request(this.client, AI_OPERATIONS[2]!, input);
  }
  /** PUT /ai/agents/:id */
  saveDraft(
    input: AiAgentInput & { id: string; expected_revision?: string },
  ): Promise<AiDraftResult> {
    return request(this.client, AI_OPERATIONS[3]!, input);
  }
  /** Publica versão e altera próximos atendimentos; confira a versão antes de executar. */
  publish(
    input: AiRevision & { id: string } & { version_id: string },
  ): Promise<{ version_id: string; number: number }> {
    return request(this.client, AI_OPERATIONS[4]!, input);
  }
  /** Restaura versão para edição; não ativa atendimento. */
  restore(
    input: AiScope & { id: string } & {
      version_id: string;
      expected_draft_revision?: string;
    },
  ): Promise<AiDraftResult> {
    return request(this.client, AI_OPERATIONS[5]!, input);
  }
  /** POST /ai/agents/:id/duplicate */
  duplicate(
    input: AiScope & { id: string } & { name: string },
  ): Promise<AiDraftResult> {
    return request(this.client, AI_OPERATIONS[6]!, input);
  }
  /** Ativar automático pode enviar respostas; exige intenção explícita do usuário. */
  operation(
    input: AiRevision & { id: string } & {
      mode: "automatic" | "assisted";
      paused: boolean;
    },
  ): Promise<{
    revision: string;
    paused: boolean;
    mode: "automatic" | "assisted";
  }> {
    return request(this.client, AI_OPERATIONS[7]!, input);
  }
  /** POST /ai/agents/:id/archive */
  archive(
    input: AiRevision & { id: string } & { archived: boolean },
  ): Promise<{ id: string; revision: string; archived: boolean }> {
    return request(this.client, AI_OPERATIONS[8]!, input);
  }
  /** Teste livre BYOK sem enviar ao WhatsApp; ferramentas simuladas. Preserve operation_key UUID em resultado incerto. */
  preview(
    input: AiScope & { id: string } & {
      version_id: string;
      operation_key: string;
      messages: { role: "user" | "assistant"; content: string }[];
    },
  ): Promise<AiExecution> {
    return request(this.client, AI_OPERATIONS[9]!, input);
  }
}
export class AiCredentialsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/credentials */
  list(input: AiScope): Promise<AiCredential[]> {
    return request(this.client, AI_OPERATIONS[10]!, input);
  }
  /** GET /ai/credentials/:id */
  get(input: AiScope & { id: string }): Promise<AiCredential> {
    return request(this.client, AI_OPERATIONS[11]!, input);
  }
  /** Cria credencial própria no Vault; a resposta nunca contém a chave. */
  create(
    input: AiScope & { provider: AiProvider; label: string; key: string },
  ): Promise<AiCredential> {
    return request(this.client, AI_OPERATIONS[12]!, input);
  }
  /** Rotação mantém ID; envie key sozinha ou label/active. CAS obrigatório. */
  update(
    input: AiRevision & { id: string } & (
        | { key: string; label?: never; active?: never }
        | { key?: never; label?: string; active?: boolean }
      ),
  ): Promise<AiCredential> {
    return request(this.client, AI_OPERATIONS[13]!, input);
  }
  /** POST /ai/credentials/:id/revalidate */
  revalidate(input: AiRevision & { id: string }): Promise<AiCredential> {
    return request(this.client, AI_OPERATIONS[14]!, input);
  }
  /** DELETE /ai/credentials/:id */
  remove(input: AiRevision & { id: string }): Promise<void> {
    return request(this.client, AI_OPERATIONS[15]!, input);
  }
}
export class AiProvidersResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/providers */
  get(input: AiScope): Promise<{
    providers: AiRecord[];
    purposes: Record<string, string>;
    credentials: AiCredential[];
    bindings: AiBinding[];
    configurable_purposes: AiConfigurablePurpose[];
    configuration_sources: Record<
      "agent_turn" | "agent_operator" | "router",
      string
    >;
  }> {
    return request(this.client, AI_OPERATIONS[16]!, input);
  }
  /** PUT /ai/providers */
  saveBinding(
    input: AiScope &
      AiBindingTarget & {
        purpose: AiConfigurablePurpose;
        fallback?: AiBindingTarget | null;
      },
  ): Promise<AiBinding> {
    return request(this.client, AI_OPERATIONS[17]!, input);
  }
  /** DELETE /ai/providers */
  removeBinding(
    input: AiScope & { purpose: AiConfigurablePurpose },
  ): Promise<void> {
    return request(this.client, AI_OPERATIONS[18]!, input);
  }
  /** GET /ai/providers/:provider/models */
  models(
    input: AiScope & { provider: AiProvider; credential_id: string },
  ): Promise<AiProviderModel[]> {
    return request(this.client, AI_OPERATIONS[19]!, input);
  }
}
export class AiExecutionsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/executions */
  list(
    input: AiPage & { agent_id?: string; status?: AiExecution["status"] },
  ): Promise<OffsetList<AiExecution>> {
    return request(this.client, AI_OPERATIONS[20]!, input);
  }
  /** GET /ai/executions/:id */
  get(
    input: AiScope & { id: string } & { agent_id: string },
  ): Promise<AiExecution> {
    return request(this.client, AI_OPERATIONS[21]!, input);
  }
  /** Aprova plano imutável e pode enviar resposta; confirme conteúdo com usuário. Operador executa ações sem enviar. Ator é a chave autenticada. */
  decide(
    input: AiScope & { id: string } & {
      agent_id: string;
      decision: "approve" | "reject";
    },
  ): Promise<AiExecution> {
    return request(this.client, AI_OPERATIONS[22]!, input);
  }
}
export class AiKnowledgeResource {
  importSource(input: AiKnowledgeImport): Promise<AiKnowledgeSource> {
    return request(this.client, AI_OPERATIONS[99]!, input);
  }
  conversations(input: AiScope): Promise<AiKnowledgeConversation[]> {
    return request(this.client, AI_OPERATIONS[100]!, input);
  }
  conversationPermission(
    input: AiScope & {
      id: string;
      expected_revision: string;
      allowed: boolean;
    },
  ): Promise<{ conversation_id: string; allowed: boolean; revision: string }> {
    return request(this.client, AI_OPERATIONS[101]!, input);
  }
  conversationPreview(
    input: AiScope & { id: string },
  ): Promise<AiKnowledgePreview> {
    return request(this.client, AI_OPERATIONS[102]!, input);
  }

  constructor(private readonly client: BotoZap) {}
  /** GET /ai/knowledge */
  list(input: AiScope): Promise<AiKnowledgeSource[]> {
    return request(this.client, AI_OPERATIONS[23]!, input);
  }
  /** GET /ai/knowledge/:id */
  get(input: AiScope & { id: string }): Promise<{
    source: AiKnowledgeSource;
    text: string | null;
    file_name: string | null;
    versions: AiRecord[];
    usages: AiRecord[];
  }> {
    return request(this.client, AI_OPERATIONS[24]!, input);
  }
  /** POST /ai/knowledge */
  create(
    input: AiScope & { name: string; kind: AiSourceKind; text: string },
  ): Promise<AiKnowledgeSource> {
    return request(this.client, AI_OPERATIONS[25]!, input);
  }
  /** PATCH /ai/knowledge/:id */
  update(
    input: AiRevision & { id: string } & {
      name?: string;
      active?: boolean;
      text?: string;
    },
  ): Promise<AiKnowledgeSource> {
    return request(this.client, AI_OPERATIONS[26]!, input);
  }
  /** DELETE /ai/knowledge/:id */
  remove(input: AiRevision & { id: string }): Promise<void> {
    return request(this.client, AI_OPERATIONS[27]!, input);
  }
  /** POST /ai/knowledge/:id/reindex */
  reindex(input: AiRevision & { id: string }): Promise<AiKnowledgeSource> {
    return request(this.client, AI_OPERATIONS[28]!, input);
  }
  /** GET /ai/knowledge/:id/chunks */
  chunks(input: AiScope & { id: string }): Promise<AiKnowledgeChunk[]> {
    return request(this.client, AI_OPERATIONS[29]!, input);
  }
  /** Busca somente nas fontes permitidas; pode chamar embeddings BYOK. */
  search(
    input: AiScope & {
      source_ids: string[];
      query: string;
      top_k?: number;
      threshold?: number;
    },
  ): Promise<
    (AiKnowledgeChunk & { source_name: string; similarity: number })[]
  > {
    return request(this.client, AI_OPERATIONS[30]!, input);
  }
  /** Upload de documento de até 10 MiB para indexação BYOK. */
  upload(
    input: AiScope & {
      name: string;
      file: Blob;
      file_name: string;
      onUploadPrepared?: AiUploadReceiptCallback;
    },
  ): Promise<AiKnowledgeSource> {
    return request(this.client, AI_OPERATIONS[31]!, input);
  }
}
export class AiMemoryResource {
  checkpoints(
    input: AiScope & { agent_id?: string; conversation_id?: string },
  ): Promise<AiConversationCheckpoint[]> {
    return request(this.client, AI_OPERATIONS[105]!, input);
  }

  constructor(private readonly client: BotoZap) {}
  /** GET /ai/memory */
  get(input: AiScope): Promise<AiMemory> {
    return request(this.client, AI_OPERATIONS[32]!, input);
  }
  /** Publica nova memória de negócio versionada. */
  publish(input: AiRevision & { content: string }): Promise<AiMemory> {
    return request(this.client, AI_OPERATIONS[33]!, input);
  }
  /** PATCH /ai/memory */
  setEnabled(input: AiRevision & { enabled: boolean }): Promise<AiMemory> {
    return request(this.client, AI_OPERATIONS[34]!, input);
  }
  /** GET /ai/memory/versions */
  versions(
    input: AiScope,
  ): Promise<
    { id: string; revision: string; content: string; created_at: string }[]
  > {
    return request(this.client, AI_OPERATIONS[35]!, input);
  }
  /** GET /ai/memory/entries */
  entries(
    input: AiScope & {
      status?: "active" | "pending" | "archived";
      contact_id?: string;
    },
  ): Promise<AiMemoryEntry[]> {
    return request(this.client, AI_OPERATIONS[36]!, input);
  }
  /** POST /ai/memory/entries */
  createEntry(
    input: AiScope & { title: string; body: string; contact_id?: string },
  ): Promise<AiMemoryEntry> {
    return request(this.client, AI_OPERATIONS[37]!, input);
  }
  /** PATCH /ai/memory/entries/:id */
  updateEntry(
    input: AiRevision & { id: string } & { title: string; body: string },
  ): Promise<AiMemoryEntry> {
    return request(this.client, AI_OPERATIONS[38]!, input);
  }
  /** DELETE /ai/memory/entries/:id */
  archiveEntry(input: AiRevision & { id: string }): Promise<AiMemoryEntry> {
    return request(this.client, AI_OPERATIONS[39]!, input);
  }
  /** Aprova memória pendente após revisão explícita; ator é chave autenticada de owner/admin atual. */
  approveEntry(input: AiRevision & { id: string }): Promise<AiMemoryEntry> {
    return request(this.client, AI_OPERATIONS[40]!, input);
  }
}
export class AiSkillsResource {
  catalog(input: AiScope): Promise<AiPlatformSkill[]> {
    return request(this.client, AI_OPERATIONS[103]!, input);
  }
  install(
    input: AiScope & { slug: string; version_id: string },
  ): Promise<AiSkill> {
    return request(this.client, AI_OPERATIONS[104]!, input);
  }

  constructor(private readonly client: BotoZap) {}
  /** GET /ai/skills */
  list(input: AiScope): Promise<AiSkill[]> {
    return request(this.client, AI_OPERATIONS[41]!, input);
  }
  /** GET /ai/skills/:id */
  get(input: AiScope & { id: string }): Promise<{
    skill: AiSkill;
    versions: AiSkillVersion[];
    usages: AiRecord[];
  }> {
    return request(this.client, AI_OPERATIONS[42]!, input);
  }
  /** POST /ai/skills */
  create(input: AiScope & AiSkillInput): Promise<AiSkill> {
    return request(this.client, AI_OPERATIONS[43]!, input);
  }
  /** PATCH /ai/skills/:id */
  update(input: AiRevision & { id: string } & AiSkillInput): Promise<AiSkill> {
    return request(this.client, AI_OPERATIONS[44]!, input);
  }
  /** DELETE /ai/skills/:id */
  remove(input: AiRevision & { id: string }): Promise<void> {
    return request(this.client, AI_OPERATIONS[45]!, input);
  }
  /** GET /ai/skills/:id/versions */
  versions(input: AiScope & { id: string }): Promise<AiSkillVersion[]> {
    return request(this.client, AI_OPERATIONS[46]!, input);
  }
  /** GET /ai/skills/:id/references */
  reference(
    input: AiScope & { id: string } & { version_id: string; path: string },
  ): Promise<{ content: string }> {
    return request(this.client, AI_OPERATIONS[47]!, input);
  }
  /** Importa pacote ZIP até 5 MiB; substituir exige id e expected_revision juntos. */
  importZip(
    input: AiScope & {
      id?: string;
      expected_revision?: string;
      file: Blob;
      file_name: string;
      onUploadPrepared?: AiUploadReceiptCallback;
    },
  ): Promise<AiSkill> {
    return request(this.client, AI_OPERATIONS[48]!, input);
  }
}
export class AiFollowupFlowsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/followup-flows */
  list(input: AiScope): Promise<AiFlow[]> {
    return request(this.client, AI_OPERATIONS[49]!, input);
  }
  /** GET /ai/followup-flows/:id */
  get(input: AiScope & { id: string }): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[50]!, input);
  }
  /** POST /ai/followup-flows */
  create(input: AiFlowInput): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[51]!, input);
  }
  /** PUT /ai/followup-flows/:id */
  update(
    input: AiFlowInput & { id: string; expected_revision: string },
  ): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[52]!, input);
  }
  /** PATCH /ai/followup-flows/:id */
  control(
    input: AiRevision & { id: string } & {
      status: "active" | "paused" | "archived";
    },
  ): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[53]!, input);
  }
  /** Publica grafo validado; mensagens futuras respeitam consentimento, janelas e aprovação assistida. */
  publish(input: AiRevision & { id: string }): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[54]!, input);
  }
  /** GET /ai/followup-flows/:id/versions */
  versions(input: AiScope & { id: string }): Promise<AiFlowVersion[]> {
    return request(this.client, AI_OPERATIONS[55]!, input);
  }
  /** Restaura e publica uma nova versão atomicamente; confirme substituição do rascunho. */
  rollback(
    input: AiRevision & { id: string } & { version_id: string },
  ): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[56]!, input);
  }
  /** GET /ai/followup-flows/from-model */
  models(input: Record<string, never> = {}): Promise<AiRecord[]> {
    return request(this.client, AI_OPERATIONS[57]!, input);
  }
  /** POST /ai/followup-flows/from-model */
  installModel(
    input: AiScope & { model_id: string; name?: string; stage_id?: string },
  ): Promise<AiFlow> {
    return request(this.client, AI_OPERATIONS[58]!, input);
  }
}
export class AiFollowupsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/followups/enrollments */
  list(
    input: AiScope & {
      flow_id?: string;
      contact_id?: string;
      status?: string;
      limit?: number;
    },
  ): Promise<AiEnrollment[]> {
    return request(this.client, AI_OPERATIONS[59]!, input);
  }
  /** GET /ai/followups/enrollments/:id */
  get(input: AiScope & { id: string }): Promise<{
    enrollment: AiEnrollment;
    events: AiFollowupEvent[];
    effects: AiFollowupEffect[];
  }> {
    return request(this.client, AI_OPERATIONS[60]!, input);
  }
  /** Inicia acompanhamento que pode enviar mensagens; preserve operation_key UUID. */
  enroll(
    input: AiScope & {
      flow_id: string;
      contact_id: string;
      conversation_id: string;
      operation_key: string;
      agent_id?: string;
      appointment_id?: string;
    },
  ): Promise<AiEnrollment> {
    return request(this.client, AI_OPERATIONS[61]!, input);
  }
  /** POST /ai/followups/enrollments/:id/control */
  control(
    input: AiRevision & { id: string } & {
      action: "pause" | "resume" | "postpone" | "skip" | "cancel";
      due_at?: string;
      branch_id?: string;
      note?: string;
    },
  ): Promise<AiEnrollment> {
    return request(this.client, AI_OPERATIONS[62]!, input);
  }
  /** Aprova/rejeita mensagem imutável após revisão. Não aceita texto substituto nem actor_id. */
  decideEffect(
    input: AiScope & { id: string } & { approve: boolean },
  ): Promise<AiRecord> {
    return request(this.client, AI_OPERATIONS[63]!, input);
  }
  /** Concilia resultado incerto com evidência. Sem dispatch só cancelled; sent exige wamid. Nunca reenvia unknown. */
  resolveEffect(
    input: AiScope & { id: string } & {
      outcome: "sent" | "rejected" | "cancelled";
      note: string;
      wamid?: string;
    },
  ): Promise<{ resolved: true }> {
    return request(this.client, AI_OPERATIONS[64]!, input);
  }
}
export class AiRoutersResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/routers */
  list(input: AiScope): Promise<AiRouter[]> {
    return request(this.client, AI_OPERATIONS[65]!, input);
  }
  /** GET /ai/routers/:id */
  get(input: AiScope & { id: string }): Promise<AiRouter> {
    return request(this.client, AI_OPERATIONS[66]!, input);
  }
  /** POST /ai/routers */
  create(input: AiScope & { config: AiRouterConfig }): Promise<AiRouter> {
    return request(this.client, AI_OPERATIONS[67]!, input);
  }
  /** Edição de roteador ativo aplica imediatamente e invalida classificações da revisão anterior. */
  update(
    input: AiRevision & { id: string } & { config: AiRouterConfig },
  ): Promise<AiRouter> {
    return request(this.client, AI_OPERATIONS[68]!, input);
  }
  /** Desativa e arquiva preservando histórico; não ativa outro responsável. */
  archive(input: AiRevision & { id: string }): Promise<{ archived: true }> {
    return request(this.client, AI_OPERATIONS[69]!, input);
  }
  /** Tomar canal exige confirmação explícita, replace_current e CAS expected_owner_agent_id; não substitui outro roteador. */
  operation(
    input: AiRevision & { id: string } & {
      active: boolean;
      replace_current?: boolean;
      expected_owner_agent_id?: string | null;
    },
  ): Promise<AiRouter> {
    return request(this.client, AI_OPERATIONS[70]!, input);
  }
  /** Classifica com BYOK sem encaminhar nem enviar; preserve UUID da tentativa. */
  test(
    input: AiScope & { id: string } & {
      text: string;
      request_key: string;
      sticky_agent_id?: string | null;
      sticky_intent?: string | null;
    },
  ): Promise<AiRouterTest> {
    return request(this.client, AI_OPERATIONS[71]!, input);
  }
  /** Ativa membro sem criar vínculo direto com canal. */
  activateMember(
    input: AiRevision & { id: string } & {
      agent_id: string;
      mode: "automatic" | "assisted";
    },
  ): Promise<AiRecord> {
    return request(this.client, AI_OPERATIONS[72]!, input);
  }
}
export class AiCasesResource {
  reply(input: AiCaseReplyInput): Promise<AiCaseReply> {
    return request(this.client, AI_OPERATIONS[96]!, input);
  }
  consult(
    input: AiScope & { id: string; operation_key: string; question: string },
  ): Promise<AiCaseChat> {
    return request(this.client, AI_OPERATIONS[97]!, input);
  }
  chatHistory(input: AiPage & { id: string }): Promise<OffsetList<AiCaseChat>> {
    return request(this.client, AI_OPERATIONS[98]!, input);
  }

  constructor(private readonly client: BotoZap) {}
  /** GET /ai/cases */
  list(
    input: AiPage & { status?: AiCase["status"] },
  ): Promise<OffsetList<AiCase>> {
    return request(this.client, AI_OPERATIONS[73]!, input);
  }
  /** GET /ai/cases/:id */
  get(input: AiScope & { id: string }): Promise<AiCase> {
    return request(this.client, AI_OPERATIONS[74]!, input);
  }
  /** GET /ai/cases/:id/messages */
  messages(input: AiPage & { id: string }): Promise<
    OffsetList<{
      id: string;
      author_user_id: string | null;
      author_agent_id: string | null;
      body: string;
      created_at: string;
    }>
  > {
    return request(this.client, AI_OPERATIONS[75]!, input);
  }
  /** Atualiza caso; resume_agent pode retomar automação e exige intenção explícita. */
  update(
    input: AiScope & { id: string } & {
      expected_revision: number;
      status?: AiCase["status"];
      assigned_user_id?: string | null;
      message?: string;
      resume_agent?: boolean;
    },
  ): Promise<AiCase> {
    return request(this.client, AI_OPERATIONS[76]!, input);
  }
}
export class AiAlertsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/alerts */
  list(
    input: AiPage & { status?: AiAlert["status"] },
  ): Promise<OffsetList<AiAlert>> {
    return request(this.client, AI_OPERATIONS[77]!, input);
  }
  /** PATCH /ai/alerts/:id */
  update(
    input: AiScope & { id: string } & {
      expected_revision: number;
      status: AiAlert["status"];
    },
  ): Promise<AiAlert> {
    return request(this.client, AI_OPERATIONS[78]!, input);
  }
}
export class AiNoticesResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/notices */
  get(input: AiScope): Promise<AiNoticeSettings> {
    return request(this.client, AI_OPERATIONS[79]!, input);
  }
  /** PATCH /ai/notices */
  update(
    input: AiScope &
      Omit<
        AiNoticeSettings,
        "revision" | "consent_confirmed_at" | "updated_at"
      > & { consent_confirmed: boolean; expected_revision: number },
  ): Promise<AiNoticeSettings> {
    return request(this.client, AI_OPERATIONS[80]!, input);
  }
  /** GET /ai/notices/options */
  options(input: AiScope): Promise<AiRecord> {
    return request(this.client, AI_OPERATIONS[81]!, input);
  }
  /** GET /ai/notices/jobs */
  jobs(input: AiPage): Promise<OffsetList<AiNoticeJob>> {
    return request(this.client, AI_OPERATIONS[82]!, input);
  }
  /** Envia template real ao destinatário autorizado. Exige confirmação explícita e confirm_send:true. */
  test(
    input: AiScope & { operation_key: string; confirm_send: true },
  ): Promise<{ id: string }> {
    return request(this.client, AI_OPERATIONS[83]!, input);
  }
  /** Reenfileira apenas falha confirmada; unknown não admite retry. */
  retry(input: AiScope & { id: string }): Promise<{ queued: true }> {
    return request(this.client, AI_OPERATIONS[84]!, input);
  }
}
export class AiProposalsResource {
  constructor(private readonly client: BotoZap) {}
  /** GET /ai/proposals */
  list(
    input: AiPage & { agent_id?: string; status?: AiProposal["status"] },
  ): Promise<OffsetList<AiProposal>> {
    return request(this.client, AI_OPERATIONS[85]!, input);
  }
  /** Aplicar playbook publica NOVA versão atomicamente; memória entra na base. Revise conteúdo e evidência, obtenha confirmação antes de aplicar. */
  decide(
    input: AiScope & { id: string } & {
      expected_revision: number;
      decision: "apply" | "reject";
      reason?: string;
    },
  ): Promise<AiProposal> {
    return request(this.client, AI_OPERATIONS[86]!, input);
  }
  /** Analisa execuções via BYOK e gera propostas pendentes, sem aprovação automática. */
  analyze(
    input: AiScope & { agent_id: string; limit?: number },
  ): Promise<AiRecord> {
    return request(this.client, AI_OPERATIONS[87]!, input);
  }
  /** GET /ai/proposals/settings */
  settings(input: AiScope): Promise<{ enabled: boolean; revision: number }> {
    return request(this.client, AI_OPERATIONS[88]!, input);
  }
  /** PATCH /ai/proposals/settings */
  saveSettings(
    input: AiScope & { enabled: boolean; expected_revision: number },
  ): Promise<{ enabled: boolean; revision: number }> {
    return request(this.client, AI_OPERATIONS[89]!, input);
  }
}
export class AiUsageResource {
  constructor(private readonly client: BotoZap) {}
  /** Medições e estimativas de consumo BYOK, sem cobrança ou crédito BotoZap. */
  get(input: AiScope & { from?: string; to?: string }): Promise<AiRecord> {
    return request(this.client, AI_OPERATIONS[90]!, input);
  }
  /** GET /ai/usage/budget */
  budget(input: AiScope): Promise<AiBudget> {
    return request(this.client, AI_OPERATIONS[91]!, input);
  }
  /** PATCH /ai/usage/budget */
  saveBudget(input: AiBudgetInput): Promise<AiBudget> {
    return request(this.client, AI_OPERATIONS[92]!, input);
  }
  /** GET /ai/usage/rates */
  rates(input: AiScope): Promise<AiRate[]> {
    return request(this.client, AI_OPERATIONS[93]!, input);
  }
  /** PUT /ai/usage/rates */
  saveRate(input: AiRateInput): Promise<AiRate> {
    return request(this.client, AI_OPERATIONS[94]!, input);
  }
  /** Aplica tarifa própria a medições sem preço; não gera cobrança BotoZap. Exige confirmação. */
  reprice(
    input: AiScope & {
      provider: AiProvider;
      model: string;
      expected_revision: number;
      confirm: true;
    },
  ): Promise<{ updated: number }> {
    return request(this.client, AI_OPERATIONS[95]!, input);
  }
}
export class AiUploadsResource {
  constructor(private readonly client: BotoZap) {}
  prepare(input: AiArtifactUploadInput): Promise<AiPreparedUpload> {
    return request(this.client, AI_OPERATIONS[106]!, input);
  }
  complete(
    input: AiScope & { id: string },
  ): Promise<AiKnowledgeSource | AiSkill> {
    return request(this.client, AI_OPERATIONS[107]!, input);
  }
}
export class Ai {
  readonly uploads: AiUploadsResource;
  readonly agents: AiAgentsResource;
  readonly credentials: AiCredentialsResource;
  readonly providers: AiProvidersResource;
  readonly executions: AiExecutionsResource;
  readonly knowledge: AiKnowledgeResource;
  readonly memory: AiMemoryResource;
  readonly skills: AiSkillsResource;
  readonly followupFlows: AiFollowupFlowsResource;
  readonly followups: AiFollowupsResource;
  readonly routers: AiRoutersResource;
  readonly cases: AiCasesResource;
  readonly alerts: AiAlertsResource;
  readonly notices: AiNoticesResource;
  readonly proposals: AiProposalsResource;
  readonly usage: AiUsageResource;
  constructor(private readonly client: BotoZap) {
    this.uploads = new AiUploadsResource(client);
    this.agents = new AiAgentsResource(client);
    this.credentials = new AiCredentialsResource(client);
    this.providers = new AiProvidersResource(client);
    this.executions = new AiExecutionsResource(client);
    this.knowledge = new AiKnowledgeResource(client);
    this.memory = new AiMemoryResource(client);
    this.skills = new AiSkillsResource(client);
    this.followupFlows = new AiFollowupFlowsResource(client);
    this.followups = new AiFollowupsResource(client);
    this.routers = new AiRoutersResource(client);
    this.cases = new AiCasesResource(client);
    this.alerts = new AiAlertsResource(client);
    this.notices = new AiNoticesResource(client);
    this.proposals = new AiProposalsResource(client);
    this.usage = new AiUsageResource(client);
  }
  /** Executes only a declared operation. Prefer typed module methods in application code. */
  invoke(
    group: string,
    name: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const op = AI_OPERATIONS.find((o) => o.group === group && o.name === name);
    if (!op) throw new Error("Operação IA desconhecida.");
    return request(this.client, op, input);
  }
}
