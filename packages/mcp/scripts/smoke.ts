/**
 * Smoke test: monta o servidor MCP (artefato compilado em dist/), conecta um
 * cliente MCP por um par de transportes em memória e lista as ferramentas.
 * NÃO faz nenhuma chamada real à API do BotoZap.
 *
 * Rode após o build: `pnpm --filter @botozap/mcp build && pnpm --filter @botozap/mcp smoke`.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../dist/server.js";

async function main(): Promise<void> {
  const server = buildServer({ apiKey: "bz_live_smoke_test_key" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "smoke-client", version: "0.0.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const { tools } = await client.listTools();
  console.log(`OK — servidor iniciou e expôs ${tools.length} ferramentas:`);
  for (const tool of tools.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  - ${tool.name}`);
  }

  await client.close();
  await server.close();
}

main().catch((err: unknown) => {
  console.error("FALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
