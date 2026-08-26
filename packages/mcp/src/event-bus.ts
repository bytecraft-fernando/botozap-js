import pg from "pg";
import type { EventSignalSource } from "./resources/events.js";

const CHANNEL = "botozap_account_events";

export interface CloseableEventSignalSource extends EventSignalSource {
  close(): Promise<void>;
}

/**
 * Adapter compartilhado de baixa latência. O NOTIFY não carrega payload nem
 * autoridade: cada sessão acordada relê `/events` com sua própria chave.
 */
export async function connectPostgresEventSignal(
  connectionString: string,
): Promise<CloseableEventSignalSource> {
  const client = new pg.Client({
    connectionString,
    application_name: "botozap-mcp-event-bus",
  });
  const listeners = new Set<() => void>();
  const notify = (message: pg.Notification) => {
    if (message.channel !== CHANNEL) return;
    for (const listener of listeners) listener();
  };

  // Um listener de erro impede que EventEmitter encerre o processo. Reconnect e
  // catch-up durante indisponibilidade pertencem ao hardening da issue #216.
  client.on("error", () => {});
  client.on("notification", notify);

  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
  } catch {
    await client.end().catch(() => {});
    throw new Error("Não foi possível conectar ao event bus PostgreSQL.");
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      listeners.clear();
      client.removeListener("notification", notify);
      await client.end();
    },
  };
}
