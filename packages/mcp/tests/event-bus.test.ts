import { afterEach, describe, expect, it, vi } from "vitest";
import { waitUntil } from "./helpers/async.js";

type Listener = (...args: unknown[]) => void;

class FakePgClient {
  readonly connect = vi.fn(async () => {});
  readonly end = vi.fn(async () => {});
  readonly query = vi.fn(async () => ({ rows: [] }));
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): this {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  removeListener(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

const pgMock = vi.hoisted(() => ({
  clients: [] as FakePgClient[],
  connectFailures: 0,
}));

vi.mock("pg", () => ({
  default: {
    Client: class {
      constructor() {
        const client = new FakePgClient();
        if (pgMock.connectFailures > 0) {
          pgMock.connectFailures -= 1;
          client.connect.mockRejectedValueOnce(new Error("Postgres indisponível"));
        }
        pgMock.clients.push(client);
        return client;
      }
    },
  },
}));

import { connectPostgresEventSignal } from "../src/event-bus.js";

afterEach(() => {
  pgMock.clients.splice(0);
  pgMock.connectFailures = 0;
});

describe("event bus PostgreSQL", () => {
  it("reconecta, refaz LISTEN e encerra o retry no shutdown", async () => {
    const signal = await connectPostgresEventSignal("postgresql://event-bus", {
      reconnectDelayMs: 5,
      maxReconnectDelayMs: 5,
    });
    const first = pgMock.clients[0];
    expect(first?.connect).toHaveBeenCalledOnce();
    expect(first?.query).toHaveBeenCalledWith("LISTEN botozap_account_events");

    let notifications = 0;
    signal.subscribe(() => {
      notifications += 1;
    });
    first?.emit("notification", { channel: "botozap_account_events" });
    expect(notifications).toBe(1);

    first?.emit("error", new Error("socket caiu"));
    await waitUntil(() => pgMock.clients.length === 2, 200, 2);
    const second = pgMock.clients[1];
    await waitUntil(() => (second?.query.mock.calls.length ?? 0) > 0, 200, 2);
    expect(second?.query).toHaveBeenCalledWith("LISTEN botozap_account_events");

    first?.emit("notification", { channel: "botozap_account_events" });
    second?.emit("notification", { channel: "botozap_account_events" });
    expect(notifications).toBe(2);

    await signal.close();
    second?.emit("error", new Error("depois do close"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(pgMock.clients).toHaveLength(2);
  });

  it("inicia degradado e conecta quando o bus volta", async () => {
    pgMock.connectFailures = 1;

    const signal = await connectPostgresEventSignal("postgresql://event-bus", {
      reconnectDelayMs: 5,
      maxReconnectDelayMs: 5,
    });

    await waitUntil(() => pgMock.clients.length === 2, 200, 2);
    const recovered = pgMock.clients[1];
    await waitUntil(() => (recovered?.query.mock.calls.length ?? 0) > 0, 200, 2);
    expect(recovered?.query).toHaveBeenCalledWith("LISTEN botozap_account_events");

    await signal.close();
  });
});
