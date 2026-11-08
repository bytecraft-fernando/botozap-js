/**
 * Envios sem confirmação da Meta no MCP (task 26 da #1306 no botozap): list_pending_sends e
 * mark_pending_send, como o aviso na conversa no painel. Só no catálogo completo.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { ASSISTANT_TOOLS } from "../src/catalog-profile.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { TOOL_ROUTES } from "../src/tool-routes.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const CONV = "a1000000-0000-4000-8000-0000000000c1";
const SEND = "a1000000-0000-4000-8000-0000000000f1";
const clients: Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) await c.close();
});

async function connect(responder: (path: string, method: string) => Response) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
    return responder(url.pathname, init?.method ?? "GET");
  });
  const server = await buildServer({ apiKey: "bz_live_pendentes_test", baseUrl: "https://api.test/v1", fetch }, fullAccessIdentity);
  const client = new Client({ name: "pendentes-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return { client, calls, bodies };
}

describe("envios sem confirmação no MCP", () => {
  it("políticas, rotas e fora do perfil assistant", () => {
    expect(MCP_TOOL_POLICIES.list_pending_sends).toMatchObject({ requiredScopes: ["conversations:read"], readOnlyHint: true, sandbox: false });
    expect(MCP_TOOL_POLICIES.mark_pending_send).toMatchObject({ requiredScopes: ["messages:send"], readOnlyHint: false, destructiveHint: false, idempotentHint: false, sandbox: false });
    expect(TOOL_ROUTES.list_pending_sends).toEqual(["GET /v1/conversations/:id/pending-sends"]);
    expect(TOOL_ROUTES.mark_pending_send).toEqual(["POST /v1/conversations/:id/pending-sends/:sendId"]);
    expect([ASSISTANT_TOOLS.has("list_pending_sends"), ASSISTANT_TOOLS.has("mark_pending_send")]).toEqual([false, false]);
  });

  it("lista e marca pela API", async () => {
    const { client, calls, bodies } = await connect((_path, method) =>
      method === "GET"
        ? Response.json({ data: [{ id: SEND, status: "unconfirmed", locks_conversation: false, kind: "template", preview: "aviso", created_at: "2026-11-08T12:00:00.000Z" }] })
        : Response.json({ data: { id: SEND, status: "sent" } }),
    );
    const listed = await client.callTool({ name: "list_pending_sends", arguments: { conversation_id: CONV } });
    const marked = await client.callTool({ name: "mark_pending_send", arguments: { conversation_id: CONV, send_id: SEND, outcome: "sent" } });
    expect(listed.structuredContent).toMatchObject({ data: [{ id: SEND, status: "unconfirmed", preview: "aviso" }] });
    expect(marked.structuredContent).toMatchObject({ data: { id: SEND, status: "sent" } });
    expect(calls).toEqual([`GET /v1/conversations/${CONV}/pending-sends`, `POST /v1/conversations/${CONV}/pending-sends/${SEND}`]);
    expect(bodies[1]).toEqual({ outcome: "sent" });
  });
});
