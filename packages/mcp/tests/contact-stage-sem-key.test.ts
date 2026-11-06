import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { fullAccessIdentity } from "./helpers/identity.js";

/** Etapa criada pelo cliente vem com `key: null` da API; o MCP não pode recusar a própria resposta. */
const customer = "22222222-2222-4222-8222-222222222222";
const padrao = { id: "11111111-1111-4111-8111-111111111111", key: "nao_respondeu", label: "Não respondeu", position: 1, color: "zinc" };
const propria = { id: "33333333-3333-4333-8333-333333333333", key: null, label: "Revendedora", position: 5, color: "green" };
const clients: Client[] = [];

async function connect(payload: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  const server = await buildServer({ apiKey: "bz_live_PRIVATE", baseUrl: "https://api.test/v1", fetch }, fullAccessIdentity);
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "stage-test", version: "1" });
  await Promise.all([server.connect(s), client.connect(c)]);
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

describe("etapa sem key", () => {
  it("list_contact_stages devolve a etapa própria com key null", async () => {
    const client = await connect({ data: [padrao, propria] });
    const r = await client.callTool({ name: "list_contact_stages", arguments: { customer_id: customer } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ data: [padrao, propria] });
  });

  it("create_contact_stage aceita a etapa nova com key null", async () => {
    const client = await connect({ data: propria });
    const r = await client.callTool({ name: "create_contact_stage", arguments: { customer_id: customer, label: "Revendedora", color: "green" } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ data: propria });
  });
});
