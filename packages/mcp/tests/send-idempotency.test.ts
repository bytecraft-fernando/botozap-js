import { expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { fullAccessIdentity } from "./helpers/identity.js";

it("prepares a key before dispatch and retains it when the host repeats after timeout", async () => {
  const sent: { key: string | null; body: unknown }[] = [];
  const server = await buildServer({ apiKey: "bz_live_fixture", fetch: async (_input, init) => {
    sent.push({ key: new Headers(init?.headers).get("Idempotency-Key"), body: JSON.parse(String(init?.body)) });
    if (sent.length === 1) throw new Error("response timed out after acceptance");
    return Response.json({ id: null, wamid: "wamid.accepted", to: "5511999999999", status: "accepted" });
  } }, fullAccessIdentity);
  const client = new Client({ name: "retry-test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    const prepared = await client.callTool({ name: "prepare_send_intent", arguments: {} });
    const key = prepared.structuredContent?.idempotency_key;
    expect(key).toMatch(/^[a-f0-9-]{36}$/); expect(sent).toHaveLength(0);
    const args = { to: "5511999999999", type: "text", text: { body: "oi" }, idempotency_key: key };
    expect((await client.callTool({ name: "send_message", arguments: args })).isError).toBe(true);
    expect((await client.callTool({ name: "send_message", arguments: args })).isError).not.toBe(true);
    expect(sent).toHaveLength(2); expect(sent[0]).toEqual(sent[1]); expect(sent[0].key).toBe(key);
    const { idempotency_key: _, ...missing } = args;
    expect((await client.callTool({ name: "send_message", arguments: missing })).isError).not.toBe(true);
    expect(sent).toHaveLength(3); expect(sent[2].key).toBeNull();
  } finally { await client.close(); await server.close(); }
});
