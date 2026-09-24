import type { BotoZap } from "../client.js";
import type { OffsetList, OffsetParams } from "../types.js";
/** Only shared replies are exposed to account API keys. Personal replies stay in the authenticated dashboard. */
export interface SavedReply {
  id: string;
  customer_id: string | null;
  owner_user_id: null;
  title: string;
  body: string;
  shortcut: string | null;
  created_at: string;
  updated_at: string;
}
export interface SavedReplyInput {
  title: string;
  body: string;
  shortcut?: string | null;
  customer_id?: string | null;
}
export interface SavedReplyQuery extends OffsetParams {
  query?: string;
  customer_id?: string | "account";
  include_account?: boolean;
}
export class SavedReplies {
  constructor(private readonly client: BotoZap) {}
  list(params: SavedReplyQuery = {}): Promise<OffsetList<SavedReply>> {
    return this.client.requestOffsetList("GET", "/saved-replies", {
      query: {
        ...params,
        include_account:
          params.include_account === undefined
            ? undefined
            : String(params.include_account),
      },
    });
  }
  get(id: string): Promise<SavedReply> {
    return this.client.requestItem(
      "GET",
      `/saved-replies/${encodeURIComponent(id)}`,
    );
  }
  create(input: SavedReplyInput): Promise<SavedReply> {
    return this.client.requestItem("POST", "/saved-replies", { body: input });
  }
  update(
    id: string,
    input: Partial<SavedReplyInput> & { expected_updated_at: string },
  ): Promise<SavedReply> {
    return this.client.requestItem(
      "PATCH",
      `/saved-replies/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  delete(id: string, input: { expected_updated_at: string }): Promise<void> {
    return this.client.request(
      "DELETE",
      `/saved-replies/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
}
