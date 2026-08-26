import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { BotoZapEvent } from "@botozap/sdk";
import {
  startStreamableHttpServer,
  type EventSignalSource,
} from "../src/http.js";

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

async function startApi(events: BotoZapEvent[], requests: URL[]): Promise<string> {
  const api = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push(url);
    if (request.headers.authorization !== `Bearer ${API_KEY}`) {
      jsonResponse(response, 401, {
        error: { code: "unauthorized", message: "Chave inválida." },
      });
      return;
    }
    if (url.pathname === "/events") {
      const after = Number(url.searchParams.get("after") ?? "0");
      const data = events.filter((item) => Number(item.cursor) > after);
      jsonResponse(response, 200, {
        data,
        paging: {
          cursor: data.at(-1)?.cursor ?? String(after),
          next: null,
          has_more: false,
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

    await expect(
      Promise.race([
        notification,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("notification não recebida")), 1_000),
        ),
      ]),
    ).resolves.toBe(EVENTS_URI);

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
});
