import type { BotoZap } from "../client.js";
export type StageColor = "zinc" | "green" | "amber" | "pink";
export interface ContactStage {
  id: string;
  key: string;
  label: string;
  color: StageColor;
  position: number;
}
export interface ContactField {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "date";
  position: number;
  created_at: string;
}
export class ContactStages {
  constructor(private readonly client: BotoZap) {}
  list(params: { customer_id?: string } = {}): Promise<ContactStage[]> {
    return this.client.requestItem("GET", "/contact-stages", {
      query: { ...params },
    });
  }
  create(input: {
    customer_id?: string;
    label: string;
    color: StageColor;
  }): Promise<ContactStage> {
    return this.client.requestItem("POST", "/contact-stages", { body: input });
  }
  update(
    id: string,
    input: {
      customer_id?: string;
      label?: string;
      color?: StageColor;
      position?: number;
    },
  ): Promise<ContactStage> {
    return this.client.requestItem(
      "PATCH",
      `/contact-stages/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  delete(id: string, params: { customer_id?: string } = {}): Promise<void> {
    return this.client.request(
      "DELETE",
      `/contact-stages/${encodeURIComponent(id)}`,
      { query: { ...params } },
    );
  }
  reorder(input: {
    customer_id?: string;
    stage_ids: string[];
  }): Promise<ContactStage[]> {
    return this.client.requestItem("PATCH", "/contact-stages/reorder", {
      body: input,
    });
  }
}
export class ContactFields {
  constructor(private readonly client: BotoZap) {}
  list(): Promise<ContactField[]> {
    return this.client.requestItem("GET", "/contact-fields");
  }
  create(input: {
    label: string;
    type?: ContactField["type"];
    key?: string;
  }): Promise<ContactField> {
    return this.client.requestItem("POST", "/contact-fields", { body: input });
  }
  update(
    id: string,
    input: { label?: string; position?: number },
  ): Promise<ContactField> {
    return this.client.requestItem(
      "PATCH",
      `/contact-fields/${encodeURIComponent(id)}`,
      { body: input },
    );
  }
  delete(id: string): Promise<void> {
    return this.client.request(
      "DELETE",
      `/contact-fields/${encodeURIComponent(id)}`,
    );
  }
}
