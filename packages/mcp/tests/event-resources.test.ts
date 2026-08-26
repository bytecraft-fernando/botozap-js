import { createServer, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { BotoZapEvent } from "@botozap/sdk";

const API_KEY = "bz_live_event_resource_test";
const EVENTS_URI = "botozap://events?after=0&limit=100";
const SERVER_ENTRY = fileURLToPath(new URL("../dist/index.js", import.meta.url));

const openClients: Client[] = [];
const openApis: Server[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(
    openApis.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

function event(cursor: number, body: string): BotoZapEvent {
  return {
    id: `event-${cursor}`,
    cursor: String(cursor),
    type: "whatsapp.message.received",
    message_id: `wamid.inbound.${cursor}`,
    message_resource_id: `message-${cursor}`,
    occurred_at: "2026-08-26T12:00:00.000Z",
    created_at: "2026-08-26T12:00:00.100Z",
    data: {
      event: "whatsapp.message.received",
      message: { type: "text", content: { body } },
    },
  };
}

async function startApi(events: BotoZapEvent[], eventReads: URL[]): Promise<string> {
  const api = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/events") {
      eventReads.push(url);
      const after = Number(url.searchParams.get("after") ?? "0");
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const data = events
        .filter((item) => Number(item.cursor) > after)
        .slice(0, limit);
      const cursor = data.at(-1)?.cursor ?? String(after);
      const hasMore = events.some((item) => Number(item.cursor) > Number(cursor));
      jsonResponse(response, {
        data,
        paging: { cursor, next: hasMore ? cursor : null, has_more: hasMore },
      });
      return;
    }
    if (url.pathname === "/messages") {
      jsonResponse(response, {
        data: [],
        paging: {
          cursors: { before: null, after: null },
          next: null,
          previous: null,
        },
      });
      return;
    }
    jsonResponse(response, { data: null });
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  openApis.push(api);
  const address = api.address();
  if (!address || typeof address === "string") throw new Error("mock sem porta");
  return `http://127.0.0.1:${address.port}`;
}

function jsonResponse(response: ServerResponse, payload: unknown): void {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function connect(baseUrl: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: {
      ...getDefaultEnvironment(),
      BOTOZAP_API_KEY: API_KEY,
      BOTOZAP_API_URL: baseUrl,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "event-resource-test", version: "0.0.0" });
  await client.connect(transport);
  openClients.push(client);
  return client;
}

function textContent(result: Awaited<ReturnType<Client["readResource"]>>): string {
  const content = result.contents[0];
  if (!content || !("text" in content)) throw new Error("resource sem conteúdo textual");
  return content.text;
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error("condição não atingida");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("resource MCP de Eventos por stdio", () => {
  it(
    "notifica em até cinco segundos, relê pelo cursor e recupera após reconexão",
    async () => {
      const events: BotoZapEvent[] = [];
      const eventReads: URL[] = [];
      const baseUrl = await startApi(events, eventReads);
      const first = await connect(baseUrl);

      expect(first.getServerCapabilities()?.resources?.subscribe).toBe(true);
      const templates = await first.listResourceTemplates();
      expect(templates.resourceTemplates).toContainEqual(
        expect.objectContaining({
          name: "events",
          uriTemplate: "botozap://events{?after,limit}",
        }),
      );

      // Cliente tools-only continua funcionando e não inicia o tail de Eventos.
      const tools = await first.listTools();
      expect(tools.tools.some((tool) => tool.name === "list_messages")).toBe(true);
      await first.callTool({ name: "list_messages", arguments: { limit: 1 } });
      expect(eventReads).toHaveLength(0);

      let notificationCount = 0;
      let resolveNotification: ((uri: string) => void) | undefined;
      const notification = new Promise<string>((resolve) => {
        resolveNotification = resolve;
      });
      first.setNotificationHandler(ResourceUpdatedNotificationSchema, ({ params }) => {
        notificationCount += 1;
        resolveNotification?.(params.uri);
      });

      await first.subscribeResource({ uri: EVENTS_URI });
      // Deixa o probe inicial vazio terminar para medir o intervalo produtivo,
      // não apenas a primeira execução imediata do tail.
      await waitUntil(() => eventReads.length > 0, 1_000);
      const persistedAt = performance.now();
      events.push(event(1, "payload autoritativo"));

      await expect(
        Promise.race([
          notification,
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("notification não recebida")), 5_000),
          ),
        ]),
      ).resolves.toBe(EVENTS_URI);
      expect(performance.now() - persistedAt).toBeLessThan(5_000);

      const read = JSON.parse(textContent(await first.readResource({ uri: EVENTS_URI }))) as {
        data: BotoZapEvent[];
        paging: { cursor: string };
      };
      expect(read.data).toHaveLength(1);
      expect(read.data[0]).toMatchObject({
        cursor: "1",
        message_id: "wamid.inbound.1",
        data: {
          message: { content: { body: "payload autoritativo" } },
        },
      });
      expect(read.paging.cursor).toBe("1");

      await first.unsubscribeResource({ uri: EVENTS_URI });
      events.push(event(2, "durante a desconexão"));
      await new Promise((resolve) => setTimeout(resolve, 1_600));
      expect(notificationCount).toBe(1);
      await first.close();
      openClients.splice(openClients.indexOf(first), 1);

      // Um processo stdio novo relê o intervalo mantido pela API autoritativa.
      const second = await connect(baseUrl);
      const catchUp = JSON.parse(
        textContent(
          await second.readResource({
            uri: "botozap://events?after=1&limit=100",
          }),
        ),
      ) as { data: BotoZapEvent[]; paging: { cursor: string } };
      expect(catchUp.data.map((item) => item.cursor)).toEqual(["2"]);
      expect(catchUp.paging.cursor).toBe("2");
    },
    10_000,
  );
});
