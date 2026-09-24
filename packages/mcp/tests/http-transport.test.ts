import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { BotoZapEvent } from "@botozap/sdk";
import {
  startStreamableHttpServer,
  type EventSignalSource,
} from "../src/http.js";
import { waitUntil, withTimeout } from "./helpers/async.js";

const API_KEY = "bz_live_http_transport_secret";
const EVENTS_URI = "botozap://events?after=0&limit=100";

const openClients: Client[] = [];
const openServers: Array<{ close(): Promise<void> }> = [];
const openApis: Server[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
  await Promise.allSettled(
    openApis.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

class TestEventSignal implements EventSignalSource {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(): void {
    for (const listener of this.listeners) listener();
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

function event(cursor: number): BotoZapEvent {
  return {
    id: `event-${cursor}`,
    cursor: String(cursor),
    type: "whatsapp.message.received",
    message_id: `wamid.http.${cursor}`,
    message_resource_id: `message-${cursor}`,
    occurred_at: "2026-08-26T12:00:00.000Z",
    created_at: "2026-08-26T12:00:00.100Z",
    data: {
      event: "whatsapp.message.received",
      message: { type: "text", content: { body: "via event bus" } },
    },
  };
}

async function startApi(
  events: BotoZapEvent[],
  requests: URL[],
  beforeEventsResponse?: (
    readNumber: number,
    request: IncomingMessage,
  ) => Promise<void>,
  allowedApiKeys: ReadonlySet<string> = new Set([API_KEY]),
  eventsByApiKey?: ReadonlyMap<string, BotoZapEvent[]>,
): Promise<string> {
  let eventReadCount = 0;
  const api = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push(url);
    const apiKey = request.headers.authorization?.replace(/^Bearer /, "");
    if (!apiKey || !allowedApiKeys.has(apiKey)) {
      jsonResponse(response, 401, {
        error: { code: "unauthorized", message: "Chave inválida." },
      });
      return;
    }
    if (url.pathname === "/events") {
      eventReadCount += 1;
      const visibleEvents = [...(eventsByApiKey?.get(apiKey) ?? events)];
      await beforeEventsResponse?.(eventReadCount, request);
      const after = Number(url.searchParams.get("after") ?? "0");
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const remaining = visibleEvents.filter((item) => Number(item.cursor) > after);
      const data = remaining.slice(0, limit);
      const cursor = data.at(-1)?.cursor ?? String(after);
      const hasMore = remaining.some((item) => Number(item.cursor) > Number(cursor));
      jsonResponse(response, 200, {
        data,
        paging: {
          cursor,
          next: hasMore ? cursor : null,
          has_more: hasMore,
        },
      });
      return;
    }
    if (url.pathname === "/messages") {
      jsonResponse(response, 200, {
        data: [],
        paging: {
          cursors: { before: null, after: null },
          next: null,
          previous: null,
        },
      });
      return;
    }
    jsonResponse(response, 200, { data: null });
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  openApis.push(api);
  const address = api.address();
  if (!address || typeof address === "string") throw new Error("API sem porta");
  return `http://127.0.0.1:${address.port}`;
}

function jsonResponse(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function connect(url: URL, apiKey = API_KEY): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
}> {
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  const client = new Client({ name: "remote-http-test", version: "0.0.0" });
  await client.connect(transport);
  openClients.push(client);
  return { client, transport };
}

/**
 * Dispara o sweep (setInterval falso) em ticks de tempo real até a condição
 * valer. O tempo real entre ticks deixa o idle timeout vencer por `Date.now()`
 * e o abort do cliente chegar ao servidor, sem depender de um sleep fixo.
 */
async function sweepUntil(
  predicate: () => boolean,
  sweepIntervalMs: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error("condição não atingida");
    await new Promise((resolve) => setTimeout(resolve, sweepIntervalMs));
    vi.advanceTimersByTime(sweepIntervalMs);
  }
}

describe("transporte MCP Streamable HTTP", () => {
  it("mantém sessão autenticada e entrega o sinal sem expor a credencial", async () => {
    const events: BotoZapEvent[] = [];
    const apiRequests: URL[] = [];
    const eventSignal = new TestEventSignal();
    const baseUrl = await startApi(events, apiRequests);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    await expect(connect(remote.url, "bz_live_invalida")).rejects.toThrow();

    const { client, transport } = await connect(remote.url);
    expect(transport.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(client.getServerCapabilities()?.resources?.subscribe).toBe(true);
    expect((await client.listTools()).tools.some((tool) => tool.name === "list_messages")).toBe(
      true,
    );

    let resolveNotification: ((uri: string) => void) | undefined;
    const notification = new Promise<string>((resolve) => {
      resolveNotification = resolve;
    });
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, ({ params }) => {
      resolveNotification?.(params.uri);
    });
    await client.subscribeResource({ uri: EVENTS_URI });

    events.push(event(1));
    eventSignal.publish();

    await expect(withTimeout(notification, 1_000, "notification não recebida")).resolves.toBe(
      EVENTS_URI,
    );

    const read = await client.readResource({ uri: EVENTS_URI });
    const content = read.contents[0];
    if (!content || !("text" in content)) throw new Error("resource sem texto");
    expect(JSON.parse(content.text)).toMatchObject({
      data: [{ cursor: "1", message_id: "wamid.http.1" }],
      paging: { cursor: "1" },
    });
    expect(apiRequests.every((url) => !url.href.includes(API_KEY))).toBe(true);
    expect(EVENTS_URI).not.toContain(API_KEY);
  });

  it("reconcilia pelo cursor sem sinal do bus e cancela o consumo no unsubscribe", async () => {
    const events: BotoZapEvent[] = [];
    const apiRequests: URL[] = [];
    const baseUrl = await startApi(events, apiRequests);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal: new TestEventSignal(),
      eventPollIntervalMs: 25,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const { client } = await connect(remote.url);
    let notificationCount = 0;
    let resolveNotification: ((uri: string) => void) | undefined;
    const notification = new Promise<string>((resolve) => {
      resolveNotification = resolve;
    });
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, ({ params }) => {
      notificationCount += 1;
      resolveNotification?.(params.uri);
    });
    await client.subscribeResource({ uri: EVENTS_URI });
    await waitUntil(() => eventReads(apiRequests) > 0, 500);
    await new Promise((resolve) => setTimeout(resolve, 50));

    events.push(event(1));
    await expect(withTimeout(notification, 500)).resolves.toBe(EVENTS_URI);

    await client.unsubscribeResource({ uri: EVENTS_URI });
    const readsAfterUnsubscribe = eventReads(apiRequests);
    events.push(event(2));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(notificationCount).toBe(1);
    expect(eventReads(apiRequests)).toBe(readsAfterUnsubscribe);
  });

  it("não perde um sinal concorrente com a leitura em voo", async () => {
    const events: BotoZapEvent[] = [];
    const apiRequests: URL[] = [];
    let releaseRead: (() => void) | undefined;
    let markReadStarted: (() => void) | undefined;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    const holdRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const baseUrl = await startApi(events, apiRequests, async (readNumber) => {
      if (readNumber !== 2) return;
      markReadStarted?.();
      await holdRead;
    });
    const eventSignal = new TestEventSignal();
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      eventPollIntervalMs: 1_000,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const { client } = await connect(remote.url);
    let resolveNotification: ((uri: string) => void) | undefined;
    const notification = new Promise<string>((resolve) => {
      resolveNotification = resolve;
    });
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, ({ params }) => {
      resolveNotification?.(params.uri);
    });
    await client.subscribeResource({ uri: EVENTS_URI });
    await readStarted;

    events.push(event(1));
    eventSignal.publish();
    releaseRead?.();

    await expect(withTimeout(notification, 300)).resolves.toBe(EVENTS_URI);
  });

  it("drena todas as páginas de catch-up antes de esperar o heartbeat", async () => {
    const events = Array.from({ length: 101 }, (_, index) => event(index + 1));
    const eventSignal = new TestEventSignal();
    const baseUrl = await startApi(events, []);
    // Heartbeat fora do alcance do teste: a 2ª notification só pode vir da
    // drenagem de `has_more` e a 3ª só do sinal, não da reconciliação periódica.
    // Assim a espera pode ser generosa sem depender da latência do runner.
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      eventPollIntervalMs: 60_000,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const { client } = await connect(remote.url);
    let notifications = 0;
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, () => {
      notifications += 1;
    });
    await client.subscribeResource({ uri: EVENTS_URI });

    await waitUntil(() => notifications >= 2, 2_000);
    expect(notifications).toBe(2);
    expect(resourceEvents(await client.readResource({ uri: EVENTS_URI }))).toHaveLength(100);
    expect(
      resourceEvents(
        await client.readResource({ uri: "botozap://events?after=100&limit=100" }),
      ).map((item) => item.cursor),
    ).toEqual(["101"]);

    events.push(event(102));
    eventSignal.publish();
    await waitUntil(() => notifications === 3, 2_000);
    expect(
      resourceEvents(
        await client.readResource({ uri: "botozap://events?after=101&limit=100" }),
      ).map((item) => item.cursor),
    ).toEqual(["102"]);
  });

  it("aborta a leitura em voo quando a assinatura é cancelada", async () => {
    let releaseRead: (() => void) | undefined;
    let markReadStarted: (() => void) | undefined;
    let markReadAborted: (() => void) | undefined;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    const readAborted = new Promise<void>((resolve) => {
      markReadAborted = resolve;
    });
    const holdRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const baseUrl = await startApi([], [], async (readNumber, request) => {
      if (readNumber !== 2) return;
      request.once("aborted", () => markReadAborted?.());
      markReadStarted?.();
      await holdRead;
    });
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal: new TestEventSignal(),
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const { client } = await connect(remote.url);
    await client.subscribeResource({ uri: EVENTS_URI });
    await readStarted;
    try {
      await client.unsubscribeResource({ uri: EVENTS_URI });
      await expect(withTimeout(readAborted, 300)).resolves.toBeUndefined();
    } finally {
      releaseRead?.();
    }
  });

  it("recicla sessão presa apenas no listener GET/SSE quando o teto é atingido", async () => {
    const eventSignal = new TestEventSignal();
    const baseUrl = await startApi([], []);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      maxSessions: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const first = await connect(remote.url);
    expect(eventSignal.listenerCount()).toBe(1);
    const replacement = await connect(remote.url);

    expect(replacement.transport.sessionId).not.toBe(first.transport.sessionId);
    expect(eventSignal.listenerCount()).toBe(1);
    await expect(first.client.listTools()).rejects.toThrow(/Sessão MCP inválida/);
  });

  it("libera a sessão quando o cliente envia DELETE no teardown", async () => {
    const eventSignal = new TestEventSignal();
    const baseUrl = await startApi([], []);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      maxSessions: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const first = await connect(remote.url);
    expect(eventSignal.listenerCount()).toBe(1);

    await first.transport.terminateSession();
    await first.client.close();
    openClients.splice(openClients.indexOf(first.client), 1);
    await waitUntil(() => eventSignal.listenerCount() === 0, 500);

    await expect(connect(remote.url)).resolves.toBeDefined();
  });

  it("não recicla sessão enquanto um POST MCP está em andamento", async () => {
    let releaseRead: (() => void) | undefined;
    let markReadStarted: (() => void) | undefined;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    const holdRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const baseUrl = await startApi([], [], async (readNumber) => {
      if (readNumber !== 2) return;
      markReadStarted?.();
      await holdRead;
    });
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal: new TestEventSignal(),
      maxSessions: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const first = await connect(remote.url);
    const read = first.client.readResource({ uri: EVENTS_URI });
    await readStarted;

    try {
      await expect(connect(remote.url)).rejects.toThrow();
    } finally {
      releaseRead?.();
    }
    await read;

    await expect(connect(remote.url)).resolves.toBeDefined();
  });

  it("reserva o limite antes de inicializações concorrentes", async () => {
    let releaseAuthentication: (() => void) | undefined;
    const authenticationBarrier = new Promise<void>((resolve) => {
      releaseAuthentication = resolve;
    });
    const baseUrl = await startApi([], [], async (readNumber) => {
      if (readNumber > 10) return;
      if (readNumber === 10) releaseAuthentication?.();
      await authenticationBarrier;
    });
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal: new TestEventSignal(),
      maxSessions: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => connect(remote.url)),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(9);
  });

  it("limita resources assinados e devolve a vaga no unsubscribe", async () => {
    const baseUrl = await startApi([], []);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal: new TestEventSignal(),
      maxEventSubscriptions: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const { client } = await connect(remote.url);
    const nextCursorUri = "botozap://events?after=1&limit=100";
    await client.subscribeResource({ uri: EVENTS_URI });
    await expect(client.subscribeResource({ uri: nextCursorUri })).rejects.toThrow(
      "Limite de assinaturas",
    );

    await client.unsubscribeResource({ uri: EVENTS_URI });
    await expect(client.subscribeResource({ uri: nextCursorUri })).resolves.toEqual({});
  });

  it("limita o footprint de uma chave sem bloquear outra credencial", async () => {
    const otherApiKey = "bz_live_http_transport_other";
    const baseUrl = await startApi(
      [],
      [],
      undefined,
      new Set([API_KEY, otherApiKey]),
    );
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal: new TestEventSignal(),
      maxSessions: 2,
      maxSessionsPerApiKey: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const first = await connect(remote.url);
    const replacement = await connect(remote.url);

    expect(replacement.transport.sessionId).not.toBe(first.transport.sessionId);
    await expect(first.client.listTools()).rejects.toThrow(/Sessão MCP inválida/);
    await expect(connect(remote.url, otherApiKey)).resolves.toBeDefined();
  });

  it("substitui sessão abandonada da mesma chave quando o teto é atingido", async () => {
    const eventSignal = new TestEventSignal();
    const baseUrl = await startApi([], []);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      maxSessions: 1,
      maxSessionsPerApiKey: 1,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const abandoned = await connect(remote.url);
    await abandoned.client.close();
    openClients.splice(openClients.indexOf(abandoned.client), 1);

    // O cliente encerrou o stream sem DELETE /mcp: a sessão stateful ainda
    // ocupa a quota, mas já não tem request ativo e pode ser substituída.
    expect(eventSignal.listenerCount()).toBe(1);
    await expect(connect(remote.url)).resolves.toBeDefined();
    await waitUntil(() => eventSignal.listenerCount() === 1, 500);
  });

  it("expira sessão abandonada sem DELETE e recupera sua capacidade", async () => {
    // A varredura roda num setInterval; só ele fica sob relógio controlado.
    // Com o sweep em tempo real, um runner lento podia expirar a sessão no
    // intervalo entre a resposta do initialize e o POST de
    // notifications/initialized (sem request ativo), derrubando o próprio
    // handshake com "Sessão MCP inválida". Aqui o sweep só roda quando o
    // teste o dispara; Date e o I/O continuam reais.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const sweepIntervalMs = 10;
      const otherApiKey = "bz_live_http_transport_outro_tenant";
      const eventSignal = new TestEventSignal();
      const baseUrl = await startApi([], [], undefined, new Set([API_KEY, otherApiKey]));
      const remote = await startStreamableHttpServer({
        baseUrl,
        eventSignal,
        maxSessions: 1,
        sessionIdleTimeoutMs: 40,
        sessionSweepIntervalMs: sweepIntervalMs,
        host: "127.0.0.1",
        port: 0,
      });
      openServers.push(remote);

      const abandoned = await connect(remote.url);
      expect(eventSignal.listenerCount()).toBe(1);
      // Abandono: fecha o cliente sem DELETE /mcp (sem terminateSession).
      await abandoned.client.close();
      openClients.splice(openClients.indexOf(abandoned.client), 1);

      // Enquanto o sweep não roda, a sessão abandonada segura a única vaga. Outra
      // credencial não pode reciclá-la (só a mesma chave cede sessão antiga),
      // então a vaga só volta pela expiração por inatividade.
      await expect(connect(remote.url, otherApiKey)).rejects.toThrow(
        /Limite de sessões MCP atingido/,
      );
      expect(eventSignal.listenerCount()).toBe(1);

      await sweepUntil(() => eventSignal.listenerCount() === 0, sweepIntervalMs, 5_000);
      await expect(connect(remote.url, otherApiKey)).resolves.toBeDefined();
      expect(eventSignal.listenerCount()).toBe(1);
      await remote.close();
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it("não deixa initialize em voo escapar do shutdown", async () => {
    let releaseAuthentication: (() => void) | undefined;
    let markAuthenticationStarted: (() => void) | undefined;
    const authenticationStarted = new Promise<void>((resolve) => {
      markAuthenticationStarted = resolve;
    });
    const authenticationBarrier = new Promise<void>((resolve) => {
      releaseAuthentication = resolve;
    });
    const baseUrl = await startApi([], [], async (readNumber) => {
      if (readNumber !== 1) return;
      markAuthenticationStarted?.();
      await authenticationBarrier;
    });
    const eventSignal = new TestEventSignal();
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const connecting = connect(remote.url);
    await authenticationStarted;
    const closing = remote.close();
    releaseAuthentication?.();
    const [connectionResult] = await Promise.all([
      connecting.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
      closing,
    ]);
    openServers.splice(openServers.indexOf(remote), 1);
    const listenersAfterClose = eventSignal.listenerCount();
    if (connectionResult.status === "fulfilled") {
      await connectionResult.value.client.close();
      openClients.splice(openClients.indexOf(connectionResult.value.client), 1);
    }

    expect(connectionResult.status).toBe("rejected");
    expect(listenersAfterClose).toBe(0);
  });

  it("isola resources e notifications entre credenciais live e Sandbox", async () => {
    const sandboxApiKey = "bz_sandbox_http_transport";
    const liveEvents: BotoZapEvent[] = [];
    const sandboxEvents: BotoZapEvent[] = [];
    const baseUrl = await startApi(
      [],
      [],
      undefined,
      new Set([API_KEY, sandboxApiKey]),
      new Map([
        [API_KEY, liveEvents],
        [sandboxApiKey, sandboxEvents],
      ]),
    );
    const eventSignal = new TestEventSignal();
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      eventPollIntervalMs: 1_000,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const live = await connect(remote.url);
    const sandbox = await connect(remote.url, sandboxApiKey);
    const liveNotifications: string[] = [];
    const sandboxNotifications: string[] = [];
    live.client.setNotificationHandler(ResourceUpdatedNotificationSchema, ({ params }) => {
      liveNotifications.push(params.uri);
    });
    sandbox.client.setNotificationHandler(ResourceUpdatedNotificationSchema, ({ params }) => {
      sandboxNotifications.push(params.uri);
    });
    await Promise.all([
      live.client.subscribeResource({ uri: EVENTS_URI }),
      sandbox.client.subscribeResource({ uri: EVENTS_URI }),
    ]);

    liveEvents.push(event(1));
    eventSignal.publish();
    await waitUntil(() => liveNotifications.length === 1, 500);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sandboxNotifications).toEqual([]);

    const liveRead = await live.client.readResource({ uri: EVENTS_URI });
    const sandboxRead = await sandbox.client.readResource({ uri: EVENTS_URI });
    expect(resourceEvents(liveRead).map((item) => item.message_id)).toEqual([
      "wamid.http.1",
    ]);
    expect(resourceEvents(sandboxRead)).toEqual([]);

    sandboxEvents.push({
      ...event(1),
      id: "sandbox-event-1",
      message_id: "wamid.sandbox.1",
    });
    eventSignal.publish();
    await waitUntil(() => sandboxNotifications.length === 1, 500);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(liveNotifications).toHaveLength(1);
    expect(resourceEvents(await sandbox.client.readResource({ uri: EVENTS_URI }))).toEqual([
      expect.objectContaining({ id: "sandbox-event-1", message_id: "wamid.sandbox.1" }),
    ]);
  });

  it("mantém o fan-out limitado sob carga concorrente de sessões", async () => {
    const events: BotoZapEvent[] = [];
    const eventSignal = new TestEventSignal();
    const baseUrl = await startApi(events, []);
    const remote = await startStreamableHttpServer({
      baseUrl,
      eventSignal,
      eventPollIntervalMs: 1_000,
      maxSessions: 25,
      maxSessionsPerApiKey: 25,
      host: "127.0.0.1",
      port: 0,
    });
    openServers.push(remote);

    const clients = await Promise.all(
      Array.from({ length: 25 }, () => connect(remote.url)),
    );
    let notifications = 0;
    for (const { client } of clients) {
      client.setNotificationHandler(ResourceUpdatedNotificationSchema, () => {
        notifications += 1;
      });
    }
    await Promise.all(
      clients.map(({ client }) => client.subscribeResource({ uri: EVENTS_URI })),
    );
    expect(eventSignal.listenerCount()).toBe(25);
    const replacement = await connect(remote.url);
    replacement.client.setNotificationHandler(ResourceUpdatedNotificationSchema, () => {
      notifications += 1;
    });
    await replacement.client.subscribeResource({ uri: EVENTS_URI });
    expect(eventSignal.listenerCount()).toBe(25);

    events.push(event(1));
    eventSignal.publish();
    await waitUntil(() => notifications === 25, 1_000);
    expect(
      resourceEvents(await replacement.client.readResource({ uri: EVENTS_URI })),
    ).toEqual([expect.objectContaining({ id: "event-1" })]);
  });
});

function resourceEvents(
  result: Awaited<ReturnType<Client["readResource"]>>,
): BotoZapEvent[] {
  const content = result.contents[0];
  if (!content || !("text" in content)) throw new Error("resource sem texto");
  return (JSON.parse(content.text) as { data: BotoZapEvent[] }).data;
}

function eventReads(requests: URL[]): number {
  return requests.filter((url) => url.pathname === "/events").length;
}
