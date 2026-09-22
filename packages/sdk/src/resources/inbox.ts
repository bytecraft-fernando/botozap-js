import type { BotoZap } from "../client.js";
import type { OffsetParams } from "../types.js";
export interface ConversationNote {
  id: string;
  conversation_id: string;
  author_user_id: string | null;
  author_api_key_id: string | null;
  body: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface ConversationReminder {
  id: string;
  conversation_id: string;
  assigned_user_id: string | null;
  body: string;
  due_at: string;
  status: "pending" | "done" | "cancelled";
  completed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface InboxState {
  id: string;
  archived_at: string | null;
  snoozed_until: string | null;
  operator_version: number;
}
export interface InboxTools {
  state: InboxState;
  notes: ConversationNote[];
  reminders: ConversationReminder[];
  page: number;
  per_page: number;
  notes_total: number;
  reminders_total: number;
}
export type InboxMutation =
  | {
      operation: "archive" | "unarchive" | "unsnooze";
      expected_version: number;
    }
  | { operation: "snooze"; expected_version: number; until: string }
  | { operation: "note_create"; body: string }
  | {
      operation: "note_update";
      id: string;
      body: string;
      expected_version: number;
    }
  | { operation: "note_delete"; id: string; expected_version: number }
  | {
      operation: "reminder_create";
      body: string;
      due_at: string;
      assigned_user_id?: string | null;
    }
  | {
      operation: "reminder_update";
      id: string;
      expected_version: number;
      body?: string;
      due_at?: string;
      assigned_user_id?: string | null;
      status?: "pending" | "done" | "cancelled";
    };
export type InboxMutationResult =
  | Omit<InboxState, "id">
  | ConversationNote
  | ConversationReminder;
/** Notes, reminders and operator state. Drafts are deliberately session-only. */
export class Inbox {
  constructor(private readonly client: BotoZap) {}
  get(conversationId: string, params: OffsetParams = {}): Promise<InboxTools> {
    return this.client.requestItem(
      "GET",
      `/conversations/${encodeURIComponent(conversationId)}/tools`,
      { query: { ...params } },
    );
  }
  mutate(
    conversationId: string,
    input: InboxMutation,
  ): Promise<InboxMutationResult> {
    return this.client.requestItem(
      "PATCH",
      `/conversations/${encodeURIComponent(conversationId)}/tools`,
      { body: input },
    );
  }
}
