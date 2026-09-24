/** Public /api/v1/ai contracts. Revisions are opaque strings unless the endpoint explicitly uses a number. */
export type AiProvider =
  "anthropic" | "openai" | "google" | "openrouter" | "deepseek" | "xai";
/** Every BYOK purpose. #498 added granular purposes; without their own binding they inherit the Customer default. */
export const AI_PURPOSES = [
  "default",
  "agent_turn",
  "agent_operator",
  "router",
  "followup",
  "proposal",
  "transcription",
  "embedding",
  "guard",
  "evaluator",
  "classification",
  "compaction",
  "case_chat",
  "learning_judge",
  "learning_distiller",
  "vision",
  "commercial_proposal",
] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];
/** Purposes bound in Providers; agent_turn/agent_operator/router come from the agent version or router. */
export const AI_CONFIGURABLE_PURPOSES = AI_PURPOSES.filter(
  (p): p is Exclude<AiPurpose, "agent_turn" | "agent_operator" | "router"> =>
    p !== "agent_turn" && p !== "agent_operator" && p !== "router",
);
export type AiConfigurablePurpose = Exclude<
  AiPurpose,
  "agent_turn" | "agent_operator" | "router"
>;
export type AiScope = { customer_id: string };
export type AiRevision = AiScope & { expected_revision: string };
export type AiRecord = Record<string, unknown>;
export type AiPage = AiScope & { page?: number; per_page?: number };
export type AiBindingTarget = {
  provider: AiProvider;
  model: string;
  credential_id: string;
};
export type AiBinding = AiBindingTarget & {
  purpose: AiPurpose;
  fallback: AiBindingTarget | null;
};
export type AiCredential = {
  id: string;
  customer_id: string;
  provider: AiProvider;
  label: string;
  last4: string;
  revision: string;
  active: boolean;
  validation_status: "pending" | "valid" | "invalid";
  validated_at: string | null;
  last_error: string | null;
  models: string[];
  usage_count: number;
  usages: { kind: string; id: string; label: string }[];
};
export type AiWindow = { start: string; end: string; weekdays: number[] };
export type AiToolId =
  | "contacts.read"
  | "contacts.update"
  | "conversations.read"
  | "conversations.note"
  | "crm.opportunities.read"
  | "crm.opportunities.write"
  | "crm.demands.read"
  | "crm.demands.write"
  | "crm.stages.read"
  | "crm.stages.write"
  | "agenda.availability"
  | "agenda.propose"
  | "agenda.appointments.read"
  | "agenda.appointments.reschedule"
  | "agenda.appointments.cancel"
  | "knowledge.search"
  | "memory.read"
  | "memory.propose"
  | "skills.read"
  | "followups.enroll"
  | "followups.pause"
  | "followups.cancel"
  | "cases.open"
  | "cases.update"
  | "followups.schedule"
  | "followups.list"
  | "handoff"
  | "alerts.create"
  | "contacts.search"
  | "contacts.get"
  | "contacts.propose_update"
  | "conversations.list"
  | "conversations.get"
  | "conversations.history"
  | "conversations.assign"
  | "team.members.read"
  | "inbox.queue.read"
  | "tags.read"
  | "tags.manage"
  | "saved_replies.read"
  | "saved_replies.render"
  | "automations.read"
  | "automations.runs.read"
  | "radar.read"
  | "radar.propose_reactivation"
  | "catalog.products.search"
  | "privacy.consent.read"
  | "knowledge.sources.read"
  | "proposals.read"
  | "cases.read"
  | "crm.search"
  | "agenda.schedule.read"
  | "agenda.appointments.confirm"
  | "cases.note"
  | "cases.close";
export interface AiAgentConfig {
  system_prompt?: string;
  provider?: AiProvider;
  model?: string;
  credential_id?: string | null;
  channel_account_id?: string | null;
  tool_ids?: AiToolId[];
  operator?: {
    enabled?: boolean;
    provider?: AiProvider | null;
    model?: string | null;
    credential_id?: string | null;
    tool_ids?: AiToolId[];
  };
  trigger?: {
    keywords?: string[];
    match?: "any" | "all";
    ignore_groups?: true;
    ignore_self?: true;
  };
  time_zone?: string;
  business_hours?: AiWindow | null;
  outside_hours?: "respond" | "wait" | "handoff";
  max_steps?: number;
  token_budget?: number;
  estimated_cost_limit_usd?: number | null;
  history_message_window?: number;
  history_token_window?: number;
  handoff_keywords?: string[];
  handoff_enabled?: boolean;
  cases_enabled?: boolean;
  split_messages?: boolean;
  split_max_chars?: number;
  crm_scopes?: ("contacts" | "opportunities" | "demands")[];
  allowed_stage_ids?: string[];
  knowledge_source_ids?: string[];
  skill_ids?: string[];
  /** Opt-in platform skills composed at runtime; Customer copies override them. */
  platform_skills?: "none" | "all";
  memory_enabled?: boolean;
  /** Reading OTHER contacts/conversations is an explicit opt-in (contacts.search, radar.read, crm.search require it to publish). */
  data_access?: { other_contacts?: boolean };
  /** Turn closing (promise declaration/checkpoint) and stage suggestion; each adds a BYOK inference per turn. */
  accountability?: { enabled?: boolean; classification?: boolean };
  media?: {
    images_enabled?: boolean;
    documents_enabled?: boolean;
    video_frames_enabled?: boolean;
  };
  followup?: {
    enabled?: boolean;
    flow_ids?: string[];
    send_window?: AiWindow | null;
  };
  safety?: {
    disclose_ai?: boolean;
    prohibited_claims?: string[];
    escalation_instructions?: string;
    /** Only adds rules above the mandatory platform policy. */
    additional_rules?: string[];
    disclosure_text?: string;
    commercial_limits?: {
      min_price_brl?: number | null;
      max_discount_percent?: number | null;
      max_installments?: number | null;
    };
    guard_sensitivity?: "standard" | "strict";
    semantic_evaluator?: boolean;
  };
  style?: {
    tone?: "professional" | "friendly" | "direct";
    verbosity?: "concise" | "balanced" | "detailed";
    use_emojis?: boolean;
    instructions?: string;
  };
}
export type AiAgentInput = AiScope & {
  name: string;
  description?: string;
  config?: AiAgentConfig;
};
export type AiAgent = {
  id: string;
  customer_id: string;
  name: string;
  description: string;
  operation_mode: "automatic" | "assisted";
  operation_revision: string;
  paused: boolean;
  archived: boolean;
  published_version_id: string | null;
  updated_at: string;
};
export type AiAgentVersion = {
  id: string;
  agent_id: string;
  number: number;
  revision: string;
  status: "draft" | "published";
  config: AiAgentConfig;
  created_at: string;
  published_at: string | null;
  created_by: string | null;
};
export type AiDraftResult = {
  agent_id: string;
  version_id: string;
  revision: string;
};
export type AiUsageTokens = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
};
export type AiExecution = {
  id: string;
  source: "preview" | "live" | "operator" | "assisted";
  provider: string;
  model: string;
  latency_ms: number | null;
  agent_id: string;
  version_id: string;
  mode: "preview" | "automatic" | "assisted";
  status:
    | "running"
    | "waiting"
    | "completed"
    | "awaiting_approval"
    | "failed"
    | "unknown"
    | "superseded"
    | "rejected";
  reply: string | null;
  tool_trace: { call_id: string; name: string; [key: string]: unknown }[];
  usage?: AiUsageTokens | null;
  measurement_status: "measured" | "partial" | "unavailable";
  finish_reason: string | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
  run_id: string | null;
  conversation_id: string | null;
  operator_execution?: AiExecution;
};
export type AiSourceKind =
  "text" | "faq" | "document" | "catalog" | "conversation";
export type AiKnowledgeSource = {
  id: string;
  name: string;
  kind: AiSourceKind;
  active: boolean;
  revision: string;
  status: "queued" | "indexing" | "ready" | "failed";
  last_error: string | null;
  active_version_id: string | null;
  pending_version_id: string | null;
  created_at: string;
  updated_at: string;
};
export type AiKnowledgeChunk = {
  id: string;
  source_id: string;
  version_id: string;
  ordinal: number;
  content: string;
  hash: string;
};
export type AiMemory = {
  enabled: boolean;
  revision: string;
  content: string;
  version_id: string | null;
};
export type AiMemoryEntry = {
  id: string;
  title: string;
  body: string;
  contact_id: string | null;
  source: "manual" | "proposal";
  proposal_id: string | null;
  provenance: AiRecord;
  status: "active" | "pending" | "archived";
  revision: string;
};
export type AiSkillInput = {
  name: string;
  description: string;
  body: string;
  matcher: { any_keywords: string[]; probe_keywords?: string[] };
  active?: boolean;
};
export type AiSkill = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  revision: string;
  version_id: string | null;
};
export type AiRouterConfig = {
  name: string;
  channel_account_id: string;
  classifier: AiBindingTarget;
  sticky?: boolean;
  min_confidence?: number;
  fallback_agent_id?: string | null;
  members: {
    agent_id: string;
    intent_name: string;
    intent_description: string;
    examples?: string[];
    position?: number;
  }[];
};
export type AiRouter = AiRouterConfig & {
  id: string;
  revision: string;
  active: boolean;
  archived: boolean;
  channel_owner: { kind: "agent" | "router"; id: string } | null;
  created_at: string;
  updated_at: string;
};
export type AiFlowGraph = {
  nodes: {
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    config: AiRecord;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    priority: number;
    condition: AiRecord;
    [key: string]: unknown;
  }[];
};
export type AiFlowSettings = {
  trigger: (
    | { kind: "manual" | "webhook" }
    | { kind: "stage_change"; params: { stage_id: string } }
    | {
        kind: "silence";
        params: { threshold_minutes: number; segments?: string[] };
      }
    | { kind: "case_opened"; params?: Record<string, never> }
    | { kind: "appointment_no_show"; params?: { event_type_ids?: string[] } }
  ) & { cancel_on_reply?: boolean };
  handoff_policy: "pause" | "cancel" | "allow";
  send_start_hour: number;
  send_end_hour: number;
  send_days: number[];
  timezone: string;
  purpose: "utility" | "marketing";
  environment: "live" | "sandbox";
  /** Agent responsible for automatic triggers when several enable the flow; omitted = the only eligible one. */
  trigger_agent_id?: string | null;
};
export type AiFlowInput = AiScope & {
  name: string;
  graph: AiFlowGraph;
  settings: AiFlowSettings;
};
export type AiFlow = AiRecord & {
  id: string;
  name: string;
  revision: string;
  status: "active" | "paused" | "archived";
  graph: AiFlowGraph;
  settings: AiFlowSettings;
};
export type AiEnrollment = AiRecord & {
  id: string;
  revision: string;
  status: string;
  flow_id: string;
  contact_id: string;
  conversation_id: string;
};
export type AiCase = {
  id: string;
  agent_id: string | null;
  conversation_id: string;
  contact_id: string;
  title: string;
  summary: string;
  status: "open" | "waiting" | "resolved" | "closed";
  assigned_user_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  opened_operator_version: number | null;
  last_human_action: "resolved" | "need_lead_info" | "escalate" | null;
  last_human_body: string | null;
  last_human_at: string | null;
  last_human_revision: number | null;
  reply_operator_version: number | null;
  /** #498: subject, explicit blocker, origin and closing outcome (older rows: outro/null/agent). */
  kind?: AiCaseKind;
  blocker?: string | null;
  source?: AiCaseSource;
  outcome?: "resolved" | "no_action_needed" | "escalated" | "cancelled" | null;
  last_action_at?: string;
  stale_reminders?: number;
  contact_name?: string | null;
};
export type AiCaseKind =
  "agendamento" | "duvida" | "problema" | "financeiro" | "acesso" | "outro";
export type AiCaseSource = "agent" | "guardrail" | "human" | "operator";
export type AiCaseEvent = {
  id: string;
  case_id: string;
  kind: string;
  actor_kind: "agent" | "human" | "api_key" | "system" | "contact";
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  actor_agent_id: string | null;
  body: string | null;
  details: AiRecord;
  created_at: string;
  /** Lay label computed by the server next to the raw kind. */
  label: string;
};
export type AiAlert = {
  id: string;
  agent_id: string | null;
  conversation_id: string | null;
  case_id: string | null;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  revision: number;
  created_at: string;
  resolved_at: string | null;
  kind?: string;
  reminder_count?: number;
  last_reminded_at?: string | null;
  case_status?: AiCase["status"] | null;
};
/** Alert list rows: cause label, guidance and destinations projected by the server from stored IDs. */
export type AiAlertListItem = AiAlert & {
  kind: string;
  kind_label: string;
  guidance: string;
  links: { href: string; label: string }[];
};
export type AiAlertBulkFilters = {
  kind?: string;
  severity?: AiAlert["severity"];
  status?: "open" | "acknowledged";
};
export type AiNoticeField =
  "case_title" | "case_summary" | "case_url" | "contact_name" | "agent_name";
export type AiNoticeSettings = {
  enabled: boolean;
  contact_id: string | null;
  template_id: string | null;
  variable_map: Record<string, AiNoticeField>;
  revision: number;
  consent_confirmed_at: string | null;
  updated_at: string | null;
};
export type AiNoticeJob = {
  id: string;
  case_id: string | null;
  kind: "case" | "test";
  status: "pending" | "claimed" | "sent" | "failed" | "unknown" | "cancelled";
  last_error: string | null;
  created_at: string;
  finished_at: string | null;
  external_id: string | null;
  destination_masked?: string | null;
  case_title?: string | null;
  case_status?: string | null;
};
export type AiProposal = {
  id: string;
  agent_id: string;
  execution_id: string;
  base_version_id: string;
  type: "playbook_bullet" | "memory_entry";
  content: string;
  reason: string;
  evidence: string[];
  status: "pending" | "applied" | "rejected";
  revision: number;
  created_at: string;
  decided_at: string | null;
  decision_reason: string | null;
  applied_version_id: string | null;
  memory_entry_id: string | null;
};
/** Customer-supplied transcription rates. Reservations are estimates, not provider token caps. */
export type AiAudioPricing =
  | {
      unit: "tokens";
      input_audio_usd_per_million: number;
      input_text_usd_per_million: number;
      output_text_usd_per_million: number;
      max_input_tokens: number;
      max_output_tokens: number;
    }
  | { unit: "duration"; usd_per_minute: number };
export type AiRateInput = AiScope & {
  provider: AiProvider;
  model: string;
  input_usd_per_million: number;
  output_usd_per_million: number;
  cache_read_usd_per_million: number;
  cache_write_usd_per_million: number;
  /** Omit to preserve the existing audio price; null explicitly removes it. */
  audio_pricing?: AiAudioPricing | null;
  expected_revision: number;
};
export type AiBudgetInput = AiScope & {
  monthly_limit_usd: number | null;
  mode: "off" | "warn" | "block";
  alarm_threshold_pct: number;
  expected_revision: number;
};

export type AiFlowVersion = {
  id: string;
  flow_id: string;
  version: number;
  graph: AiFlowGraph;
  settings: AiFlowSettings;
  created_at: string;
};
export type AiFollowupEffect = {
  id: string;
  node_id: string;
  purpose: "send_message" | "classify" | "plan_timing";
  status: string;
  reply: string | null;
  template_id: string | null;
  template_snapshot: {
    name: string;
    language: string;
    components: unknown;
  } | null;
  classification: string | null;
  timing_plan: AiRecord | null;
  provider: string | null;
  model: string | null;
  measurement_status: string;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
  dispatch_id: string | null;
  approved_by: string | null;
  approved_by_api_key: string | null;
};
export type AiFollowupEvent = {
  id: string;
  node_id: string | null;
  type: string;
  payload: AiRecord;
  created_at: string;
};
export type AiSkillVersion = {
  id: string;
  skill_id: string;
  revision: string;
  body: string;
  matcher: AiSkillInput["matcher"];
  manifest: {
    path: string;
    size: number;
    sha256: string;
    kind: "reference" | "asset";
  }[];
  created_at: string;
};
export type AiRouterTest = {
  id: string;
  router_id: string;
  revision: string;
  status: "completed" | "failed" | "unknown" | "superseded";
  agent_id: string | null;
  intent_name: string | null;
  confidence: number | null;
  outcome:
    | "classified"
    | "sticky"
    | "reclassified"
    | "fallback"
    | "session"
    | "no_match"
    | "classifier_failed";
  error_code: string | null;
  usage?: AiUsageTokens;
  measurement_status: "measured" | "partial" | "unavailable";
  created_at: string;
};
export type AiProviderModel = {
  id: string;
  provider: AiProvider;
  capabilities: ("text" | "embedding" | "transcription")[];
};
export type AiUsageSummary = {
  from: string;
  to: string;
  totals: {
    calls: number;
    input_audio_tokens: number | null;
    input_text_tokens: number | null;
    audio_seconds: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    estimated_cost_usd: number | null;
    reserved_usd: number | null;
    unmeasured_calls: number;
    failed_calls: number;
    p50_latency_ms: number | null;
    p95_latency_ms: number | null;
  };
  series: {
    usage_day: string;
    calls: number;
    input_audio_tokens: number | null;
    input_text_tokens: number | null;
    audio_seconds: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    estimated_cost_usd: number | null;
    unmeasured_calls: number;
  }[];
  models: {
    provider: string;
    model: string;
    calls: number;
    input_audio_tokens: number | null;
    input_text_tokens: number | null;
    audio_seconds: number | null;
    estimated_cost_usd: number | null;
    unmeasured_calls: number;
  }[];
  purposes: {
    purpose: string;
    calls: number;
    input_audio_tokens: number | null;
    input_text_tokens: number | null;
    audio_seconds: number | null;
    estimated_cost_usd: number | null;
  }[];
  /** #498: per-agent breakdown and handoff rate (agent_id filter applies; purpose does not). */
  agents?: {
    agent_id: string | null;
    calls: number;
    estimated_cost_usd: number | null;
    unmeasured_calls: number;
  }[];
  handoff?: {
    conversations: number;
    handoffs: number;
    rate: number | null;
    purpose_filter_applied: false;
    agent_filter_applied: boolean;
  };
};
export type AiBudget = Omit<
  AiBudgetInput,
  "customer_id" | "expected_revision"
> & { revision: number; updated_at: string | null };
export type AiRate = Omit<
  AiRateInput,
  "customer_id" | "expected_revision" | "audio_pricing"
> & {
  audio_pricing: AiAudioPricing | null;
  revision: number;
  updated_at: string;
};

export type AiCaseReplyInput = AiScope & {
  id: string;
  expected_revision: number;
  operation_key: string;
  action: "resolved" | "need_lead_info" | "escalate";
  body: string;
};
export type AiCaseReply = {
  case_id: string;
  revision: number;
  status: AiCase["status"];
  queued: boolean;
  queue_reason: string | null;
  run_id: string | null;
  service_stale: boolean;
};
export type AiCaseChat = {
  id: string;
  operation_key: string;
  question: string;
  reply: string | null;
  status: "running" | "completed" | "failed" | "unknown";
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  persona: {
    source: "case_agent" | "customer_default";
    name: string | null;
    reason: "no_agent" | "paused" | "archived" | "unpublished" | null;
    agent_id: string | null;
    version_id: string | null;
    binding?: "purpose" | "customer_default" | null;
  } | null;
  usage: {
    input_tokens: number | null;
    output_tokens: number | null;
    cache_read_tokens: number | null;
    cache_write_tokens: number | null;
    reasoning_tokens: number | null;
  } | null;
  measurement_status: "measured" | "partial" | "unavailable" | null;
  provider: string | null;
  model: string | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
};
export type AiCatalogProduct = {
  id: string;
  name: string | { pt: string };
  description?: string;
  price?: string;
  sku?: string;
  permalink?: string;
  variants?: { price?: string; sku?: string }[];
  categories?: { name: string | { pt: string } }[];
};
export type AiKnowledgeImport = AiScope & {
  name: string;
  source_id?: string;
  expected_revision?: string;
} & (
    | { kind: "services" }
    | { kind: "products"; products: AiCatalogProduct[] }
    | {
        kind: "conversation";
        conversation_id: string;
        permission_revision: string;
        preview_hash: string;
        reviewed: true;
      }
  );
export type AiKnowledgeConversation = {
  id: string;
  contact_name: string;
  closed_at: string;
  allowed: boolean;
  revision: string;
  source_id: string | null;
};
export type AiKnowledgePreview = {
  conversation_id: string;
  permission_revision: string;
  preview_hash: string;
  source_fingerprint: string;
  text: string;
  message_count: number;
  redactions: Record<string, number>;
  review_required: boolean;
};
export type AiPlatformSkill = {
  slug: string;
  version_id: string;
  version: number;
  name: string;
  description: string;
  body: string;
  matcher: AiSkillInput["matcher"];
  manifest: {
    path: string;
    size: number;
    sha256: string;
    kind: "reference" | "asset";
  }[];
  source: string;
  installed_skill_id: string | null;
  installed_version_id: string | null;
};

export type AiArtifactUploadInput = AiScope & {
  kind: "knowledge" | "skill";
  file_name: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  name?: string;
  skill_id?: string;
  expected_revision?: string;
};
export interface AiPreparedUpload {
  upload_id: string;
  upload_url: string;
  headers: { "Content-Type": string };
  expires_at: string;
}
export interface AiConversationCheckpoint {
  id: string;
  agent_id: string;
  conversation_id: string;
  execution_id: string;
  status:
    | "ready"
    | "flush_started"
    | "flushed"
    | "summary_started"
    | "completed"
    | "failed"
    | "unknown";
  input_hash: string;
  summary: null | {
    rolling_summary: string;
    commitments: string[];
    objections: string[];
    personal_data: string[];
    stage: string | null;
    evidence: string[];
  };
  through_message_id: string;
  through_at: string;
  closed_at: string | null;
  message_count: number;
  flushed_entry_ids: string[];
  error_code: string | null;
  created_at: string;
}

export type AiUploadReceiptCallback = (receipt: {
  upload_id: string;
}) => void | Promise<void>;

/* ───────────── #498 agent parity: contracts mirror the /api/v1/ai routes. ───────────── */

export type AiCommercialEffect =
  | { kind: "none" }
  | { kind: "schedule_follow_up"; at: string }
  | { kind: "move_stage"; stage_id: string }
  | { kind: "create_task"; title: string; due_at: string | null };
export type AiCommercialProposal = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  opportunity_status: string;
  stage_id: string | null;
  stage_label: string | null;
  contact_id: string;
  contact_name: string | null;
  /** Optimistic lock echoed in `commercialProposals.decide`. */
  seq: number;
  status: "pending" | "approved" | "dismissed" | "superseded";
  next_action: string;
  rationale: string;
  evidence: string[];
  effect: AiCommercialEffect;
  effect_stage_label: string | null;
  provider: string;
  model: string;
  binding_source: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_label: string | null;
  decided_by_api_key: string | null;
  decision_note: string | null;
  effect_applied: boolean | null;
  effect_result: AiRecord | null;
};
export type AiCommercialJob = {
  id: string;
  opportunity_id: string;
  opportunity_title: string | null;
  reason: "manual" | "automatic";
  status: string;
  last_error: string | null;
  proposal_id: string | null;
  created_at: string;
  finished_at: string | null;
};
export type AiCommercialRequest = {
  job_id: string;
  status: string;
  queued: boolean;
  replayed: boolean;
};
export type AiCommercialDecision = {
  id: string;
  status: "approved" | "dismissed";
  seq: number;
  effect_applied: boolean | null;
  effect_result: AiRecord | null;
  replayed: boolean;
};
export type AiCommercialSettings = {
  enabled: boolean;
  revision: number;
  updated_at: string | null;
};

export type AiGateMode = "open" | "allowlist" | "pre_go_live";
export type AiChannelGate = {
  channel_account_id: string;
  channel_name: string;
  channel: string;
  mode: AiGateMode;
  /** "default" = not configured: closed channel (test numbers only, empty list). */
  origin: "default" | "legacy" | "user" | "api";
  test_phone_numbers: string[];
  revision: string;
  opened_at: string | null;
  updated_at: string | null;
  ai_owner: {
    kind: "agent" | "router";
    id: string;
    name: string;
    automatic: boolean;
  } | null;
};
export type AiEligibilitySettings = {
  authorization_ttl_days: number;
  authorize_broadcast_replies: boolean;
  authorize_automation_replies: boolean;
  assignment_blocks_ai: boolean;
  revision: string;
};
export type AiEligibilityOverview = {
  settings: AiEligibilitySettings;
  channels: AiChannelGate[];
};
export type AiContactAuthorization = {
  id: string;
  channel_account_id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  kind: "broadcast_reply" | "journey_reply" | "followup_reply" | "manual_resume";
  reason: string;
  source_id: string | null;
  authorized_at: string;
  expires_at: string;
  status: "active" | "expired" | "revoked";
  revoked_at: string | null;
  revoked_reason: string | null;
};

export type AiInferenceOutcome = "ok" | "failed" | "unknown" | "in_progress";
export type AiInferenceOrigin =
  | "purpose"
  | "inherited_proposal"
  | "customer_default"
  | "fallback"
  | "agent_version"
  | "router_config"
  | "unrecorded";
type AiInferenceExplanation = {
  point_label: string;
  origin_explanation: string;
  /** Present when the row has an error code. */
  cause?: string;
  consequence?: string;
  suggested_action?: string;
};
export type AiInference = AiInferenceExplanation & {
  id: string;
  created_at: string;
  completed_at: string | null;
  purpose: string;
  point: string;
  provider: string;
  model: string;
  status: "started" | "completed" | "failed" | "unknown";
  outcome: AiInferenceOutcome;
  measurement_status: string;
  error_code: string | null;
  http_status: number | null;
  origin: AiInferenceOrigin;
  agent_id: string | null;
  execution_id: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  reserved_usd: number | null;
};
export type AiInferenceSummary = {
  failures: (AiInferenceExplanation & {
    code: string;
    point: string;
    origin: AiInferenceOrigin;
    calls: number;
    last_at: string;
  })[];
  points: {
    point: string;
    point_label: string;
    calls: number;
    failed: number;
    unknown: number;
    in_progress: number;
    fallback_calls: number;
    estimated_cost_usd: number | null;
    unmeasured_calls: number;
  }[];
};

export type AiKnowledgeHit = AiKnowledgeChunk & {
  source_name: string;
  similarity: number;
};
export type AiKnowledgeSearchDiagnostics = {
  hits: AiKnowledgeHit[];
  diagnostics: {
    reason: "ok" | "below_threshold" | "not_indexed" | "inactive" | "no_candidates";
    explanation: string;
    threshold: number;
    best: {
      chunk_id: string;
      source_id: string;
      source_name: string;
      similarity: number;
    } | null;
    sources: {
      id: string;
      name: string;
      active: boolean;
      status: AiKnowledgeSource["status"];
      has_active_version: boolean;
      pending: boolean;
      chunk_count: number | null;
      last_error: string | null;
    }[];
  };
};
export type AiCatalogItems = {
  items: {
    id: string;
    hash: string;
    updated_at: string;
    source_updated_at: string | null;
  }[];
  last_events: {
    event_key: string;
    integration: string;
    created_at: string;
    result: unknown;
  }[];
};
export type AiCatalogSyncInput = AiScope & {
  /** Product source (import kind products). */
  id: string;
  /** Producer event id: retry the same body with the same key. */
  event_key: string;
  integration?: string;
  upserts?: (AiCatalogProduct & { updated_at?: string })[];
  removals?: { id: string; updated_at?: string }[];
};
export type AiCatalogSyncResult = {
  source_id: string;
  revision: string;
  active: boolean;
  status: string;
  changed: number;
  removed: number;
  unchanged: number;
  stale: number;
  missing: number;
  items: number;
  reindex_queued: boolean;
  emptied: boolean;
  reactivated: boolean;
  replayed: boolean;
};
export type AiKnowledgeCitation = {
  chunk_id: string;
  source_id: string;
  source_name: string;
  version_id?: string | null;
  ordinal?: number | null;
  snippet: string;
  score: number;
  query?: string | null;
};
export type AiExecutionCitations = {
  execution_id: string;
  agent_id: string;
  conversation_id: string | null;
  citations: AiKnowledgeCitation[];
  updated_at: string;
};
export type AiAgentCoverage = {
  sources: {
    id: string;
    name: string | null;
    status: AiKnowledgeSource["status"] | null;
    active: boolean;
    ready: boolean;
    issue: "missing" | "inactive" | "not_indexed" | "failed" | "reindexing" | null;
  }[];
  skills: {
    id: string;
    name: string | null;
    ready: boolean;
    issue: "missing" | "inactive" | null;
  }[];
  embedding_ready: boolean;
  funnel: {
    stages: { id: string; label: string; position: number; allowed: boolean }[];
    allowed_count: number;
    total_count: number;
    can_move: boolean;
    mute: boolean;
    unknown_allowed_ids: string[];
  };
  issues: string[];
};

export type AiMemoryEntryEvent = {
  id: string;
  action: "archived" | "reactivated" | "approved" | "status_changed";
  from_status: string;
  to_status: string;
  entry_revision: string;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  created_at: string;
};

export type AiNoticeCheck = {
  id: string;
  status: "ok" | "warning" | "error";
  message: string;
};
export type AiNoticeEffect = {
  days: number;
  sampled: number;
  total: number;
  with_notice: { cases: number; answered: number; median_minutes: number | null };
  without_notice: { cases: number; answered: number; median_minutes: number | null };
  median_to_notice_minutes: number | null;
};

export type AiOperatorMetrics = {
  days: number;
  agents: {
    agent_id: string;
    turns: number;
    turns_absent: number;
    turns_with_promises: number;
    turns_not_delivered: number;
    promises: number;
    owned: number;
    owned_by_agent: number;
    owned_by_operator: number;
    owned_by_human: number;
    unowned: number;
    dismissed: number;
    pending: number;
    corrections: number;
    corrections_by_operator: number;
    corrections_by_human: number;
    unowned_reasons: Record<string, number>;
    ownership_rate: number | null;
  }[];
};
export type AiTurnPromise = {
  id: string;
  declaration_id: string;
  agent_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  description: string;
  due_at: string | null;
  due_text: string | null;
  status: "pending" | "owned" | "unowned" | "dismissed";
  owner_kind: string | null;
  owner_source: string | null;
  unowned_reason: string | null;
  corrected_by_kind: string | null;
  correction_note: string | null;
  revision: number;
  created_at: string;
};

export type AiCatalogModel = {
  model: string;
  label: string | null;
  context_tokens: number | null;
  max_output_tokens: number | null;
  /** null = the provider catalog does not report it. */
  tools: boolean | null;
  vision: boolean | null;
  /** Suggestion only; never applied to tariffs automatically. */
  pricing: {
    input_usd_per_million: number;
    output_usd_per_million: number;
    cache_read_usd_per_million: number | null;
    cache_write_usd_per_million: number | null;
    notes: ("request_fee" | "long_context" | "image_input" | "variable")[];
  } | null;
};
export type AiModelCatalogSnapshot = {
  id: string;
  credential_id: string;
  provider: string;
  version: number;
  credential_revision: string;
  model_count: number;
  fetched_at: string;
  models: AiCatalogModel[];
};
export type AiModelCatalogSync = Omit<
  AiModelCatalogSnapshot,
  "credential_revision" | "models"
>;

export type AiSkillNearMiss = {
  id: string;
  skill_id: string;
  skill_name: string;
  skill_revision: string | null;
  probe: string;
  excerpt: string;
  occurrences: number;
  status: "pending" | "accepted" | "ignored";
  revision: string;
  agent_id: string | null;
  conversation_id: string | null;
  accepted_phrase: string | null;
  first_seen_at: string;
  last_seen_at: string;
  decided_at: string | null;
};
export type AiPlatformSkillComposition = {
  slug: string;
  name: string;
  description: string;
  version: number;
  state: "available" | "overridden_by_copy" | "overridden_by_name";
  customer_skill_id: string | null;
  customer_skill_active: boolean | null;
};

export type AiFollowupPromiseStatus =
  | "scheduled"
  | "turn_enqueued"
  | "template_pending"
  | "template_dispatching"
  | "alerted"
  | "completed"
  | "skipped"
  | "failed"
  | "unknown"
  | "cancelled";
/** Promised return: at due_at the responsible agent reopens the conversation. */
export type AiFollowupPromise = {
  id: string;
  contact_id: string;
  conversation_id: string;
  agent_id: string;
  source: "agent" | "human" | "api";
  reason: string;
  promise: string;
  context_snapshot: string | null;
  promised_at: string;
  /** promised_at adjusted to the agent's published service window. */
  due_at: string;
  time_zone: string;
  outside_window: "alert" | "template";
  template_id: string | null;
  status: AiFollowupPromiseStatus;
  revision: string;
  fired_at: string | null;
  fired_run_id: string | null;
  alert_id: string | null;
  outcome_reason: string | null;
  last_error: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancelled_by_kind: "user" | "api_key" | "agent" | null;
  created_by_kind: "user" | "api_key" | "agent";
  origin_run_id: string | null;
  external_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type AiFollowupPromiseDetail = AiFollowupPromise & {
  contact: { id: string; name: string | null; phone: string | null };
  agent: { id: string; name: string } | null;
  run: {
    id: string;
    status: string;
    skip_reason: string | null;
    execution_id: string | null;
    execution_status: string | null;
  } | null;
  alert: { id: string; status: string } | null;
};
export type AiFollowupQueueRow = {
  kind: "enrollment" | "promise";
  id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  conversation_id: string;
  flow_id: string | null;
  flow_name: string | null;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  node_id: string | null;
  next_fire_at: string | null;
  reason: string | null;
  updated_at: string;
  created_at: string;
  last_error: string | null;
};
/** Cursor page: pass next_cursor back as cursor; null means the end. */
export type AiFollowupQueuePage = {
  data: AiFollowupQueueRow[];
  next_cursor: string | null;
};
export type AiFollowupQueueFilters = {
  status?: string;
  q?: string;
  contact_id?: string;
  cursor?: string;
  limit?: number;
};
