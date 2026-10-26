/**
 * Invariantes do endpoint MCP remoto (botozap#1010): sessão ociosa expira em
 * 15 min e a varredura a remove (incidente de 13/10), teto de clientes rastreados
 * no rate limit, Origin recusada por padrão e parse dos CIDRs de proxy.
 *
 * A API do BotoZap é um `node:http` local. As sessões são abertas por HTTP cru
 * (initialize + initialized, sem GET/SSE), então nenhuma requisição fica em voo e
 * a expiração depende só do relógio. O relógio controlado é o `Date` e o
 * `setInterval` da varredura; o I/O usa os timers reais.
 */
import { createServer, request as httpRequest, Agent, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it, vi } from "vitest";
import {
  buildTrustedProxyList,
  startStreamableHttpServer,
  type EventSignalSource,
  type StreamableHttpServerOptions,
} from "../src/http.js";
import { waitUntil } from "./helpers/async.js";
import { fullAccessIdentity } from "./helpers/identity.js";

const API_KEY = "bz_live_fase1_http";
const openServers: Array<{ close(): Promise<void> }> = [];
const openApis: Server[] = [];
const agent = new Agent({ keepAlive: true, maxSockets: 64 });

afterEach(async () => {
  vi.useRealTimers();
  await Promise.allSettled(openServers.splice(0).map((s) => s.close()));
  await Promise.allSettled(openApis.splice(0).map((s) => new Promise((r) => s.close(r))));
});

class Signal implements EventSignalSource {
  readonly listeners = new Set<() => void>();
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

async function startApi(): Promise<string> {
  const api = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    res.writeHead(200, { "content-type": "application/json" });
    if (path === "/me") res.end(JSON.stringify({ data: fullAccessIdentity }));
    else res.end(JSON.stringify({ data: [], paging: { cursor: "0", next: null, has_more: false } }));
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  openApis.push(api);
  return `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
}

async function startRemote(options: Partial<StreamableHttpServerOptions> = {}) {
  const signal = new Signal();
  const remote = await startStreamableHttpServer({
    baseUrl: await startApi(),
    eventSignal: signal,
    host: "127.0.0.1",
    port: 0,
    ...options,
  });
  openServers.push(remote);
  return { remote, signal };
}

type Raw = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

function raw(url: URL, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: init.method ?? "POST", headers: { host: url.host, ...init.headers }, agent }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(init.body);
  });
}

const mcpHeaders = (session?: string) => ({
  authorization: `Bearer ${API_KEY}`,
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  ...(session ? { "mcp-session-id": session, "mcp-protocol-version": "2025-06-18" } : {}),
});

/** Abre uma sessão completa e devolve o id; nenhum request fica em voo. */
async function openSession(url: URL): Promise<string> {
  const init = await raw(url, {
    headers: mcpHeaders(),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fase1", version: "0" } } }),
  });
  expect(init.status).toBe(200);
  const session = init.headers["mcp-session-id"];
  expect(typeof session).toBe("string");
  const done = await raw(url, { headers: mcpHeaders(String(session)), body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  expect(done.status).toBe(202);
  return String(session);
}

const ping = (url: URL, session: string) =>
  raw(url, { headers: mcpHeaders(session), body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "ping" }) });

// --- sessão ociosa -------------------------------------------------------------

it("sessão ociosa sai na primeira varredura de 30 s depois dos 15 min, e não antes", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], now: Date.UTC(2026, 9, 13, 12) });
  const { remote, signal } = await startRemote();
  // A sessão abre 10 s depois do servidor, fora do compasso da varredura.
  vi.advanceTimersByTime(10_000);
  await openSession(remote.url);
  expect(signal.listeners.size).toBe(1);

  // Aos 15 min ociosa ainda não houve varredura: segue de pé.
  vi.advanceTimersByTime(15 * 60_000);
  expect(signal.listeners.size).toBe(1);
  // A varredura padrão roda a cada 30 s: a primeira depois do prazo a remove.
  vi.advanceTimersByTime(19_999);
  expect(signal.listeners.size).toBe(1);
  vi.advanceTimersByTime(1);
  await waitUntil(() => signal.listeners.size === 0, 2_000);
});

it("uso renova o prazo: a sessão usada há menos de 15 min continua de pé", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], now: Date.UTC(2026, 9, 13, 12) });
  const { remote, signal } = await startRemote();
  const session = await openSession(remote.url);
  vi.advanceTimersByTime(10 * 60_000);
  expect((await ping(remote.url, session)).status).toBe(200);
  vi.advanceTimersByTime(10 * 60_000);
  expect(signal.listeners.size).toBe(1);
  expect((await ping(remote.url, session)).status).toBe(200);
  vi.advanceTimersByTime(15 * 60_000);
  await waitUntil(() => signal.listeners.size === 0, 2_000);
});

it("sessionIdleTimeoutMs e sessionSweepIntervalMs mandam no prazo e na cadência", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], now: Date.UTC(2026, 9, 13, 12) });
  const { remote, signal } = await startRemote({ sessionIdleTimeoutMs: 5_000, sessionSweepIntervalMs: 1_000 });
  await openSession(remote.url);
  vi.advanceTimersByTime(4_999);
  expect(signal.listeners.size).toBe(1);
  vi.advanceTimersByTime(1_000);
  await waitUntil(() => signal.listeners.size === 0, 2_000);
});

it("sessão com request em voo não expira, mesmo passado o prazo", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], now: Date.UTC(2026, 9, 13, 12) });
  const { remote, signal } = await startRemote({ sessionIdleTimeoutMs: 1_000, sessionSweepIntervalMs: 1_000 });
  const session = await openSession(remote.url);
  // GET /mcp abre o stream SSE da sessão e fica em voo.
  const stream = httpRequest(remote.url, { method: "GET", headers: { host: remote.url.host, ...mcpHeaders(session), accept: "text/event-stream" } });
  const opened = new Promise<void>((resolve) => stream.on("response", () => resolve()));
  stream.on("error", () => {});
  stream.end();
  await opened;
  vi.advanceTimersByTime(10_000);
  expect(signal.listeners.size).toBe(1);
  stream.destroy();
  await waitUntil(() => {
    vi.advanceTimersByTime(1_000);
    return signal.listeners.size === 0;
  }, 2_000);
});

// --- rate limit: teto de clientes rastreados ----------------------------------------

async function hit(url: URL, ip: string): Promise<number> {
  return (await raw(url, { method: "GET", headers: { "fly-client-ip": ip } })).status;
}

it("rate limit: passado o teto de 10 000 clientes, os novos dividem um balde só", async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: Date.UTC(2026, 9, 13, 12) });
  const { remote } = await startRemote({ rateLimitPerClientPerMinute: 1, rateLimitGlobalPerMinute: 1_000_000 });
  const ip = (n: number) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  for (let start = 0; start < 10_000; start += 200) {
    const statuses = await Promise.all(Array.from({ length: 200 }, (_, i) => hit(remote.url, ip(start + i))));
    expect(statuses.every((s) => s !== 429)).toBe(true);
  }
  // Cada um dos 10 000 tem o próprio balde: a segunda chamada do mesmo IP é recusada.
  expect(await hit(remote.url, ip(9_999))).toBe(429);
  // O 10 001º cai no balde de transbordo, que aceita um e recusa o próximo novo.
  expect(await hit(remote.url, ip(10_000))).not.toBe(429);
  expect(await hit(remote.url, ip(10_001))).toBe(429);
  // Passada a janela, os baldes vencidos saem e um IP novo volta a ter o seu.
  vi.setSystemTime(Date.now() + 60_000);
  expect(await hit(remote.url, ip(10_002))).not.toBe(429);
  expect(await hit(remote.url, ip(10_003))).not.toBe(429);
}, 60_000);

it("rate limit: no teto exato, a janela vencida libera baldes próprios antes do transbordo", async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: Date.UTC(2026, 9, 13, 12) });
  const { remote } = await startRemote({ rateLimitPerClientPerMinute: 1, rateLimitGlobalPerMinute: 1_000_000 });
  const ip = (n: number) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  for (let start = 0; start < 10_000; start += 200) {
    await Promise.all(Array.from({ length: 200 }, (_, i) => hit(remote.url, ip(start + i))));
  }
  // Exatamente 10 000 rastreados e nenhum no transbordo: vencida a janela, a
  // compactação roda já na primeira chamada e o IP novo ganha o próprio balde,
  // que barra a segunda chamada dele.
  vi.setSystemTime(Date.now() + 60_000);
  expect(await hit(remote.url, ip(20_000))).not.toBe(429);
  expect(await hit(remote.url, ip(20_000))).toBe(429);
  expect(await hit(remote.url, ip(20_001))).not.toBe(429);
}, 60_000);

// --- Origin ---------------------------------------------------------------------------

it("sem allowedOrigins, nenhuma Origin passa; sem Origin, segue", async () => {
  const { remote } = await startRemote();
  for (const origin of ["https://evil.example", "http://127.0.0.1", "null", "Stryker was here"]) {
    const res = await raw(remote.url, { headers: { ...mcpHeaders(), origin }, body: "{}" });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ jsonrpc: "2.0", error: { code: -32000, message: "Origin não permitida." } });
  }
  expect((await raw(remote.url, { headers: mcpHeaders(), body: "{}" })).status).not.toBe(403);
});

it("allowedOrigins aceita só a origem exata, depois de aparar os espaços", async () => {
  const { remote } = await startRemote({ allowedOrigins: [" https://chat.example ", " "] });
  const ok = await raw(remote.url, { headers: { ...mcpHeaders(), origin: "https://chat.example" }, body: "{}" });
  expect(ok.status).not.toBe(403);
  for (const origin of ["https://chat.example/", "https://chat.example:443", "http://chat.example"]) {
    expect((await raw(remote.url, { headers: { ...mcpHeaders(), origin }, body: "{}" })).status).toBe(403);
  }
});

// --- CIDR dos proxies ---------------------------------------------------------------------

it("CIDR: prefixo dentro do limite da família, endereço e barra obrigatórios", () => {
  expect(buildTrustedProxyList([])).toBeUndefined();
  const v4 = buildTrustedProxyList([" 10.0.0.0/8 ", "10.0.0.0/8", "192.0.2.7/32", "0.0.0.0/0"]);
  expect(v4?.check("10.200.1.1", "ipv4")).toBe(true);
  expect(v4?.check("192.0.2.7", "ipv4")).toBe(true);
  expect(v4?.check("2001:db8::1", "ipv6")).toBe(false);
  const v6 = buildTrustedProxyList(["2001:db8::/32", "::1/128"]);
  expect(v6?.check("2001:db8:ffff::1", "ipv6")).toBe(true);
  expect(v6?.check("2001:db9::1", "ipv6")).toBe(false);
  expect(v6?.check("::1", "ipv6")).toBe(true);
  expect(v6?.check("10.0.0.1", "ipv4")).toBe(false);
  const only = buildTrustedProxyList(["192.0.2.0/24"]);
  expect(only?.check("192.0.3.1", "ipv4")).toBe(false);
  for (const bad of ["10.0.0.0/33", "10.0.0.0/-1", "10.0.0.0/8.5", "/8", "10.0.0.0", "2001:db8::/129", "host/8", "host/0", "host/1", "10.0.0.0/x"]) {
    expect(() => buildTrustedProxyList([bad]), bad).toThrow(`CIDR de proxy inválido: ${bad}`);
  }
});
