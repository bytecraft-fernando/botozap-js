import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";
import type { Appointment } from "./appointments.js";
export interface CalendarConnection {
  id: string;
  owner_user_id: string;
  label: string;
  status: string;
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
}
export interface CalendarSelection {
  id: string;
  connection_id: string;
  external_calendar_id: string;
  summary: string;
  time_zone: string;
  access_role: string;
  destination: boolean;
  include_busy: boolean;
  conference_supported: boolean;
  synced_at: string | null;
  revision: number;
}
export interface CalendarJob {
  id: string;
  connection_id: string;
  selection_id: string | null;
  appointment_id: string | null;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  available_at: string;
  updated_at: string;
}
/** OAuth authorization is performed by a signed-in person in /calendarios, never impersonated by an account API key. */
export class Calendar {
  constructor(private readonly client: BotoZap) {}
  connections(
    params: OffsetParams = {},
  ): Promise<OffsetList<CalendarConnection>> {
    return this.client.requestOffsetList("GET", "/calendar/connections", {
      query: { ...params },
    });
  }
  disconnect(id: string): Promise<void> {
    return this.client.request(
      "DELETE",
      `/calendar/connections/${encodeURIComponent(id)}`,
    );
  }
  calendars(connectionId: string): Promise<CalendarSelection[]> {
    return this.client.requestItem(
      "GET",
      `/calendar/connections/${encodeURIComponent(connectionId)}/calendars`,
    );
  }
  refresh(connectionId: string): Promise<CalendarSelection[]> {
    return this.client.requestItem(
      "POST",
      `/calendar/connections/${encodeURIComponent(connectionId)}/refresh`,
    );
  }
  select(
    id: string,
    input: {
      destination: boolean;
      include_busy: boolean;
      expected_revision: number;
    },
  ): Promise<{ updated: true }> {
    return this.client.requestItem(
      "PATCH",
      `/calendar/selections/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  jobs(
    params: OffsetParams & { connection_id?: string } = {},
  ): Promise<OffsetList<CalendarJob>> {
    return this.client.requestOffsetList("GET", "/calendar/jobs", {
      query: { ...params },
    });
  }
  retryJob(id: string): Promise<{ queued: true }> {
    return this.client.requestItem(
      "POST",
      `/calendar/jobs/${encodeURIComponent(id)}/retry`,
    );
  }
  resolveConflict(
    appointmentId: string,
    input: { expected_revision: number; choice: "local" | "remote" },
  ): Promise<Appointment> {
    return this.client.requestItem(
      "POST",
      `/calendar/conflicts/${encodeURIComponent(appointmentId)}/resolve`,
      { body: input },
    );
  }
}
