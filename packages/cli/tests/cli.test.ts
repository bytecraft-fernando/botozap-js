/**
 * Testes da CLI `@botozap/cli` migrada para o SDK.
 *
 * Cobre os comportamentos auditados que NÃO podem regredir:
 *   - precedência de config (flag > env > arquivo);
 *   - permissões 0600/0700 do config no disco (endurecidas antes de gravar);
 *   - redação: `config get` mascara a chave e a saída de erro nunca a ecoa;
 *   - integração leve: a CLI monta o request certo (Bearer) e imprime o JSON
 *     cru da resposta em `messages list -o json`.
 *
 * Os comandos rodam IN-PROCESS (constrói um `Command` como o index.ts faz e
 * chama `parseAsync`) — estável e sem depender do `dist/` estar buildado. A rede
 * é um servidor HTTP efêmero (node:http, porta 0), como nos contract tests do SDK.
 */
import { Command } from "commander";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { BotoZapError } from "../src/client.js";
import {
  resolveAuth,
  setConfigValue,
  configPath,
  configDir,
} from "../src/config.js";
import { registerMessages } from "../src/commands/messages.js";
import { registerConfig } from "../src/commands/config.js";

// ---------------------------------------------------------------------------
// HOME isolado por teste — nenhum teste toca o ~/.botozap real do usuário.
// ---------------------------------------------------------------------------
const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_KEY_ENV = process.env.BOTOZAP_API_KEY;
const ORIGINAL_URL_ENV = process.env.BOTOZAP_API_URL;
let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "botozap-cli-"));
  process.env.HOME = home;
  delete process.env.BOTOZAP_API_KEY;
  delete process.env.BOTOZAP_API_URL;
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  restore(process.env, "HOME", ORIGINAL_HOME);
  restore(process.env, "BOTOZAP_API_KEY", ORIGINAL_KEY_ENV);
  restore(process.env, "BOTOZAP_API_URL", ORIGINAL_URL_ENV);
});

function restore(env: NodeJS.ProcessEnv, key: string, value: string | undefined) {
  if (value === undefined) delete env[key];
  else env[key] = value;
}

// ---------------------------------------------------------------------------
// Servidor-mock: grava cada request e devolve a fixture do próximo teste.
// ---------------------------------------------------------------------------
type Captured = {
  method: string;
  path: string;
  authorization: string | undefined;
};
let server: Server;
let baseUrl: string;
const captured: Captured[] = [];
let responder: () => { status: number; json: unknown } = () => ({
  status: 200,
  json: { data: [], paging: { cursors: { before: null, after: null }, next: null, previous: null } },
});

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    captured.push({
      method: req.method ?? "",
      path: url.pathname,
      authorization: headerValue(req.headers["authorization"]),
    });
    const out = responder();
    res.writeHead(out.status, { "content-type": "application/json" });
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

function headerValue(h: string | string[] | undefined): string | undefined {
  return Array.isArray(h) ? h[0] : h;
}

/** Constrói um programa como o index.ts (global opts + comandos pedidos). */
function buildProgram(register: (p: Command) => void): Command {
  const program = new Command();
  program
    .name("botozap")
    .exitOverride()
    .option("--api-key <chave>")
    .option("--api-url <url>")
    .option("-o, --output <formato>", "human | json", "human");
  register(program);
  return program;
}

/** Roda um comando in-process capturando stdout/stderr. */
async function run(
  register: (p: Command) => void,
  argv: string[],
): Promise<{ stdout: string; stderr: string; error?: unknown }> {
  const program = buildProgram(register);
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((s: string | Uint8Array) => {
    outChunks.push(typeof s === "string" ? s : Buffer.from(s).toString());
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((s: string | Uint8Array) => {
    errChunks.push(typeof s === "string" ? s : Buffer.from(s).toString());
    return true;
  }) as typeof process.stderr.write;
  let error: unknown;
  try {
    await program.parseAsync(["node", "botozap", ...argv]);
  } catch (e) {
    error = e;
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { stdout: outChunks.join(""), stderr: errChunks.join(""), error };
}

// ---------------------------------------------------------------------------
// (a) Precedência de config: flag > env > arquivo.
// ---------------------------------------------------------------------------
describe("precedência de config", () => {
  it("arquivo é a base, env sobrepõe arquivo, flag sobrepõe tudo", () => {
    setConfigValue("apiKey", "bz_live_fromfile");

    // só arquivo
    let auth = resolveAuth({});
    expect(auth.apiKey).toBe("bz_live_fromfile");
    expect(auth.apiKeySource).toBe("config");

    // env > arquivo
    process.env.BOTOZAP_API_KEY = "bz_live_fromenv";
    auth = resolveAuth({});
    expect(auth.apiKey).toBe("bz_live_fromenv");
    expect(auth.apiKeySource).toBe("env");

    // flag > env > arquivo
    auth = resolveAuth({ apiKey: "bz_live_fromflag" });
    expect(auth.apiKey).toBe("bz_live_fromflag");
    expect(auth.apiKeySource).toBe("flag");
  });

  it("baseUrl segue a mesma ordem e cai no default", () => {
    expect(resolveAuth({}).baseUrl).toBe("https://botozap.com.br/api/v1");
    process.env.BOTOZAP_API_URL = "https://env.example/api/v1";
    expect(resolveAuth({}).baseUrl).toBe("https://env.example/api/v1");
    expect(resolveAuth({ apiUrl: "https://flag.example/api/v1/" }).baseUrl).toBe(
      "https://flag.example/api/v1",
    );
  });
});

// ---------------------------------------------------------------------------
// (b) Permissões do config em disco.
// ---------------------------------------------------------------------------
describe("permissões do config", () => {
  it.skipIf(process.platform === "win32")(
    "grava config.json 0600 e o diretório 0700",
    () => {
      setConfigValue("apiKey", "bz_live_secret_perm");
      expect(statSync(configPath()).mode & 0o777).toBe(0o600);
      expect(statSync(configDir()).mode & 0o777).toBe(0o700);
    },
  );
});

// ---------------------------------------------------------------------------
// (c) Redação: nunca vazar a chave.
// ---------------------------------------------------------------------------
describe("redação da API key", () => {
  it("`config get` mascara a chave (prefixo + últimos 4, sem o miolo)", async () => {
    setConfigValue("apiKey", "bz_live_supersecretmiddle1234");
    const { stdout } = await run(registerConfig, ["config", "get"]);
    expect(stdout).toContain("bz_live_");
    expect(stdout).toContain("1234");
    expect(stdout).not.toContain("supersecretmiddle");
    expect(stdout).not.toContain("bz_live_supersecretmiddle1234");
  });

  it("a saída de erro (code/message do servidor) não contém a apiKey", async () => {
    const secret = "bz_live_SECRETdoNotLeak";
    responder = () => ({
      status: 401,
      json: {
        error: {
          code: "authentication_error",
          message: "Chave de API inválida ou expirada.",
        },
      },
    });

    const { stdout, error } = await run(registerMessages, [
      "messages",
      "get",
      "msg_1",
      "--api-url",
      baseUrl,
      "--api-key",
      secret,
    ]);

    // O comando propaga um BotoZapError; o index.ts o formata como
    // `Erro [code]: message`. Nem o erro nem a saída podem conter a chave.
    expect(error).toBeInstanceOf(BotoZapError);
    const err = error as BotoZapError;
    expect(err.code).toBe("authentication_error");
    const rendered = `Erro [${err.code}]: ${err.message}`;
    expect(rendered).not.toContain(secret);
    expect(stdout).not.toContain(secret);
  });
});

// ---------------------------------------------------------------------------
// (d) Integração leve: request montado + JSON cru impresso.
// ---------------------------------------------------------------------------
describe("integração messages list", () => {
  it("GET /messages com Bearer; imprime o envelope {data,paging} cru em -o json", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "msg_1", direction: "inbound", status: "delivered" }],
        paging: {
          cursors: { before: null, after: "cur_next" },
          next: "cur_next",
          previous: null,
        },
      },
    });
    captured.length = 0;

    const { stdout, error } = await run(registerMessages, [
      "messages",
      "list",
      "-o",
      "json",
      "--api-url",
      baseUrl,
      "--api-key",
      "bz_live_test",
    ]);

    expect(error).toBeUndefined();

    // Mudança observável auditada: a CLI autentica com Bearer (herdado do SDK).
    const req = captured.at(-1);
    expect(req?.method).toBe("GET");
    expect(req?.path).toBe("/messages");
    expect(req?.authorization).toBe("Bearer bz_live_test");

    // `-o json` imprime o JSON cru da resposta (envelope de lista preservado).
    const parsed = JSON.parse(stdout);
    expect(parsed.data).toEqual([
      { id: "msg_1", direction: "inbound", status: "delivered" },
    ]);
    expect(parsed.paging.next).toBe("cur_next");
  });
});
