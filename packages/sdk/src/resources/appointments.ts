import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";
export interface AppointmentFields {
  title?: string;
  scheduled_at: string;
  ends_at?: string;
  time_zone?: string;
  note?: string | null;
  service_id?: string | null;
  owner_user_id?: string | null;
  status?: AppointmentStatus;
  conversation_id?: string | null;
  opportunity_id?: string | null;
  demand_id?: string | null;
  cancellation_reason?: string | null;
  location?: string | null;
  meeting_requested?: boolean;
}
export type CreateAppointment = AppointmentFields & { contact_id: string };
export type UpdateAppointment = Partial<AppointmentFields> & {
  expected_revision?: number;
};
export interface Appointment extends Required<AppointmentFields> {
  id: string;
  account_id: string;
  customer_id: string;
  contact_id: string;
  revision: number;
  meeting_url: string | null;
  google_sync_error: string | null;
  google_conflict: Record<string, unknown> | null;
  google_event_id: string | null;
  google_selection_id: string | null;
  google_etag: string | null;
  google_base_data: Record<string, unknown> | null;
  google_synced_revision: number | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  created_at: string;
  updated_at: string;
}
export interface AppointmentQuery extends OffsetParams {
  customer_id?: string;
  contact_id?: string;
  owner_user_id?: string | "unassigned";
  service_id?: string;
  status?: AppointmentStatus;
  date?: string;
  from?: string;
  to?: string;
}
export interface AppointmentServiceInput {
  customer_id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  slot_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  minimum_notice_minutes: number;
  booking_horizon_days: number;
  active: boolean;
}
export interface AppointmentScheduleInput {
  customer_id: string;
  owner_user_id: string;
  time_zone: string;
  windows: Array<{ dow: number; start: string; end: string }>;
}
export interface AppointmentExceptionInput {
  customer_id: string;
  owner_user_id: string;
  local_date: string;
  start_minute: number;
  end_minute: number;
  kind: "available" | "busy";
  reason?: string | null;
}
export type AgendaRecord<T> = T & {
  id: string;
  account_id: string;
  revision: number;
};
export class AgendaConfiguration<T> {
  constructor(
    protected readonly client: BotoZap,
    private readonly kind: "services" | "schedules" | "exceptions",
  ) {}
  list(params: {
    customer_id: string;
    page?: number;
  }): Promise<OffsetList<AgendaRecord<T>>> {
    return this.client.requestOffsetList("GET", `/appointments/${this.kind}`, {
      query: { ...params },
    });
  }
  create(input: T): Promise<AgendaRecord<T>> {
    return this.client.requestItem("POST", `/appointments/${this.kind}`, {
      body: input,
    });
  }
  /** Changes merge into the stored configuration and require its current revision. */
  update(
    id: string,
    input: Partial<T> & { expected_revision: number },
  ): Promise<AgendaRecord<T>> {
    return this.client.requestItem(
      "PATCH",
      `/appointments/${this.kind}/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
}
export class AgendaExceptions extends AgendaConfiguration<AppointmentExceptionInput> {
  constructor(client: BotoZap) {
    super(client, "exceptions");
  }
  delete(id: string, expectedRevision: number): Promise<void> {
    return this.client.request(
      "DELETE",
      `/appointments/exceptions/${encodeURIComponent(id)}`,
      { body: { expected_revision: expectedRevision } },
    );
  }
}
export interface AvailabilityQuery {
  customer_id: string;
  owner_user_id: string;
  service_id: string;
  from: string;
  to: string;
  exclude_id?: string;
}
export interface AppointmentAvailability {
  time_zone: string;
  slots: Array<{ starts_at: string; ends_at: string }>;
  schedule_published: boolean;
}
export interface AppointmentHistory {
  id: string;
  appointment_id: string;
  event_type: string;
  created_at: string;
  [key: string]: unknown;
}
export class Appointments {
  readonly services: AgendaConfiguration<AppointmentServiceInput>;
  readonly schedules: AgendaConfiguration<AppointmentScheduleInput>;
  readonly exceptions: AgendaExceptions;
  constructor(private readonly client: BotoZap) {
    this.services = new AgendaConfiguration(client, "services");
    this.schedules = new AgendaConfiguration(client, "schedules");
    this.exceptions = new AgendaExceptions(client);
  }
  list(params: AppointmentQuery = {}): Promise<OffsetList<Appointment>> {
    return this.client.requestOffsetList("GET", "/appointments", {
      query: { ...params },
    });
  }
  get(id: string): Promise<Appointment> {
    return this.client.requestItem(
      "GET",
      `/appointments/${encodeURIComponent(id)}`,
    );
  }
  create(
    input: CreateAppointment,
    options: { idempotencyKey?: string } = {},
  ): Promise<Appointment> {
    return this.client.requestItem("POST", "/appointments", {
      body: input,
      ...options,
    });
  }
  update(id: string, input: UpdateAppointment): Promise<Appointment> {
    return this.client.requestItem(
      "PATCH",
      `/appointments/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  delete(id: string): Promise<void> {
    return this.client.request(
      "DELETE",
      `/appointments/${encodeURIComponent(id)}`,
    );
  }
  history(
    id: string,
    params: { page?: number } = {},
  ): Promise<OffsetList<AppointmentHistory>> {
    return this.client.requestOffsetList(
      "GET",
      `/appointments/${encodeURIComponent(id)}/history`,
      { query: { ...params } },
    );
  }
  availability(params: AvailabilityQuery): Promise<AppointmentAvailability> {
    return this.client.requestItem("GET", "/appointments/availability", {
      query: { ...params },
    });
  }
}
