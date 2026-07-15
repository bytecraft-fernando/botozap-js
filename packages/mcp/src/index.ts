#!/usr/bin/env node
/**
 * Bootstrap do servidor MCP do BotoZap (transporte stdio).
 *
 * Uso: defina `BOTOZAP_API_KEY` (e opcionalmente `BOTOZAP_API_URL`) e rode o
 * binário `botozap-mcp`. O servidor fala MCP por stdin/stdout — não imprima
 * nada em stdout fora do protocolo; logs vão para stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, configFromEnv } from "./server.js";

async function main(): Promise<void> {
  const config = configFromEnv();
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[botozap-mcp] servidor MCP iniciado (stdio).");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[botozap-mcp] erro fatal: ${message}`);
  process.exit(1);
});
