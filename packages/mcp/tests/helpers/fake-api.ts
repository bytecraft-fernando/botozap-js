import { afterEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../../src/server.js";
import { fullAccessIdentity } from "./identity.js";

/** Chamada que o servidor MCP fez à API falsa. */
export type Captured = { method: string; path: string; body: unknown };

const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
});

/**
 * Servidor MCP ligado a uma API falsa: `responder` devolve a resposta de cada
 * chamada pelo método HTTP, e `captured` guarda método, caminho e corpo.
 */
export async function connectWithFakeApi(
  responder: (method: string) => Response,
  identity: ApiIdentity = fullAccessIdentity,
) {
  const captured: Captured[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    captured.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return responder(method);
  });
  const server = await buildServer({ apiKey: "bz_live_fake_api_test", baseUrl: "https://api.test/v1", fetch }, identity);
  const client = new Client({ name: "fake-api-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, captured };
}
