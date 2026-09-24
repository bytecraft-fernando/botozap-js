import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";
export type CrmMetadata = Record<string, string | number | boolean | null>;
export interface CrmFields {
  title: string;
  owner_user_id?: string | null;
  next_step?: string | null;
  next_step_at?: string | null;
  notes?: string | null;
  metadata?: CrmMetadata;
}
export interface OpportunityFields extends CrmFields {
  stage_id?: string | null;
  status?: "open" | "won" | "lost";
  value_cents?: number;
  currency?: string;
  outcome_reason?: string | null;
}
export interface DemandFields extends CrmFields {
  opportunity_id?: string | null;
  status?: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  due_at?: string | null;
  outcome?:
    | "resolved"
    | "converted"
    | "not_applicable"
    | "customer_cancelled"
    | "lost"
    | "no_response"
    | null;
}
export type CreateOpportunity = OpportunityFields & {
  customer_id: string;
  contact_id: string;
};
export type CreateDemand = DemandFields & {
  customer_id: string;
  contact_id: string;
};
export type CrmRecord<F> = Required<F> & {
  id: string;
  account_id: string;
  customer_id: string;
  contact_id: string;
  version: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};
export type Opportunity = CrmRecord<OpportunityFields> & {
  stage_entered_at: string;
};
export type Demand = CrmRecord<DemandFields>;
export interface CrmQuery extends OffsetParams {
  customer_id: string;
  contact_id?: string;
  owner_user_id?: string | "unassigned";
  stage_id?: string | "none";
  status?: string;
  q?: string;
}
export interface CrmActivity {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  created_at: string;
}
export interface CrmConversation {
  conversation_id: string;
  [key: string]: unknown;
}
export class CrmResource<F extends CrmFields, R> {
  constructor(
    private readonly client: BotoZap,
    private readonly path: "/opportunities" | "/demands",
  ) {}
  list(params: CrmQuery): Promise<OffsetList<R>> {
    return this.client.requestOffsetList("GET", this.path, {
      query: { ...params },
    });
  }
  get(id: string): Promise<R> {
    return this.client.requestItem(
      "GET",
      `${this.path}/${encodeURIComponent(id)}`,
    );
  }
  create(input: F & { customer_id: string; contact_id: string }): Promise<R> {
    return this.client.requestItem("POST", this.path, { body: input });
  }
  update(
    id: string,
    input: Partial<F> & { expected_version: number },
  ): Promise<R> {
    return this.client.requestItem(
      "PATCH",
      `${this.path}/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  activities(
    id: string,
    params: Pick<OffsetParams, "page"> = {},
  ): Promise<OffsetList<CrmActivity>> {
    return this.client.requestOffsetList(
      "GET",
      `${this.path}/${encodeURIComponent(id)}/activities`,
      { query: { ...params } },
    );
  }
  conversations(
    id: string,
    params: Pick<OffsetParams, "page"> = {},
  ): Promise<OffsetList<CrmConversation>> {
    return this.client.requestOffsetList(
      "GET",
      `${this.path}/${encodeURIComponent(id)}/conversations`,
      { query: { ...params } },
    );
  }
  linkConversation(
    id: string,
    conversationId: string,
  ): Promise<{ conversation_id: string; linked: boolean }> {
    return this.client.requestItem(
      "POST",
      `${this.path}/${encodeURIComponent(id)}/conversations`,
      { body: { conversation_id: conversationId } },
    );
  }
  unlinkConversation(
    id: string,
    conversationId: string,
  ): Promise<{ conversation_id: string; linked: boolean }> {
    return this.client.requestItem(
      "DELETE",
      `${this.path}/${encodeURIComponent(id)}/conversations`,
      { body: { conversation_id: conversationId } },
    );
  }
}
export interface RadarEntry {
  id: string;
  entity_type: "opportunity" | "demand" | "return" | "appointment";
  title: string;
  customer_id: string;
  contact_id: string;
  conversation_id: string | null;
  owner_user_id: string | null;
  stage_id: string | null;
  next_step: string | null;
  next_step_at: string | null;
  last_activity_at: string | null;
  bucket: "critical" | "at_risk" | "scheduled";
  reasons: string[];
  automation_due_at: string | null;
  automation_error: string | null;
  automation_run_id: string | null;
  automation_status: string | null;
}
export interface StageRuleInput {
  customer_id: string;
  expected_version: number;
  cold_hours: number;
  critical_hours: number;
  require_owner: boolean;
  require_next_step: boolean;
}
export interface StageRule extends Omit<StageRuleInput, "expected_version"> {
  /** Presente em `stageRules` (GET); a resposta de `configureStageRule` não o inclui. */
  account_id?: string;
  stage_id: string;
  version: number;
  updated_at: string;
}
export interface RadarQuery extends OffsetParams {
  customer_id: string;
  bucket?: RadarEntry["bucket"];
  entity_type?: RadarEntry["entity_type"];
  owner_user_id?: string | "unassigned";
  reason?:
    | "unassigned"
    | "missing_next_step"
    | "overdue"
    | "stalled_stage"
    | "inactive"
    | "automation_failed"
    | "automation_overdue"
    | "automation_paused"
    | "automation_stopped"
    | "confirmation_pending"
    | "appointment_outcome_missing"
    | "calendar_conflict"
    | "calendar_sync_failed";
}
export type RadarPage = OffsetList<RadarEntry> & {
  meta: { counts: Record<RadarEntry["bucket"], number> };
};
export class Radar {
  constructor(private readonly client: BotoZap) {}
  list(params: RadarQuery): Promise<RadarPage> {
    return this.client.requestOffsetList("GET", "/radar", {
      query: { ...params },
    });
  }
  stageRules(customerId: string): Promise<StageRule[]> {
    return this.client.requestItem("GET", "/radar/stage-rules", {
      query: { customer_id: customerId },
    });
  }
  configureStageRule(
    stageId: string,
    input: StageRuleInput,
  ): Promise<StageRule> {
    return this.client.requestItem(
      "PUT",
      `/radar/stage-rules/${encodeURIComponent(stageId)}`,
      { body: input },
    );
  }
}
