import pg from "pg";
import type { EventSignalSource } from "./resources/events.js";

const CHANNEL = "botozap_account_events";

export interface CloseableEventSignalSource extends EventSignalSource {
  close(): Promise<void>;
}

export interface PostgresEventSignalOptions {
  maxReconnectDelayMs?: number;
  reconnectDelayMs?: number;
}

type ActiveClient = {
  client: pg.Client;
  onEnd: () => void;
  onError: (error: Error) => void;
  onNotification: (message: pg.Notification) => void;
};

/**
 * Adapter compartilhado de baixa latência. O NOTIFY não carrega payload nem
 * autoridade: cada sessão acordada relê `/events` com sua própria chave.
 * Quedas do socket refazem a conexão e o LISTEN com backoff limitado.
 */
export async function connectPostgresEventSignal(
  connectionString: string,
  options: PostgresEventSignalOptions = {},
): Promise<CloseableEventSignalSource> {
  const signal = new PostgresEventSignal(connectionString, options);
  await signal.start();
  return signal;
}

class PostgresEventSignal implements CloseableEventSignalSource {
  private active: ActiveClient | undefined;
  private closed = false;
  private connecting: Promise<void> | undefined;
  private readonly listeners = new Set<() => void>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  constructor(
    private readonly connectionString: string,
    options: PostgresEventSignalOptions,
  ) {
    this.reconnectDelayMs = Math.max(1, options.reconnectDelayMs ?? 250);
    this.maxReconnectDelayMs = Math.max(
      this.reconnectDelayMs,
      options.maxReconnectDelayMs ?? 10_000,
    );
  }

  async start(): Promise<void> {
    await this.connect().catch(() => this.scheduleReconnect());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;

    const active = this.active;
    if (active) {
      this.detach(active);
      await active.client.end().catch(() => {});
    }
    await this.connecting?.catch(() => {});
  }

  private connect(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = this.openClient().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async openClient(): Promise<void> {
    const client = new pg.Client({
      connectionString: this.connectionString,
      application_name: "botozap-mcp-event-bus",
    });
    const active: ActiveClient = {
      client,
      onEnd: () => this.handleDisconnect(active),
      onError: () => this.handleDisconnect(active),
      onNotification: (message) => {
        if (this.active !== active || message.channel !== CHANNEL) return;
        for (const listener of [...this.listeners]) {
          try {
            listener();
          } catch {
            // Uma sessão defeituosa não impede as demais de receber o sinal.
          }
        }
      },
    };
    this.active = active;
    client.on("error", active.onError);
    client.on("end", active.onEnd);
    client.on("notification", active.onNotification);

    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      if (this.closed || this.active !== active) {
        this.detach(active);
        await client.end().catch(() => {});
        return;
      }
      this.reconnectAttempt = 0;
    } catch (error) {
      this.detach(active);
      await client.end().catch(() => {});
      throw error;
    }
  }

  private handleDisconnect(active: ActiveClient): void {
    if (this.closed || this.active !== active) return;
    this.detach(active);
    void active.client.end().catch(() => {});
    this.scheduleReconnect();
  }

  private detach(active: ActiveClient): void {
    active.client.removeListener("error", active.onError);
    active.client.removeListener("end", active.onEnd);
    active.client.removeListener("notification", active.onNotification);
    if (this.active === active) this.active = undefined;
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const delay = Math.min(
      this.reconnectDelayMs * 2 ** this.reconnectAttempt,
      this.maxReconnectDelayMs,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch(() => this.scheduleReconnect());
    }, delay);
    this.reconnectTimer.unref?.();
  }
}
