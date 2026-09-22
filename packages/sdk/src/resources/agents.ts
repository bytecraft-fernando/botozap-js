import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";
export interface AgentOfferingInput {
  name: string;
  description?: string;
  pricing_kind: "fixed" | "quote";
  price_cents?: number | null;
  conditions?: string;
  contract_url?: string | null;
}
export interface AgentOffering extends Required<AgentOfferingInput> {
  id: string;
  position: number;
}
export interface AgentConfig {
  name: string;
  pitch?: string;
  offerings: AgentOfferingInput[];
}
export interface Agent {
  id: string;
  account_id: string;
  customer_id: string;
  name: string;
  pitch: string;
  status: string;
  notify_wa_id: string | null;
  timezone: string;
  outside_hours_policy: string;
  weekly_hours: AgentHours["windows"];
  published_version: number;
  published_model_id: string;
  published_rules: string;
  published_fallback_model_ids: string[];
  usage_mode: string;
  created_at: string;
  updated_at: string;
  offerings: AgentOffering[];
}
export type AgentPreviewScenario = "common" | "price" | "handoff";
export interface AgentPreview {
  scenario: AgentPreviewScenario;
  question: string;
  reply: string;
  cost_micros: string;
  remaining_micros: string;
}
export interface AgentRun {
  id: string;
  [key: string]: unknown;
}
export interface AgentGap {
  id: string;
  agent_id: string;
  conversation_id: string;
  kind: string;
  question: string;
  status: string;
  [key: string]: unknown;
}
export interface AgentBehavior {
  model_id: string;
  rules: string;
  fallback_model_ids: string[];
}
export interface AgentBehaviorDraft extends AgentBehavior {
  previewed_at: string | null;
  published_version: number;
  published_model_id: string;
  published_rules: string;
  published_fallback_model_ids: string[];
}
export interface AgentModel {
  model_id: string;
  display_name: string;
  recommended: boolean;
  input_managed_micros: string;
  output_managed_micros: string;
}
export interface AgentHours {
  time_zone: string;
  policy: "hold" | "continue";
  windows: Array<{ days: number[]; start: string; end: string }>;
}
export class Agents {
  constructor(private readonly client: BotoZap) {}
  models(): Promise<AgentModel[]> {
    return this.client.requestItem("GET", "/agents/models");
  }
  behavior(id: string): Promise<AgentBehaviorDraft> {
    return this.client.requestItem(
      "GET",
      `/agents/${encodeURIComponent(id)}/behavior`,
    );
  }
  list(
    params: OffsetParams & { customer_id: string },
  ): Promise<OffsetList<Agent>> {
    return this.client.requestOffsetList("GET", "/agents", {
      query: { ...params },
    });
  }
  get(id: string): Promise<Agent> {
    return this.client.requestItem("GET", `/agents/${encodeURIComponent(id)}`);
  }
  create(input: AgentConfig & { customer_id: string }): Promise<Agent> {
    return this.client.requestItem("POST", "/agents", { body: input });
  }
  update(
    id: string,
    input: AgentConfig & { expected_updated_at: string },
  ): Promise<Agent> {
    return this.client.requestItem("PUT", `/agents/${encodeURIComponent(id)}`, {
      body: input,
    });
  }
  control(
    id: string,
    input: {
      action: "review" | "activate" | "archive" | "restore";
      channel_account_id?: string;
    },
  ): Promise<Agent> {
    return this.client.requestItem(
      "POST",
      `/agents/${encodeURIComponent(id)}/control`,
      { body: input },
    );
  }
  runs(id: string, params: OffsetParams = {}): Promise<OffsetList<AgentRun>> {
    return this.client.requestOffsetList(
      "GET",
      `/agents/${encodeURIComponent(id)}/runs`,
      { query: { ...params } },
    );
  }
  preview(
    id: string,
    input: { scenario: AgentPreviewScenario; request_key: string },
  ): Promise<AgentPreview> {
    return this.client.requestItem(
      "POST",
      `/agents/${encodeURIComponent(id)}/preview`,
      { body: input },
    );
  }
  gaps(id: string, params: OffsetParams = {}): Promise<OffsetList<AgentGap>> {
    return this.client.requestOffsetList(
      "GET",
      `/agents/${encodeURIComponent(id)}/gaps`,
      { query: { ...params } },
    );
  }
  resolveGap(
    id: string,
    gapId: string,
    input: { answer: string },
  ): Promise<{ id: string; status: "resolved" }> {
    return this.client.requestItem(
      "PATCH",
      `/agents/${encodeURIComponent(id)}/gaps/${encodeURIComponent(gapId)}`,
      { body: input },
    );
  }
  controlConversation(
    conversationId: string,
    action: "pause" | "resume",
  ): Promise<{ conversation_id: string; paused: boolean }> {
    return this.client.requestItem(
      "POST",
      `/conversations/${encodeURIComponent(conversationId)}/agent-control`,
      { body: { action } },
    );
  }
  saveBehavior(id: string, input: AgentBehavior): Promise<AgentBehavior> {
    return this.client.requestItem(
      "PUT",
      `/agents/${encodeURIComponent(id)}/behavior`,
      { body: input },
    );
  }
  previewBehavior(
    id: string,
    input: { scenario?: AgentPreviewScenario } = {},
  ): Promise<{ question: string; reply: string; model_id: string }> {
    return this.client.requestItem(
      "POST",
      `/agents/${encodeURIComponent(id)}/behavior/control`,
      { body: { action: "preview", ...input } },
    );
  }
  publishBehavior(id: string): Promise<{ version: number; model_id: string }> {
    return this.client.requestItem(
      "POST",
      `/agents/${encodeURIComponent(id)}/behavior/control`,
      { body: { action: "publish" } },
    );
  }
  saveHours(id: string, input: AgentHours): Promise<AgentHours> {
    return this.client.requestItem(
      "PUT",
      `/agents/${encodeURIComponent(id)}/hours`,
      { body: input },
    );
  }
}
