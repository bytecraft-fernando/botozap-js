/**
 * Teto de elementos nos argumentos de tools/call (SDK 1.32 `maxToolInputElements`).
 *
 * O zod 3 acumula um issue por elemento inválido sem limite (GHSA-mrhx-c7xc-m3w5)
 * e o SDK < 1.32 validava qualquer tamanho dentro do corpo de 1 MiB
 * (GHSA-46jr-4wx8-v453). O teto barra o array antes do zod e antes da API.
 */
import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, MAX_TOOL_INPUT_ELEMENTS } from "../src/server.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const clients: Client[] = [];

async function connect() {
  const fetch = vi.fn(async () => Response.json({ data: { id: "wh_1", secret: "s" } }, { status: 201 }));
  const server = await buildServer({ apiKey: "bz_live_fake", baseUrl: "https://example.test/v1", fetch }, fullAccessIdentity);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "tool-input-limit", version: "1" });
  await Promise.all([server.connect(b), client.connect(a)]);
  clients.push(client);
  return { client, fetch };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

it("recusa array acima do teto sem validar elemento a elemento nem chamar a API", async () => {
  const { client, fetch } = await connect();
  // Números onde se espera string: sem o teto, cada um vira um issue do zod.
  const events = Array.from({ length: MAX_TOOL_INPUT_ELEMENTS + 1 }, () => 0);
  const outcome = await client
    .callTool({ name: "create_webhook", arguments: { url: "https://hooks.example.test", events } })
    .then((result) => JSON.stringify(result.content), (error: Error) => error.message);
  expect(outcome).toContain(`more than the maximum of ${MAX_TOOL_INPUT_ELEMENTS} elements`);
  expect(outcome).not.toContain("Expected string");
  expect(fetch).not.toHaveBeenCalled();
});

it("mantém chamadas normais abaixo do teto", async () => {
  const { client, fetch } = await connect();
  const result = await client.callTool({
    name: "create_webhook",
    arguments: { url: "https://hooks.example.test", events: ["messages", "statuses"] },
  });
  expect(JSON.stringify(result.content)).not.toContain("maximum of");
  expect(fetch).toHaveBeenCalledTimes(1);
});
