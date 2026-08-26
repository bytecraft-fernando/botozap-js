#!/usr/bin/env node
/**
 * Bootstrap do servidor MCP do BotoZap.
 *
 * O padrão continua sendo stdio. `BOTOZAP_MCP_TRANSPORT=streamable-http`
 * inicia o endpoint remoto autenticado por Bearer e o event bus PostgreSQL.
 * Em stdio, nunca imprima fora do protocolo; todos os logs vão para stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connectPostgresEventSignal } from "./event-bus.js";
import { startStreamableHttpServer } from "./http.js";
import { DEFAULT_API_URL } from "./client.js";
import { buildServer, configFromEnv } from "./server.js";

async function main(): Promise<void> {
  if (process.env.BOTOZAP_MCP_TRANSPORT === "streamable-http") {
    await startHttpFromEnv();
    return;
  }

  const config = configFromEnv();
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[botozap-mcp] servidor MCP iniciado (stdio).");
}

async function startHttpFromEnv(): Promise<void> {
  const connectionString = process.env.BOTOZAP_EVENT_BUS_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "BOTOZAP_EVENT_BUS_DATABASE_URL não definida para o transporte streamable-http.",
    );
  }
  const port = parsePort(process.env.BOTOZAP_MCP_PORT);
  const host = process.env.BOTOZAP_MCP_HOST?.trim() || "127.0.0.1";
  const eventSignal = await connectPostgresEventSignal(connectionString);
  let remote;
  try {
    remote = await startStreamableHttpServer({
      baseUrl: process.env.BOTOZAP_API_URL?.trim() || DEFAULT_API_URL,
      eventSignal,
      host,
      port,
    });
  } catch (error) {
    await eventSignal.close();
    throw error;
  }

  const shutdown = async () => {
    await remote.close();
    await eventSignal.close();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
  console.error(
    `[botozap-mcp] servidor MCP iniciado (streamable-http) em ${remote.url.href}`,
  );
}

function parsePort(raw: string | undefined): number {
  const value = raw === undefined ? 3001 : Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error("BOTOZAP_MCP_PORT deve ser um inteiro entre 0 e 65535.");
  }
  return value;
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[botozap-mcp] erro fatal: ${message}`);
  process.exit(1);
});
