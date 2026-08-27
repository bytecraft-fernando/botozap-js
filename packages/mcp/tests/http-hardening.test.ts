import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type RequestOptions,
} from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSecureHttpBind,
  parseCsvAllowlist,
  parsePositiveInteger,
  startStreamableHttpServer,
  type EventSignalSource,
} from "../src/http.js";

const SECRET = "bz_live_nao_logar_hardening";
const GARBAGE_BODY = "isto-nao-e-json";

const openServers: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
});

class TestEventSignal implements EventSignalSource {
  subscribe(): () => void {
    return () => {};
  }
}

async function startRemote(options?: {
  allowedHosts?: readonly string[];
  allowedOrigins?: readonly string[];
  host?: string;
  rateLimitGlobalPerMinute?: number;
  rateLimitPerClientPerMinute?: number;
}) {
  const remote = await startStreamableHttpServer({
    allowedHosts: options?.allowedHosts,
    allowedOrigins: options?.allowedOrigins,
    baseUrl: "http://127.0.0.1:1",
    eventSignal: new TestEventSignal(),
    host: options?.host ?? "127.0.0.1",
    port: 0,
    rateLimitGlobalPerMinute: options?.rateLimitGlobalPerMinute,
    rateLimitPerClientPerMinute: options?.rateLimitPerClientPerMinute,
  });
  openServers.push(remote);
  return remote;
}

describe("parseCsvAllowlist", () => {
  it("saneia CSV: trim, vazio e duplicata", () => {
    expect(parseCsvAllowlist(undefined)).toEqual([]);
    expect(parseCsvAllowlist("")).toEqual([]);
    expect(parseCsvAllowlist("  , , ")).toEqual([]);
    expect(
      parseCsvAllowlist(" mcp.botozap.com.br , ,localhost, mcp.botozap.com.br "),
    ).toEqual(["mcp.botozap.com.br", "localhost"]);
  });
});

describe("parsePositiveInteger", () => {
  it("aplica default e recusa limites inválidos", () => {
    expect(parsePositiveInteger(undefined, 120, "RATE")).toBe(120);
    expect(parsePositiveInteger("", 120, "RATE")).toBe(120);
    expect(parsePositiveInteger(" 42 ", 120, "RATE")).toBe(42);
    expect(() => parsePositiveInteger("0", 120, "RATE")).toThrow(/RATE/);
    expect(() => parsePositiveInteger("1.5", 120, "RATE")).toThrow(/RATE/);
    expect(() => parsePositiveInteger("NaN", 120, "RATE")).toThrow(/RATE/);
  });
});

describe("bind público inseguro", () => {
  it("recusa 0.0.0.0 e :: sem allowed hosts, preserva localhost", () => {
    expect(() => assertSecureHttpBind("127.0.0.1", [])).not.toThrow();
    expect(() => assertSecureHttpBind("localhost", [])).not.toThrow();
    expect(() => assertSecureHttpBind("::1", [])).not.toThrow();
    expect(() => assertSecureHttpBind("0.0.0.0", [])).toThrow(
      /BOTOZAP_MCP_ALLOWED_HOSTS/,
    );
    expect(() => assertSecureHttpBind("::", [])).toThrow(/BOTOZAP_MCP_ALLOWED_HOSTS/);
    expect(() =>
      assertSecureHttpBind("0.0.0.0", ["mcp.botozap.com.br"]),
    ).not.toThrow();
  });

  it("não inicia o servidor HTTP em bind público sem allowlist", async () => {
    await expect(
      startStreamableHttpServer({
        baseUrl: "http://127.0.0.1:1",
        eventSignal: new TestEventSignal(),
        host: "0.0.0.0",
        port: 0,
      }),
    ).rejects.toThrow(/BOTOZAP_MCP_ALLOWED_HOSTS/);
    await expect(
      startStreamableHttpServer({
        baseUrl: "http://127.0.0.1:1",
        eventSignal: new TestEventSignal(),
        host: "::",
        port: 0,
      }),
    ).rejects.toThrow(/BOTOZAP_MCP_ALLOWED_HOSTS/);
  });

  it("não inclui segredo na recusa de boot público", () => {
    try {
      assertSecureHttpBind("0.0.0.0", []);
      throw new Error("deveria ter recusado o bind público");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain("postgresql://");
      expect(message).not.toMatch(/bz_/);
    }
  });
});

describe("GET /healthz", () => {
  it("responde 200 JSON sem Bearer, Host ou Origin", async () => {
    const remote = await startRemote();
    const healthUrl = new URL("/healthz", remote.url);
    const response = await rawHttp(healthUrl, {
      method: "GET",
      headers: {
        authorization: `Bearer ${SECRET}`,
        host: "interno.invalido",
        origin: "https://evil.example",
      },
    });

    expect(response.status).toBe(200);
    expect(response.json).toEqual({ ok: true });
    expect(response.body).not.toContain(SECRET);
    expect(response.headers["www-authenticate"]).toBeUndefined();
  });
});

describe("Host e Origin em /mcp", () => {
  it("rejeita Host ausente ou inválido antes de autenticar ou parsear", async () => {
    const remote = await startRemote();
    const missing = await rawHttp(remote.url, {
      method: "POST",
      setHost: false,
      headers: {
        host: "",
        authorization: `Bearer ${SECRET}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: GARBAGE_BODY,
    });
    const invalid = await rawHttp(remote.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${SECRET}`,
        host: "evil.example",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: GARBAGE_BODY,
    });

    expect(missing.status).toBe(403);
    expect(invalid.status).toBe(403);
    expect(jsonRpcCode(missing.json)).toBe(-32000);
    expect(jsonRpcCode(invalid.json)).toBe(-32000);
    expect(String(jsonRpcMessage(invalid.json))).toBe("Host não permitido.");
    expect(missing.body).not.toContain(SECRET);
    expect(invalid.body).not.toContain(SECRET);
    expect(missing.headers["www-authenticate"]).toBeUndefined();
    expect(invalid.headers["www-authenticate"]).toBeUndefined();
  });

  it("aceita Host localhost padrão e ainda exige Bearer", async () => {
    const remote = await startRemote();
    const response = await rawHttp(remote.url, {
      method: "POST",
      headers: {
        host: remote.url.host,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: GARBAGE_BODY,
    });

    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(response.body).not.toContain(SECRET);
  });

  it("aceita Origin ausente e Origin na allowlist; rejeita Origin fora da lista", async () => {
    const origin = "https://app.botozap.com.br";
    const remote = await startRemote({ allowedOrigins: [origin] });
    const headers = {
      host: remote.url.host,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };

    const missing = await rawHttp(remote.url, {
      method: "POST",
      headers,
      body: GARBAGE_BODY,
    });
    const valid = await rawHttp(remote.url, {
      method: "POST",
      headers: { ...headers, origin },
      body: GARBAGE_BODY,
    });
    const invalid = await rawHttp(remote.url, {
      method: "POST",
      headers: {
        ...headers,
        authorization: `Bearer ${SECRET}`,
        origin: "https://evil.example",
      },
      body: GARBAGE_BODY,
    });

    expect(missing.status).toBe(401);
    expect(valid.status).toBe(401);
    expect(invalid.status).toBe(403);
    expect(String(jsonRpcMessage(invalid.json))).toBe("Origin não permitida.");
    expect(invalid.body).not.toContain(SECRET);
    expect(invalid.headers["www-authenticate"]).toBeUndefined();
  });

  it("com allowlist de Origin vazia, Origin presente é recusada (fail-closed)", async () => {
    const remote = await startRemote();
    const response = await rawHttp(remote.url, {
      method: "POST",
      headers: {
        host: remote.url.host,
        origin: "https://qualquer.example",
        authorization: `Bearer ${SECRET}`,
        "content-type": "application/json",
      },
      body: GARBAGE_BODY,
    });

    expect(response.status).toBe(403);
    expect(response.body).not.toContain(SECRET);
  });

  it("em bind público só aceita Host da allowlist explícita", async () => {
    const remote = await startRemote({
      host: "0.0.0.0",
      allowedHosts: ["mcp.botozap.com.br"],
    });
    const allowed = await rawHttp(remote.url, {
      method: "POST",
      headers: {
        host: "mcp.botozap.com.br",
        "content-type": "application/json",
      },
      body: GARBAGE_BODY,
    });
    const loopback = await rawHttp(remote.url, {
      method: "POST",
      headers: {
        host: remote.url.host,
        "content-type": "application/json",
      },
      body: GARBAGE_BODY,
    });

    expect(allowed.status).toBe(401);
    expect(loopback.status).toBe(403);
  });
});

describe("rate limit HTTP antes da autenticação", () => {
  it("limita por cliente e devolve Retry-After sem consultar Bearer", async () => {
    const remote = await startRemote({
      rateLimitPerClientPerMinute: 2,
      rateLimitGlobalPerMinute: 100,
    });
    const request = () =>
      rawHttp(remote.url, {
        method: "POST",
        headers: { host: remote.url.host, "fly-client-ip": "203.0.113.10" },
        body: GARBAGE_BODY,
      });

    expect((await request()).status).toBe(401);
    expect((await request()).status).toBe(401);
    const limited = await request();
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("60");
    expect(jsonRpcMessage(limited.json)).toBe("Limite de requisições MCP atingido.");
  });

  it("aplica teto global mesmo com clientes distintos", async () => {
    const remote = await startRemote({
      rateLimitPerClientPerMinute: 100,
      rateLimitGlobalPerMinute: 2,
    });
    const request = (ip: string) =>
      rawHttp(remote.url, {
        method: "POST",
        headers: { host: remote.url.host, "fly-client-ip": ip },
        body: GARBAGE_BODY,
      });

    expect((await request("203.0.113.1")).status).toBe(401);
    expect((await request("203.0.113.2")).status).toBe(401);
    expect((await request("203.0.113.3")).status).toBe(429);
  });
});

function jsonRpcCode(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return undefined;
  const error = (payload as { error?: { code?: unknown } }).error;
  return typeof error?.code === "number" ? error.code : undefined;
}

function jsonRpcMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return undefined;
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : undefined;
}

async function rawHttp(
  url: URL,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    setHost?: boolean;
  },
): Promise<{
  status: number;
  body: string;
  json: unknown;
  headers: IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      method: init.method ?? "GET",
      headers: init.headers,
    };
    if (init.setHost === false) options.setHost = false;
    const req = httpRequest(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let json: unknown = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
        resolve({
          status: res.statusCode ?? 0,
          body,
          json,
          headers: res.headers,
        });
      });
    });
    req.on("error", reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}
