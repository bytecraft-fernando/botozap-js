/**
 * Audited MCP effect hints for the explicit AI operation catalog.
 *
 * Every SDK operation is named here on purpose. Do not derive these values from
 * HTTP verbs or API scopes: some POSTs only read, and some GETs call a provider.
 * When AI_OPERATIONS gains an entry, tool registration must call
 * getAiToolEffects and fail until that entry is reviewed and classified.
 */
export type AiToolEffects = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};
type EffectClass = Omit<AiToolEffects, "idempotentHint">;

const READ: EffectClass = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};
const READ_EXTERNAL: EffectClass = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
};
const WRITE: EffectClass = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};
const WRITE_EXTERNAL: EffectClass = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
};
const DESTRUCTIVE: EffectClass = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
};
const DESTRUCTIVE_EXTERNAL: EffectClass = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: true,
};

const effects = new Map<string, EffectClass>();

function classify(
  names: readonly string[],
  value: EffectClass,
): void {
  for (const name of names) {
    if (effects.has(name)) throw new Error(`Operação de IA classificada duas vezes: ${name}`);
    effects.set(name, value);
  }
}

// Bounded account-scoped reads.
classify([
  "agents.list", "agents.get", "agents.capabilityUsage",
  "credentials.list", "credentials.get",
  "providers.get",
  "executions.list", "executions.get",
  "knowledge.list", "knowledge.get", "knowledge.chunks",
  "knowledge.conversations", "knowledge.conversationPreview",
  "memory.get", "memory.versions", "memory.entries", "memory.checkpoints", "memory.entryEvents",
  "skills.list", "skills.get", "skills.versions", "skills.reference", "skills.catalog",
  "skills.nearMisses", "skills.composition",
  "followupFlows.list", "followupFlows.get", "followupFlows.versions", "followupFlows.models",
  "followups.list", "followups.get", "followups.queue", "followups.promises", "followups.getPromise",
  "routers.list", "routers.get",
  "cases.list", "cases.get", "cases.messages", "cases.events", "cases.chatHistory",
  "alerts.list",
  "notices.get", "notices.options", "notices.jobs", "notices.diagnostics", "notices.effect",
  "proposals.list", "proposals.settings",
  "usage.get", "usage.budget", "usage.rates",
  "commercialProposals.list", "commercialProposals.jobs", "commercialProposals.settings",
  "eligibility.get", "eligibility.channel", "eligibility.authorizations",
  "inferences.list",
  "knowledge.catalogItems", "knowledge.citations", "knowledge.coverage",
  "providers.catalog",
  "operator.metrics", "operator.promises", "evolution.get",
  "styleAdjustments.list",
], READ);

// Reads that contact a configured provider or execute a remote inference/query.
classify([
  "providers.models",
], READ_EXTERNAL);

// Additive changes confined to BotoZap's account-scoped state.
classify([
  "agents.create", "agents.duplicate",
  "routers.create",
  "credentials.create",
  "knowledge.create",
  "memory.createEntry", "memory.setEnabled",
  "skills.create", "skills.importZip", "skills.install",
  "followupFlows.create", "followupFlows.installModel",
  "commercialProposals.request",
  // Acknowledge/resolve one alert: internal state that resolve_ai_alert can
  // reopen (status back to open), so it is reversible.
  "alerts.update",
], WRITE);

// Writes that also call a provider, upload/download external content, or run a
// remote AI/tool execution. Local persistence may happen as part of the call.
classify([
  "agents.preview",
  "credentials.revalidate",
  "knowledge.upload", "knowledge.importSource",
  "routers.test",
  "cases.consult",
  "providers.syncCatalog",
  "proposals.analyze", "knowledge.search", "knowledge.searchDiagnostics",
  "uploads.prepare", "uploads.complete",
], WRITE_EXTERNAL);

// Account state whose replacement, deletion, approval, activation, or commit can
// be difficult to reverse or can change subsequent live behavior.
classify([
  "agents.saveDraft", "agents.restore", "agents.archive",
  "credentials.update", "credentials.remove",
  "providers.saveBinding", "providers.removeBinding",
  "knowledge.update", "knowledge.remove", "knowledge.reindex",
  "memory.updateEntry", "memory.publish", "memory.archiveEntry", "memory.approveEntry", "memory.reactivateEntry",
  "skills.update", "skills.remove", "skills.decideNearMiss",
  "followupFlows.update", "followupFlows.rollback",
  "followups.control", "followups.cancelPromise", "followups.resolvePromise",
  "routers.update", "routers.archive",
  "alerts.resolveBulk", "notices.update",
  "proposals.decide", "proposals.saveSettings",
  "usage.saveBudget", "usage.saveRate", "usage.reprice",
  "commercialProposals.decide", "commercialProposals.saveSettings",
  "eligibility.saveSettings", "eligibility.saveChannel", "eligibility.revokeAuthorization",
  "knowledge.conversationPermission", "knowledge.syncCatalog", "styleAdjustments.save",
], DESTRUCTIVE);

// Irreversible effects crossing the account boundary: sending messages/notices,
// applying approved actions, or executing provider-backed work.
classify([
  "executions.decide",
  "followups.decideEffect", "followups.resolveEffect",
  "followups.enroll", "followups.schedulePromise",
  "cases.reply",
  "notices.test", "notices.retry",
  "agents.publish", "agents.operation", "followupFlows.publish",
  "followupFlows.control", "routers.operation", "routers.activateMember",
  // resume_agent=true hands the conversation back to the AI agent, which then
  // answers the WhatsApp/Instagram contact on its own.
  "cases.update",
], DESTRUCTIVE_EXTERNAL);

/**
 * Writes whose repetition with the same arguments has no additional effect:
 * state-setting PUT/PATCH/DELETE guarded by expected_revision (a repeat gets
 * revision_conflict), plain state setters, and cases.reply (operation_key
 * replays the stored result). Every other write is non-idempotent.
 */
const IDEMPOTENT_WRITES = new Set<string>([
  "agents.saveDraft", "agents.operation", "agents.archive",
  "credentials.update", "credentials.remove",
  "providers.saveBinding", "providers.removeBinding",
  "knowledge.update", "knowledge.remove", "knowledge.conversationPermission",
  "memory.publish", "memory.setEnabled", "memory.updateEntry", "memory.archiveEntry",
  "skills.update", "skills.remove",
  "followupFlows.update", "followupFlows.control",
  "routers.update", "routers.archive", "routers.operation",
  "cases.update", "cases.reply", "alerts.update",
  "notices.update", "proposals.decide", "proposals.saveSettings",
  "usage.saveBudget", "usage.saveRate", "commercialProposals.saveSettings",
  "eligibility.saveSettings", "eligibility.saveChannel", "eligibility.revokeAuthorization",
  "styleAdjustments.save",
]);

/**
 * Returns the reviewed effect classification for a concrete SDK operation name.
 * An unlisted operation throws so new tools cannot silently receive weak hints.
 */
export function getAiToolEffects(name: string): AiToolEffects {
  const value = effects.get(name);
  if (!value) throw new Error(`Operação de IA sem classificação de efeitos: ${name}`);
  return { ...value, idempotentHint: value.readOnlyHint || IDEMPOTENT_WRITES.has(name) };
}

/** Every idempotent write must name a classified, non-read operation. */
for (const name of IDEMPOTENT_WRITES) {
  const value = effects.get(name);
  if (!value || value.readOnlyHint) throw new Error(`Operação idempotente inválida: ${name}`);
}
