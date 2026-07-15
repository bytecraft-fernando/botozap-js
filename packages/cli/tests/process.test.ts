/**
 * Testes de PROCESSO: rodam o binário CONSTRUÍDO (`dist/index.js`) num processo
 * filho para travar os exit codes reais e a renderização de erro do handler
 * central do `index.ts` (que não é exercitado nos testes in-process).
 *
 * Pré-requisito: `pnpm --filter @botozap/cli build` (o `beforeAll` reconstrói
 * se o `dist/` estiver ausente). O filho é lançado de forma ASSÍNCRONA — ver
 * `spawnNode` em helpers.ts (spawnSync deadlocaria com o servidor efêmero).
 */
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { spawnNode } from "./helpers.js";

const cliRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distEntry = join(cliRoot, "dist", "index.js");
const pkgVersion = JSON.parse(
  readFileSync(join(cliRoot, "package.json"), "utf8"),
).version as string;

function childEnv(home: string, extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  delete env.BOTOZAP_API_KEY;
  delete env.BOTOZAP_API_URL;
  env.HOME = home;
  env.NO_COLOR = "1"; // saída de erro sem ANSI, substring estável
  Object.assign(env, extra ?? {});
  return env;
}

function cli(args: string[], home: string) {
  return spawnNode(distEntry, args, { env: childEnv(home), timeoutMs: 20000 });
}

let server: Server;
let baseUrl: string;
let responder: () => {
  status: number;
  json: unknown;
  headers?: Record<string, string>;
} = () => ({ status: 200, json: {} });

beforeAll(async () => {
  if (!existsSync(distEntry)) {
    execFileSync(
      process.execPath,
      [
        join(cliRoot, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        join(cliRoot, "tsconfig.json"),
      ],
      { cwd: cliRoot, stdio: "inherit" },
    );
  }
  server = createServer((_req, res) => {
    const out = responder();
    // `connection: close` faz o socket fechar após a resposta, para o filho
    // não ficar preso pelo keep-alive do undici e sair prontamente.
    res.writeHead(out.status, {
      "content-type": "application/json",
      connection: "close",
      ...(out.headers ?? {}),
    });
    res.end(JSON.stringify(out.json));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("sem porta");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "botozap-cli-proc-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("exit 0 em caminhos de sucesso", () => {
  it("--version imprime a versão do package.json e sai 0", async () => {
    const r = await cli(["--version"], home);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(pkgVersion);
  });

  it("--help (raiz) sai 0", async () => {
    const r = await cli(["--help"], home);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("botozap");
  });

  it("--help de subcomando sai 0", async () => {
    const r = await cli(["messages", "--help"], home);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("messages");
  });

  it("comando de leitura bem-sucedido sai 0", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "msg_1" }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      },
    });
    const r = await cli(
      ["messages", "list", "--api-url", baseUrl, "--api-key", "bz_live_test"],
      home,
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("msg_1");
  });
});

describe("exit 1 em erros", () => {
  it("BotoZapError (401) sai 1 e mostra o code no stderr", async () => {
    responder = () => ({
      status: 401,
      json: { error: { code: "authentication_error", message: "inválida" } },
    });
    const r = await cli(
      ["messages", "list", "--api-url", baseUrl, "--api-key", "bz_live_test"],
      home,
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("authentication_error");
  });

  it("ConfigError (sem chave) sai 1 sem tocar a rede", async () => {
    const r = await cli(["messages", "list"], home);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("API key");
  });

  it("erro genérico (send sem --to/--text) sai 1", async () => {
    const r = await cli(["messages", "send", "--api-key", "bz_live_test"], home);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--to");
  });

  it("comando desconhecido sai não-zero", async () => {
    const r = await cli(["comando-que-nao-existe"], home);
    expect(r.status).not.toBe(0);
  });
});

describe("429 renderizado end-to-end (fix)", () => {
  const rateLimited = () => ({
    status: 429,
    json: { error: { code: "rate_limit_exceeded", message: "muitas requisições" } },
    headers: {
      "retry-after": "30",
      "x-ratelimit-limit": "100",
      "x-ratelimit-remaining": "0",
    },
  });

  it("human: stderr mostra Retry-After e sai 1", async () => {
    responder = rateLimited;
    const r = await cli(
      ["messages", "list", "--api-url", baseUrl, "--api-key", "bz_live_test"],
      home,
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("rate_limit_exceeded");
    expect(r.stderr).toContain("Retry-After: 30");
    expect(r.stderr).toContain("restantes: 0");
  });

  it("json (-o json): stderr traz rate_limit re-parseável e stdout fica limpo", async () => {
    responder = rateLimited;
    const r = await cli(
      [
        "messages",
        "list",
        "-o",
        "json",
        "--api-url",
        baseUrl,
        "--api-key",
        "bz_live_test",
      ],
      home,
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toBe(""); // sucesso vai pro stdout; erro não polui
    const parsed = JSON.parse(r.stderr);
    expect(parsed.error.code).toBe("rate_limit_exceeded");
    expect(parsed.error.status).toBe(429);
    expect(parsed.error.rate_limit.retry_after).toBe("30");
    expect(parsed.error.rate_limit.remaining).toBe("0");
  });
});
