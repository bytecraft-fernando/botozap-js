import type { BotoZap } from "../client.js";
import type { EventList } from "../types.js";

/** Posição exclusiva no stream durável de Eventos. */
export interface ListEventsParams {
  /** Cursor retornado pela leitura anterior; omita para começar em zero. */
  after?: string;
  /** Quantidade máxima de Eventos na página (1..100). */
  limit?: number;
}

/** Stream durável de Eventos da Conta e ambiente derivados da chave. */
export class Events {
  constructor(private readonly client: BotoZap) {}

  list(params: ListEventsParams = {}): Promise<EventList> {
    return this.client.requestCursorList<EventList>("GET", "/events", {
      query: { after: params.after, limit: params.limit },
    });
  }
}
