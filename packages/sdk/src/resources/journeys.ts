import type { BotoZap } from "../client.js";
import type { CursorList, CursorParams } from "../types.js";
export interface JourneyStep {
  template_id: string;
  delay_minutes: number;
  variable_map?: Record<string, string>;
}
export interface JourneyConfig {
  customer_id: string;
  name: string;
  status?: "active" | "paused";
  target_kind?: "contact" | "opportunity" | "demand";
  trigger_kind?:
    | "contact_date"
    | "stage_entered"
    | "appointment"
    | "demand_status";
  date_field_key?: string | null;
  stage_id?: string | null;
  demand_status?: "open" | "in_progress" | "waiting_customer" | null;
  offset_days?: number;
  offset_hours?: number;
  yearly?: boolean;
  stop_on_reply?: boolean;
  stop_on_exit?: boolean;
  send_start_hour?: number;
  send_end_hour?: number;
  steps: JourneyStep[];
}
export interface Journey extends Required<Omit<JourneyConfig, "steps">> {
  id: string;
  version: number;
  archived_at: string | null;
  pause_reason: string | null;
  environment: "live" | "sandbox";
  catalog_key?: string | null;
  created_at?: string;
  steps?: JourneyStep[];
}
export interface JourneyRun {
  id: string;
  contact_id: string;
  occurrence_key: string;
  status: string;
  stop_reason: string | null;
  opportunity_id: string | null;
  demand_id: string | null;
  finished_at: string | null;
  created_at: string;
  steps?: Array<{
    id: string;
    position: number;
    due_at: string;
    status: string;
    error: string | null;
    skip_reason: string | null;
    external_id: string | null;
    message_id: string | null;
    delivered_at: string | null;
    read_at: string | null;
    snapshot: unknown;
  }>;
  [key: string]: unknown;
}
export interface JourneyEnrollment {
  contact_id: string;
  occurrence_key: string;
  due_at?: string;
  opportunity_id?: string | null;
  demand_id?: string | null;
  appointment_id?: string | null;
}
export interface JourneyQuery extends Pick<CursorParams, "limit" | "after"> {
  customer_id?: string;
}
export class Journeys {
  constructor(private readonly client: BotoZap) {}
  list(params: JourneyQuery = {}): Promise<CursorList<Journey>> {
    return this.client.requestCursorList("GET", "/journeys", {
      query: { ...params },
    });
  }
  get(id: string, params: { customer_id?: string } = {}): Promise<Journey> {
    return this.client.requestItem(
      "GET",
      `/journeys/${encodeURIComponent(id)}`,
      { query: { ...params } },
    );
  }
  create(input: JourneyConfig): Promise<Journey> {
    return this.client.requestItem("POST", "/journeys", { body: input });
  }
  update(
    id: string,
    input: JourneyConfig & { version: number },
  ): Promise<Journey> {
    return this.client.requestItem(
      "PUT",
      `/journeys/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  /** Archives using CAS; this endpoint returns a record, not HTTP 204. */
  delete(id: string, version: number): Promise<Journey> {
    return this.client.requestItem(
      "DELETE",
      `/journeys/${encodeURIComponent(id)}`,
      { query: { version } },
    );
  }
  control(
    id: string,
    input: { action: "pause" | "resume" | "archive"; version: number },
  ): Promise<Journey> {
    return this.client.requestItem(
      "POST",
      `/journeys/${encodeURIComponent(id)}/control`,
      { body: input },
    );
  }
  runs(id: string, params: JourneyQuery = {}): Promise<CursorList<JourneyRun>> {
    return this.client.requestCursorList(
      "GET",
      `/journeys/${encodeURIComponent(id)}/runs`,
      { query: { ...params } },
    );
  }
  enroll(id: string, input: JourneyEnrollment): Promise<{ id: string }> {
    return this.client.requestItem(
      "POST",
      `/journeys/${encodeURIComponent(id)}/runs`,
      { body: input },
    );
  }
  getRun(id: string): Promise<JourneyRun> {
    return this.client.requestItem(
      "GET",
      `/journey-runs/${encodeURIComponent(id)}`,
    );
  }
  controlRun(
    id: string,
    input: { action: "stop" } | { action: "acknowledge"; note: string },
  ): Promise<JourneyRun> {
    return this.client.requestItem(
      "POST",
      `/journey-runs/${encodeURIComponent(id)}/control`,
      { body: input },
    );
  }
}
