/** Public /api/v1/ai contracts. Revisions are opaque strings unless the endpoint explicitly uses a number. */
export type AiProvider =
  "anthropic" | "openai" | "google" | "openrouter" | "deepseek" | "xai";
export type AiPurpose =
  | "default"
  | "agent_turn"
  | "agent_operator"
  | "router"
  | "followup"
  | "proposal"
  | "transcription"
  | "embedding";
export type AiConfigurablePurpose =
  "default" | "followup" | "proposal" | "transcription" | "embedding";
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
  | "handoff"
  | "alerts.create";
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
  memory_enabled?: boolean;
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
