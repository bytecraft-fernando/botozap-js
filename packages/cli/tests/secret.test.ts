/**
 * Sigilo da API key ponta-a-ponta, no binário CONSTRUÍDO (processo filho async).
 *
 * - `login` interativo (TTY simulado): a chave digitada NÃO aparece no stdout;
 * - `login` não-interativo (pipe): grava a chave e também não a ecoa;
 * - `--help` (raiz e subcomando) nunca contém a chave (não lê o config);
 * - erro 401 (human e json) nunca contém a chave.
 *
 * TTY real exigiria um PTY (indisponível aqui); o `isTTY` é forçado por um
 * wrapper para exercitar o RAMO de mascaramento sem vazar a chave.
 */
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

const SECRET = "bz_live_typedSuperSecret1234";

function childEnv(home: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  delete env.BOTOZAP_API_KEY;
  delete env.BOTOZAP_API_URL;
  env.HOME = home;
  env.BOTOZAP_CONFIG_DIR = join(home, ".botozap", "cli");
  env.NO_COLOR = "1";
  return env;
}

function readStoredKey(home: string): string | undefined {
  const path = join(home, ".botozap", "cli", "config.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")).apiKey;
}

let server: Server;
let baseUrl: string;
let responder: () => { status: number; json: unknown } = () => ({
  status: 200,
  json: {},
});

beforeAll(async () => {
  if (!existsSync(distEntry)) throw new Error("dist ausente: rode o build antes.");
  server = createServer((_req, res) => {
    const out = responder();
    res.writeHead(out.status, {
      "content-type": "application/json",
      connection: "close",
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
  home = mkdtempSync(join(tmpdir(), "botozap-cli-sec-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("login não-interativo (pipe)", () => {
  it("grava a chave e não a ecoa no stdout", async () => {
    const r = await spawnNode(distEntry, ["login"], {
      env: childEnv(home),
      input: `${SECRET}\n`,
      timeoutMs: 20000,
    });
    expect(r.status).toBe(0);
    expect(readStoredKey(home)).toBe(SECRET);
    expect(r.stdout).not.toContain(SECRET);
  });
});

describe("login --api-key", () => {
  // O `login` diz "Cole a chave abaixo (ou rode com --api-key)" e a flag está no
  // `--help` dele. O programa também tem `--api-key` global; as duas posições gravam.
  for (const argv of [["login", "--api-key", SECRET], ["--api-key", SECRET, "login"]]) {
    it(`grava a chave sem perguntar: botozap ${argv.join(" ").replace(SECRET, "<chave>")}`, async () => {
      const r = await spawnNode(distEntry, argv, {
        env: childEnv(home),
        input: "",
        timeoutMs: 20000,
      });
      expect(r.status).toBe(0);
      expect(readStoredKey(home)).toBe(SECRET);
      expect(r.stdout).not.toContain("Cole sua API key");
      expect(r.stdout).toContain("Chave gravada com sucesso.");
      expect(r.stdout).not.toContain(SECRET);
    });
  }
});

describe("login interativo (TTY simulado)", () => {
  it("mascara: a chave não aparece no stdout, mas é gravada", async () => {
    // Wrapper que força stdin.isTTY e stdout.isTTY antes de carregar a CLI. Com
    // só o stdin como TTY, o readline (que decide pelo output) fica em modo
    // não-terminal e não ecoa nada: o teste passava mesmo sem máscara. Com os
    // dois, o readline ecoa cada tecla, como num terminal, e a máscara precisa
    // esconder. A chave chega pelo pipe (input).
    const wrapper = join(home, "tty-login.mjs");
    writeFileSync(
      wrapper,
      [
        "Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });",
        "Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });",
        "process.argv = [process.argv[0], 'botozap', 'login'];",
        `await import(${JSON.stringify(pathToFileURL(distEntry).href)});`,
        "",
      ].join("\n"),
    );
    const r = await spawnNode(wrapper, [], {
      env: childEnv(home),
      input: `${SECRET}\n`,
      timeoutMs: 20000,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(SECRET);
    expect(readStoredKey(home)).toBe(SECRET);
  });
});

describe("--help nunca vaza a chave configurada", () => {
  beforeEach(async () => {
    const set = await spawnNode(distEntry, ["config", "set", "apiKey", SECRET], {
      env: childEnv(home),
      timeoutMs: 20000,
    });
    expect(set.status).toBe(0);
    expect(readStoredKey(home)).toBe(SECRET);
  });

  it("--help da raiz não contém a chave", async () => {
    const r = await spawnNode(distEntry, ["--help"], {
      env: childEnv(home),
      timeoutMs: 20000,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(SECRET);
    expect(r.stderr).not.toContain(SECRET);
  });

  it("--help de subcomando não contém a chave", async () => {
    const r = await spawnNode(distEntry, ["messages", "--help"], {
      env: childEnv(home),
      timeoutMs: 20000,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(SECRET);
  });
});

describe("erro 401 não contém a chave (human e json)", () => {
  beforeEach(() => {
    responder = () => ({
      status: 401,
      json: { error: { code: "authentication_error", message: "inválida" } },
    });
  });

  it("human: nem stdout nem stderr contêm a chave", async () => {
    const r = await spawnNode(
      distEntry,
      ["messages", "list", "--api-url", baseUrl, "--api-key", SECRET],
      { env: childEnv(home), timeoutMs: 20000 },
    );
    expect(r.status).toBe(1);
    expect(r.stdout).not.toContain(SECRET);
    expect(r.stderr).not.toContain(SECRET);
  });

  it("json (-o json): nem stdout nem stderr contêm a chave", async () => {
    const r = await spawnNode(
      distEntry,
      [
        "messages",
        "list",
        "-o",
        "json",
        "--api-url",
        baseUrl,
        "--api-key",
        SECRET,
      ],
      { env: childEnv(home), timeoutMs: 20000 },
    );
    expect(r.status).toBe(1);
    expect(r.stdout).not.toContain(SECRET);
    expect(r.stderr).not.toContain(SECRET);
    expect(JSON.parse(r.stderr).error.code).toBe("authentication_error");
  });
});

// Terminal de verdade: o `pty` do Python abre um pseudo-terminal, a CLI roda nele
// e a chave é colada só depois da pergunta aparecer, como faz uma pessoa. O que
// volta é tudo o que o terminal mostraria na tela.
const PTY_DRIVER = String.raw`
import os, pty, select, sys, time
node, entry, key = sys.argv[1:4]
pid, fd = pty.fork()
if pid == 0:
    os.execv(node, [node, entry, "login"])
out = b""
def ler(ate, prazo):
    global out
    fim = time.time() + prazo
    while time.time() < fim:
        if select.select([fd], [], [], 0.1)[0]:
            try:
                pedaco = os.read(fd, 4096)
            except OSError:
                return False
            if not pedaco:
                return False
            out += pedaco
            if ate(out):
                return True
    return False
if not ler(lambda o: b"Cole sua API key: " in o, 15):
    sys.stdout.buffer.write(out)
    sys.exit(90)
os.write(fd, key.encode() + b"\r")
ler(lambda o: False, 15)
_, status = os.waitpid(pid, 0)
sys.stdout.buffer.write(out)
sys.exit(os.waitstatus_to_exitcode(status))
`;

/** Roda `botozap login` num pty e devolve o que a tela mostrou. */
function loginInPty(env: Record<string, string>): Promise<{ status: number | null; screen: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      "python3",
      ["-c", PTY_DRIVER, process.execPath, distEntry, SECRET],
      { env, timeout: 40000 },
      (error, stdout) => {
        if (error && typeof error.code !== "number") reject(error);
        else resolve({ status: error ? (error.code as number) : 0, screen: stdout });
      },
    );
  });
}

describe("login interativo (terminal real)", () => {
  it("a chave colada não aparece na tela, e é gravada", async () => {
    const r = await loginInPty(childEnv(home));
    expect(r.status, r.screen).toBe(0);
    expect(r.screen).toContain("Cole sua API key: ");
    expect(r.screen).toContain("Chave gravada com sucesso.");
    expect(r.screen).not.toContain(SECRET);
    expect(readStoredKey(home)).toBe(SECRET);
  });
});
