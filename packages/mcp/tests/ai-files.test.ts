import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { fullAccessIdentity } from "./helpers/identity.js";

/** Arquivos do agente (#1447) no MCP: o upload em base64, os arquivos na configuração do agente e as anotações. */
const id = "11111111-1111-4111-8111-111111111111",
  clients: Client[] = [];
async function connect() {
  const fetch = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url).endsWith("/ai/uploads"))
      return Response.json({ data: { upload_id: id, upload_url: "https://storage.test/file", headers: { "Content-Type": JSON.parse(String(options?.body)).mime_type }, expires_at: "2999-01-01T00:00:00Z" } });
    if (String(url) === "https://storage.test/file") return new Response(null, { status: 200 });
    return Response.json({ data: { id, agent_id: id, version_id: id, revision: "2" } });
  });
  const server = await buildServer({ apiKey: "bz_live_fake", baseUrl: "https://example.test/v1", fetch }, fullAccessIdentity);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "ai-files-test", version: "1" });
  await Promise.all([server.connect(b), client.connect(a)]);
  clients.push(client);
  return { client, fetch };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

it("ai_files_upload sobe o base64 pelo upload direto com kind=file, sem credencial no PUT", async () => {
  const { client, fetch } = await connect();
  const result = await client.callTool({
    name: "ai_files_upload",
    arguments: { customer_id: id, file_name: "anel.jpg", file_base64: Buffer.from([0xff, 0xd8, 0xff]).toString("base64"), name: "Anel", description: "Quando pedirem o anel.", caption: "Ouro 18k" },
  });
  expect(result.isError).not.toBe(true);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toMatchObject({ customer_id: id, kind: "file", file_name: "anel.jpg", mime_type: "image/jpeg", byte_size: 3, name: "Anel", description: "Quando pedirem o anel.", caption: "Ouro 18k" });
  expect(fetch.mock.calls[1]![1]?.headers).not.toHaveProperty("Authorization");
  const invalido = await client.callTool({ name: "ai_files_upload", arguments: { customer_id: id, file_name: "a.jpg", file_base64: "não é base64", name: "A", description: "Quando" } });
  expect(invalido.isError).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("o rascunho do agente aceita os arquivos e a ferramenta que os anexa", async () => {
  const { client, fetch } = await connect();
  const config = { system_prompt: "Atenda a loja.", tool_ids: ["conversations.attach_files"], file_ids: [id] };
  const result = await client.callTool({ name: "ai_agents_save_draft", arguments: { customer_id: id, id, name: "Mari", expected_revision: "1", config } });
  expect(result.isError).not.toBe(true);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).config).toEqual(config);
});

it("as ferramentas de arquivos dizem o que fazem: ler, mudar o que os agentes mandam, subir", async () => {
  const { client } = await connect();
  const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t.annotations]));
  expect(tools.get("ai_files_list")).toMatchObject({ readOnlyHint: true });
  expect(tools.get("ai_files_get")).toMatchObject({ readOnlyHint: true });
  expect(tools.get("ai_files_update")).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
  expect(tools.get("ai_files_remove")).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
  expect(tools.get("ai_files_upload")).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true });
});
