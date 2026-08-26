import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "./client.js";
import type { EventSignalSource } from "./resources/events.js";
import { buildServer } from "./server.js";

export type { EventSignalSource } from "./resources/events.js";

const MAX_BODY_BYTES = 1_048_576;

type Session = {
  apiKeyFingerprint: Buffer;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

export interface StreamableHttpServerOptions {
  baseUrl: string;
  eventSignal: EventSignalSource;
  fetch?: typeof fetch;
  host?: string;
  port?: number;
}

export interface RunningStreamableHttpServer {
  url: URL;
  close(): Promise<void>;
}

/**
 * Inicia um endpoint MCP remoto stateful. Cada sessão é criada a partir da
 * chave Bearer do initialize e fica presa ao mesmo fingerprint nos requests
 * seguintes; a autoridade da Conta continua sendo derivada pela API BotoZap.
 */
export async function startStreamableHttpServer(
  options: StreamableHttpServerOptions,
): Promise<RunningStreamableHttpServer> {
  const sessions = new Map<string, Session>();
  const http = createServer((request, response) => {
    void handleRequest(request, response, sessions, options).catch(() => {
      if (!response.headersSent) {
        jsonRpcError(response, 500, -32603, "Erro interno do servidor MCP.");
      } else if (!response.writableEnded) {
        response.end();
      }
    });
  });

  const host = options.host ?? "127.0.0.1";
  await listen(http, options.port ?? 0, host);
  const address = http.address();
  if (!address || typeof address === "string") {
    await closeHttp(http);
    throw new Error("Servidor MCP remoto iniciou sem endereço TCP.");
  }

  return {
    url: new URL(`http://${displayHost(host)}:${address.port}/mcp`),
    async close() {
      await Promise.allSettled(
        [...sessions.values()].map(({ server }) => server.close()),
      );
      sessions.clear();
      await closeHttp(http);
    },
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: Map<string, Session>,
  options: StreamableHttpServerOptions,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://mcp.invalid");
  if (url.pathname !== "/mcp") {
    jsonRpcError(response, 404, -32001, "Endpoint MCP não encontrado.");
    return;
  }

  const apiKey = bearerToken(request);
  if (!apiKey) {
    response.setHeader("WWW-Authenticate", "Bearer");
    jsonRpcError(response, 401, -32001, "Autenticação Bearer obrigatória.");
    return;
  }

  const sessionId = singleHeader(request, "mcp-session-id");
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session || !sameFingerprint(session.apiKeyFingerprint, apiKey)) {
      jsonRpcError(response, 404, -32001, "Sessão MCP inválida.");
      return;
    }
    const body = request.method === "POST" ? await readJsonBody(request) : undefined;
    await session.transport.handleRequest(request, response, body);
    return;
  }

  if (request.method !== "POST") {
    jsonRpcError(response, 400, -32000, "Inicialize uma sessão MCP primeiro.");
    return;
  }

  const body = await readJsonBody(request);
  if (!isInitializeRequest(body)) {
    jsonRpcError(response, 400, -32000, "Requisição initialize obrigatória.");
    return;
  }

  if (!(await authenticatesForEvents(apiKey, options))) {
    response.setHeader("WWW-Authenticate", "Bearer");
    jsonRpcError(response, 401, -32001, "Credencial inválida ou sem events:read.");
    return;
  }

  let session: Session | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (newSessionId) => {
      if (session) sessions.set(newSessionId, session);
    },
    onsessionclosed: (closedSessionId) => {
      sessions.delete(closedSessionId);
    },
  });
  const server = buildServer({
    apiKey,
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    eventSignal: options.eventSignal,
  });
  session = {
    apiKeyFingerprint: fingerprint(apiKey),
    server,
    transport,
  };
  await server.connect(transport);
  await transport.handleRequest(request, response, body);
}

async function authenticatesForEvents(
  apiKey: string,
  options: Pick<StreamableHttpServerOptions, "baseUrl" | "fetch">,
): Promise<boolean> {
  try {
    await createClient({
      apiKey,
      baseUrl: options.baseUrl,
      fetch: options.fetch,
    }).events.list({ after: "0", limit: 1 });
    return true;
  } catch {
    return false;
  }
}

function bearerToken(request: IncomingMessage): string | null {
  const header = singleHeader(request, "authorization");
  const match = header?.match(/^Bearer ([^\s,]+)$/i);
  return match?.[1] ?? null;
}

function singleHeader(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name];
  return typeof value === "string" ? value : null;
}

function fingerprint(apiKey: string): Buffer {
  return createHash("sha256").update(apiKey).digest();
}

function sameFingerprint(expected: Buffer, apiKey: string): boolean {
  return timingSafeEqual(expected, fingerprint(apiKey));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw new Error("Corpo MCP excede 1 MiB.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function jsonRpcError(
  response: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeHttp(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function displayHost(host: string): string {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}
