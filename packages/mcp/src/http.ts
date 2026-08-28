import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { BlockList, isIP } from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "./client.js";
import type { EventSignalSource } from "./resources/events.js";
import { buildServer } from "./server.js";

export type { EventSignalSource } from "./resources/events.js";

const MAX_BODY_BYTES = 1_048_576;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_PER_CLIENT = 120;
const DEFAULT_RATE_LIMIT_GLOBAL = 1_200;
const MAX_TRACKED_RATE_LIMIT_CLIENTS = 10_000;
const LOCALHOST_ALLOWED_HOSTS = ["127.0.0.1", "localhost", "[::1]", "::1"] as const;
const LOOPBACK_BINDS = new Set(["127.0.0.1", "::1", "localhost"]);

type HeaderGate = {
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
};

type RateBucket = {
  count: number;
  startedAt: number;
};

type Session = {
  activeRequests: number;
  apiKeyFingerprint: Buffer;
  closing?: Promise<void>;
  lastActivityAt: number;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

type SessionReservations = {
  byApiKey: Map<string, number>;
  total: number;
};

type ServerLifecycle = {
  closing: boolean;
};

export interface StreamableHttpServerOptions {
  baseUrl: string;
  eventSignal: EventSignalSource;
  /** Reconciliação periódica que cobre sinais perdidos/indisponibilidade do bus. */
  eventPollIntervalMs?: number;
  fetch?: typeof fetch;
  host?: string;
  /**
   * Hosts permitidos no header `Host` de `/mcp` (match exato do header ou do
   * hostname). Obrigatório fora de localhost.
   */
  allowedHosts?: readonly string[];
  /**
   * Origins permitidas no header `Origin` de `/mcp` (match exato). Ausente
   * continua aceito para clientes server-to-server.
   */
  allowedOrigins?: readonly string[];
  /** Teto de resources de Eventos por sessão. */
  maxEventSubscriptions?: number;
  /** Teto de sessões stateful mantidas por processo. */
  maxSessions?: number;
  /** Teto de sessões simultâneas ligadas à mesma chave. */
  maxSessionsPerApiKey?: number;
  /** Requisições MCP por cliente/IP em uma janela fixa de um minuto. */
  rateLimitPerClientPerMinute?: number;
  /** Requisições MCP globais por processo em uma janela fixa de um minuto. */
  rateLimitGlobalPerMinute?: number;
  /** CIDRs dos proxies autorizados a alcançar `/mcp` (ex.: ranges Cloudflare). */
  trustedProxyCidrs?: readonly string[];
  port?: number;
  /** Tempo sem request ativo antes de recolher uma sessão abandonada. */
  sessionIdleTimeoutMs?: number;
  /** Frequência da varredura de sessões abandonadas. */
  sessionSweepIntervalMs?: number;
}

export interface RunningStreamableHttpServer {
  url: URL;
  close(): Promise<void>;
}

/** CSV de allowlist: trim, descarta vazio e deduplica na ordem. */
export function parseCsvAllowlist(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return sanitizeAllowlist(raw.split(","));
}

/**
 * Recusa bind público sem allowlist de Host. Localhost/dev segue sem env
 * explícita, com a lista padrão de loopback.
 */
export function assertSecureHttpBind(
  host: string,
  allowedHosts: readonly string[],
): void {
  if (allowedHosts.length > 0) return;
  if (LOOPBACK_BINDS.has(host)) return;
  throw new Error(
    "BOTOZAP_MCP_ALLOWED_HOSTS é obrigatória quando o bind não é localhost (127.0.0.1/::1).",
  );
}

export function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

class HttpRateLimiter {
  private readonly clients = new Map<string, RateBucket>();
  private global: RateBucket = { count: 0, startedAt: 0 };

  constructor(
    private readonly perClientLimit: number,
    private readonly globalLimit: number,
  ) {}

  allow(client: string, now = Date.now()): boolean {
    this.global = currentBucket(this.global, now);
    this.compact(now);

    const key =
      this.clients.has(client) || this.clients.size < MAX_TRACKED_RATE_LIMIT_CLIENTS
        ? client
        : "__overflow__";
    const bucket = currentBucket(this.clients.get(key), now);
    this.clients.set(key, bucket);

    if (
      bucket.count >= this.perClientLimit ||
      this.global.count >= this.globalLimit
    ) {
      return false;
    }
    bucket.count += 1;
    this.global.count += 1;
    return true;
  }

  private compact(now: number): void {
    if (this.clients.size < MAX_TRACKED_RATE_LIMIT_CLIENTS) return;
    for (const [key, bucket] of this.clients) {
      if (now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) this.clients.delete(key);
    }
  }
}

export function buildTrustedProxyList(
  cidrs: readonly string[],
): BlockList | undefined {
  if (cidrs.length === 0) return undefined;
  const list = new BlockList();
  for (const cidr of sanitizeAllowlist(cidrs)) {
    const separator = cidr.lastIndexOf("/");
    const address = separator > 0 ? cidr.slice(0, separator) : "";
    const prefix = separator > 0 ? Number(cidr.slice(separator + 1)) : Number.NaN;
    const family = isIP(address);
    const maxPrefix = family === 4 ? 32 : family === 6 ? 128 : -1;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
      throw new Error(`CIDR de proxy inválido: ${cidr}`);
    }
    list.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
  }
  return list;
}

/**
 * Inicia um endpoint MCP remoto stateful. Cada sessão é criada a partir da
 * chave Bearer do initialize e fica presa ao mesmo fingerprint nos requests
 * seguintes; a autoridade da Conta continua sendo derivada pela API BotoZap.
 */
export async function startStreamableHttpServer(
  options: StreamableHttpServerOptions,
): Promise<RunningStreamableHttpServer> {
  const host = options.host ?? "127.0.0.1";
  const allowedHosts = sanitizeAllowlist(options.allowedHosts ?? []);
  const allowedOrigins = sanitizeAllowlist(options.allowedOrigins ?? []);
  assertSecureHttpBind(host, allowedHosts);
  const headerGate: HeaderGate = {
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : LOCALHOST_ALLOWED_HOSTS,
    allowedOrigins,
  };
  const rateLimiter = new HttpRateLimiter(
    options.rateLimitPerClientPerMinute ?? DEFAULT_RATE_LIMIT_PER_CLIENT,
    options.rateLimitGlobalPerMinute ?? DEFAULT_RATE_LIMIT_GLOBAL,
  );
  const trustedProxyList = buildTrustedProxyList(options.trustedProxyCidrs ?? []);

  const sessions = new Map<string, Session>();
  const reservations: SessionReservations = { byApiKey: new Map(), total: 0 };
  const lifecycle: ServerLifecycle = { closing: false };
  const idleTimeoutMs = Math.max(1, options.sessionIdleTimeoutMs ?? 5 * 60_000);
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
      if (
        session.activeRequests === 0 &&
        now - session.lastActivityAt >= idleTimeoutMs
      ) {
        void closeSession(sessions, sessionId, session);
      }
    }
  }, Math.max(1, options.sessionSweepIntervalMs ?? 30_000));
  sweep.unref?.();
  const http = createServer((request, response) => {
    void handleRequest(
      request,
      response,
      sessions,
      reservations,
      lifecycle,
      options,
      headerGate,
      rateLimiter,
      trustedProxyList,
    ).catch(() => {
      if (!response.headersSent) {
        jsonRpcError(response, 500, -32603, "Erro interno do servidor MCP.");
      } else if (!response.writableEnded) {
        response.end();
      }
    });
  });
  http.requestTimeout = 30_000;
  http.headersTimeout = 10_000;
  http.keepAliveTimeout = 5_000;
  http.maxHeadersCount = 64;

  try {
    await listen(http, options.port ?? 0, host);
  } catch (error) {
    clearInterval(sweep);
    throw error;
  }
  const address = http.address();
  if (!address || typeof address === "string") {
    clearInterval(sweep);
    await closeHttp(http);
    throw new Error("Servidor MCP remoto iniciou sem endereço TCP.");
  }

  let closePromise: Promise<void> | undefined;

  return {
    url: new URL(`http://${displayHost(host)}:${address.port}/mcp`),
    close() {
      if (closePromise) return closePromise;
      lifecycle.closing = true;
      clearInterval(sweep);
      const httpClosing = closeHttp(http);
      closePromise = (async () => {
        await closeAllSessions(sessions);
        await httpClosing;
        // Um initialize já autenticado pode ter registrado a sessão enquanto
        // o servidor HTTP drenava o request. A segunda passagem fecha essa janela.
        await closeAllSessions(sessions);
      })();
      return closePromise;
    },
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: Map<string, Session>,
  reservations: SessionReservations,
  lifecycle: ServerLifecycle,
  options: StreamableHttpServerOptions,
  headerGate: HeaderGate,
  rateLimiter: HttpRateLimiter,
  trustedProxyList: BlockList | undefined,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://mcp.invalid");
  if (url.pathname === "/healthz" && request.method === "GET") {
    writeHealthz(response);
    return;
  }
  if (url.pathname !== "/mcp") {
    jsonRpcError(response, 404, -32001, "Endpoint MCP não encontrado.");
    return;
  }
  if (!acceptTrustedProxy(request, response, trustedProxyList)) {
    return;
  }
  if (!rateLimiter.allow(rateLimitClientKey(request, trustedProxyList !== undefined))) {
    response.setHeader("Retry-After", "60");
    jsonRpcError(response, 429, -32000, "Limite de requisições MCP atingido.");
    return;
  }
  if (!acceptMcpHttpHeaders(request, response, headerGate)) {
    return;
  }
  if (lifecycle.closing) {
    jsonRpcError(response, 503, -32000, "Servidor MCP em encerramento.");
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
    await handleSessionRequest(session, request, response, body);
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
  if (lifecycle.closing) {
    jsonRpcError(response, 503, -32000, "Servidor MCP em encerramento.");
    return;
  }
  const apiKeyFingerprint = fingerprint(apiKey);
  const apiKeyReservationKey = apiKeyFingerprint.toString("base64url");
  const maxSessions = options.maxSessions ?? 1_000;
  const maxSessionsPerApiKey = options.maxSessionsPerApiKey ?? 5;
  let sessionsForApiKey = countSessionsForApiKey(sessions, apiKey);
  let reservedForApiKey = reservations.byApiKey.get(apiKeyReservationKey) ?? 0;

  // Alguns hosts encerram o stream HTTP sem enviar DELETE /mcp. A sessão fica
  // stateful no processo até o sweep e pode consumir a quota da própria chave.
  // No teto, substituímos somente a sessão MAIS ANTIGA da MESMA credencial que
  // já não tenha request ativo. Streams/requests vivos nunca são preemptados e
  // sessões de outro tenant nunca cedem capacidade.
  while (
    sessions.size + reservations.total >= maxSessions ||
    sessionsForApiKey + reservedForApiKey >= maxSessionsPerApiKey
  ) {
    const reclaimed = await reclaimOldestIdleSession(sessions, apiKey);
    if (!reclaimed) break;
    if (lifecycle.closing) {
      jsonRpcError(response, 503, -32000, "Servidor MCP em encerramento.");
      return;
    }
    sessionsForApiKey = countSessionsForApiKey(sessions, apiKey);
    reservedForApiKey = reservations.byApiKey.get(apiKeyReservationKey) ?? 0;
  }

  if (sessions.size + reservations.total >= maxSessions) {
    jsonRpcError(response, 429, -32000, "Limite de sessões MCP atingido.");
    return;
  }
  if (
    sessionsForApiKey + reservedForApiKey >=
    maxSessionsPerApiKey
  ) {
    jsonRpcError(response, 429, -32000, "Limite de sessões MCP atingido.");
    return;
  }

  reservations.total += 1;
  reservations.byApiKey.set(apiKeyReservationKey, reservedForApiKey + 1);
  let reservationReleased = false;
  const releaseReservation = () => {
    if (reservationReleased) return;
    reservationReleased = true;
    reservations.total -= 1;
    const remaining = (reservations.byApiKey.get(apiKeyReservationKey) ?? 1) - 1;
    if (remaining === 0) reservations.byApiKey.delete(apiKeyReservationKey);
    else reservations.byApiKey.set(apiKeyReservationKey, remaining);
  };

  let session: Session | undefined;
  let initializedSessionId: string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (newSessionId) => {
      initializedSessionId = newSessionId;
      if (session) sessions.set(newSessionId, session);
      releaseReservation();
    },
    onsessionclosed: async (closedSessionId) => {
      const closed = sessions.get(closedSessionId);
      if (closed) await closeSession(sessions, closedSessionId, closed);
    },
  });
  const server = buildServer({
    apiKey,
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    eventPollIntervalMs: options.eventPollIntervalMs ?? 15_000,
    eventSignal: options.eventSignal,
    maxEventSubscriptions: options.maxEventSubscriptions,
  });
  session = {
    activeRequests: 0,
    apiKeyFingerprint,
    lastActivityAt: Date.now(),
    server,
    transport,
  };
  try {
    await server.connect(transport);
    if (lifecycle.closing) {
      await server.close().catch(() => {});
      jsonRpcError(response, 503, -32000, "Servidor MCP em encerramento.");
      return;
    }
    await handleSessionRequest(session, request, response, body);
  } catch (error) {
    if (initializedSessionId) {
      await closeSession(sessions, initializedSessionId, session);
    } else {
      await server.close().catch(() => {});
    }
    throw error;
  } finally {
    releaseReservation();
  }
}

async function handleSessionRequest(
  session: Session,
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown,
): Promise<void> {
  session.activeRequests += 1;
  session.lastActivityAt = Date.now();
  try {
    await session.transport.handleRequest(request, response, body);
  } finally {
    session.activeRequests -= 1;
    session.lastActivityAt = Date.now();
  }
}

async function closeAllSessions(sessions: Map<string, Session>): Promise<void> {
  await Promise.allSettled(
    [...sessions].map(([sessionId, session]) =>
      closeSession(sessions, sessionId, session),
    ),
  );
}

function closeSession(
  sessions: Map<string, Session>,
  sessionId: string,
  session: Session,
): Promise<void> {
  if (session.closing) return session.closing;
  if (sessions.get(sessionId) === session) sessions.delete(sessionId);
  session.closing = session.server.close().catch(() => {});
  return session.closing;
}

function countSessionsForApiKey(
  sessions: Map<string, Session>,
  apiKey: string,
): number {
  return [...sessions.values()].filter((candidate) =>
    sameFingerprint(candidate.apiKeyFingerprint, apiKey),
  ).length;
}

async function reclaimOldestIdleSession(
  sessions: Map<string, Session>,
  apiKey: string,
): Promise<boolean> {
  let oldest: [string, Session] | undefined;
  for (const candidate of sessions) {
    const [, session] = candidate;
    if (
      session.activeRequests !== 0 ||
      !sameFingerprint(session.apiKeyFingerprint, apiKey)
    ) {
      continue;
    }
    if (!oldest || session.lastActivityAt < oldest[1].lastActivityAt) {
      oldest = candidate;
    }
  }
  if (!oldest) return false;
  await closeSession(sessions, oldest[0], oldest[1]);
  return true;
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

function writeHealthz(response: ServerResponse): void {
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: true }));
}

function acceptMcpHttpHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  headerGate: HeaderGate,
): boolean {
  const hostHeader = singleHeader(request, "host");
  if (!hostHeader || !hostHeaderAllowed(hostHeader, headerGate.allowedHosts)) {
    jsonRpcError(response, 403, -32000, "Host não permitido.");
    return false;
  }
  const originHeader = singleHeader(request, "origin");
  if (originHeader && !headerGate.allowedOrigins.includes(originHeader)) {
    jsonRpcError(response, 403, -32000, "Origin não permitida.");
    return false;
  }
  return true;
}

function rateLimitClientKey(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const cloudflareClient = singleHeader(request, "cf-connecting-ip");
    if (cloudflareClient && isIP(cloudflareClient) !== 0) return cloudflareClient;
  }
  return singleHeader(request, "fly-client-ip") ?? request.socket.remoteAddress ?? "unknown";
}

function acceptTrustedProxy(
  request: IncomingMessage,
  response: ServerResponse,
  trustedProxyList: BlockList | undefined,
): boolean {
  if (!trustedProxyList) return true;
  const proxyIp = singleHeader(request, "fly-client-ip");
  const family = proxyIp ? isIP(proxyIp) : 0;
  const accepted =
    family === 4
      ? trustedProxyList.check(proxyIp!, "ipv4")
      : family === 6
        ? trustedProxyList.check(proxyIp!, "ipv6")
        : false;
  if (!accepted) {
    jsonRpcError(response, 403, -32000, "Proxy de origem não permitido.");
  }
  return accepted;
}

function currentBucket(bucket: RateBucket | undefined, now: number): RateBucket {
  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    return { count: 0, startedAt: now };
  }
  return bucket;
}

function hostHeaderAllowed(
  hostHeader: string,
  allowedHosts: readonly string[],
): boolean {
  if (allowedHosts.includes(hostHeader)) return true;
  try {
    const hostname = new URL(`http://${hostHeader}`).hostname;
    return (
      allowedHosts.includes(hostname) || allowedHosts.includes(`[${hostname}]`)
    );
  } catch {
    return false;
  }
}

function sanitizeAllowlist(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
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
