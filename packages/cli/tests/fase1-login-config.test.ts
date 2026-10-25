/**
 * `botozap login` e `botozap config` in-process (botozap#1010), com o config num
 * diretório temporário e o HOME também temporário: nada toca o HOME real.
 *
 * O login lê a chave de `stdin` (`node:process`). Aqui o stdin é um PassThrough
 * para o teste escrever a chave como faria um pipe ou um terminal.
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerConfig } from "../src/commands/config.js";
import { registerLogin } from "../src/commands/login.js";
import { configDir, configPath } from "../src/config.js";
import { run } from "./helpers.js";

const input = vi.hoisted(() => ({ stream: null as unknown as NodeJS.ReadStream }));
vi.mock("node:process", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:process") & { default: NodeJS.Process }>();
  return {
    ...real,
    default: real.default,
    get stdin() {
      return input.stream;
    },
  };
});

const ORIGINAL = { HOME: process.env.HOME, BOTOZAP_CONFIG_DIR: process.env.BOTOZAP_CONFIG_DIR };
let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "botozap-cli-fase1-"));
  process.env.HOME = home;
  process.env.BOTOZAP_CONFIG_DIR = join(home, "cfg");
  input.stream = new PassThrough() as unknown as NodeJS.ReadStream;
});

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(home, { recursive: true, force: true });
});

const stored = () => JSON.parse(readFileSync(configPath(), "utf8")) as Record<string, unknown>;

/**
 * Roda o login com o stdin dado. `tty` simula o terminal interativo: stdin e
 * stdout viram TTY, e o readline passa a ecoar o que é digitado no stdout.
 */
async function login(typed: string, tty = false) {
  (input.stream as { isTTY?: boolean }).isTTY = tty;
  const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", { value: tty, configurable: true, writable: true });
  try {
    const running = run(registerLogin, ["login"]);
    (input.stream as unknown as PassThrough).end(typed);
    return await running;
  } finally {
    if (stdoutTty) Object.defineProperty(process.stdout, "isTTY", stdoutTty);
    else delete (process.stdout as { isTTY?: boolean }).isTTY;
  }
}

// --- login ---------------------------------------------------------------------

it("login preserva o baseUrl já gravado ao trocar a chave", async () => {
  await run(registerConfig, ["config", "set", "baseUrl", "http://127.0.0.1:9/api/v1"]);
  await login("bz_live_nova_chave_0001\n");
  expect(stored()).toEqual({ baseUrl: "http://127.0.0.1:9/api/v1", apiKey: "bz_live_nova_chave_0001" });
  // Nada no HOME além do diretório do config pedido.
  expect(existsSync(join(home, ".botozap"))).toBe(false);
});

it("login avisa quando a chave não começa com bz_, e grava mesmo assim", async () => {
  const r = await login("sk_outra_coisa\n");
  expect(r.stdout).toContain("Aviso: a chave não começa com `bz_`. Gravando mesmo assim.");
  expect(stored()).toEqual({ apiKey: "sk_outra_coisa" });
});

it("login por pipe lê a chave do stdin, sem espaços, e não a ecoa", async () => {
  const r = await login("  bz_live_pelo_pipe_9876  \n");
  expect(r.error).toBeUndefined();
  expect(stored()).toEqual({ apiKey: "bz_live_pelo_pipe_9876" });
  expect(r.stdout).toContain("Cole sua API key: ");
  expect(r.stdout).not.toContain("bz_live_pelo_pipe_9876");
  expect(r.stdout).toContain("Chave gravada com sucesso.");
  expect(r.stdout).toContain(`Arquivo: ${configPath()}`);
  expect(r.stdout).not.toContain("Aviso");
});

it("login sem chave não grava nada", async () => {
  const r = await login("   \n");
  expect(r.stdout).toContain("Nenhuma chave informada. Nada foi gravado.");
  expect(r.stdout).not.toContain("Chave gravada");
  expect(existsSync(configPath())).toBe(false);
});

it("login no terminal grava a chave e repõe a quebra de linha", async () => {
  const r = await login("bz_live_no_terminal_5555\n", true);
  expect(stored()).toEqual({ apiKey: "bz_live_no_terminal_5555" });
  // Entre a pergunta e a confirmação a linha termina: a confirmação não cola na pergunta.
  const between = r.stdout.split("Cole sua API key: ")[1]?.split("Chave gravada com sucesso.")[0];
  expect(between).toMatch(/\n$/);
});

it("login no pipe não acrescenta quebra de linha extra depois da pergunta", async () => {
  const r = await login("bz_live_pipe_sem_quebra_1\n", false);
  expect(r.stdout).not.toMatch(/Cole sua API key: \n/);
});

// --- config ----------------------------------------------------------------------

it("config set apiKey grava e mostra a chave mascarada", async () => {
  const r = await run(registerConfig, ["config", "set", "apiKey", "bz_live_1234567890abcd"]);
  expect(r.error).toBeUndefined();
  expect(stored()).toEqual({ apiKey: "bz_live_1234567890abcd" });
  expect(r.stdout).toContain(`Gravado em ${configPath()}`);
  expect(r.stdout).toContain("apiKey = bz_live_…abcd");
  expect(r.stdout).not.toContain("1234567890");
});

it("config set baseUrl mostra o valor inteiro", async () => {
  const r = await run(registerConfig, ["config", "set", "baseUrl", "http://127.0.0.1:9/v1"]);
  expect(stored()).toEqual({ baseUrl: "http://127.0.0.1:9/v1" });
  expect(r.stdout).toContain("baseUrl = http://127.0.0.1:9/v1");
});

it("config set recusa chave fora da lista, sem gravar", async () => {
  const r = await run(registerConfig, ["config", "set", "token", "x"]);
  expect(String((r.error as Error)?.message)).toBe('Chave inválida: "token". Use uma de: apiKey, baseUrl.');
  expect(existsSync(configPath())).toBe(false);
});

it("config get mascara a chave em json e no modo humano", async () => {
  let r = await run(registerConfig, ["-o", "json", "config", "get"]);
  expect(JSON.parse(r.stdout)).toEqual({ apiKey: null, baseUrl: null });
  r = await run(registerConfig, ["config", "get"]);
  expect(r.stdout).toContain("apiKey   (não definida)");
  expect(r.stdout).toContain("baseUrl  (padrão)");

  await run(registerConfig, ["config", "set", "apiKey", "bz_live_1234567890abcd"]);
  await run(registerConfig, ["config", "set", "baseUrl", "http://127.0.0.1:9/v1"]);
  r = await run(registerConfig, ["-o", "json", "config", "get"]);
  expect(JSON.parse(r.stdout)).toEqual({ apiKey: "bz_live_…abcd", baseUrl: "http://127.0.0.1:9/v1" });
  r = await run(registerConfig, ["config", "get"]);
  expect(r.stdout).toContain("apiKey   bz_live_…abcd");
  expect(r.stdout).toContain("baseUrl  http://127.0.0.1:9/v1");
});

it("config get: chave de até 12 caracteres mostra só os 4 primeiros", async () => {
  await run(registerConfig, ["config", "set", "apiKey", "bz_live_1234"]);
  let r = await run(registerConfig, ["config", "get"]);
  expect(r.stdout).toContain("apiKey   bz_l…");
  expect(r.stdout).not.toContain("1234");
  await run(registerConfig, ["config", "set", "apiKey", "bz_live_12345"]);
  r = await run(registerConfig, ["config", "get"]);
  expect(r.stdout).toContain("apiKey   bz_live_…2345");
});

it("config path mostra o arquivo do diretório configurado", async () => {
  const r = await run(registerConfig, ["config", "path"]);
  expect(r.stdout.trim()).toBe(join(home, "cfg", "config.json"));
});

// --- arquivo de config ----------------------------------------------------------------

const mode = (path: string) => statSync(path).mode & 0o777;

it("config grava o arquivo 0600 numa pasta 0700, e endurece um arquivo legado 0644", async () => {
  await run(registerConfig, ["config", "set", "apiKey", "bz_live_1234567890abcd"]);
  expect(mode(configPath())).toBe(0o600);
  expect(mode(configDir())).toBe(0o700);

  chmodSync(configDir(), 0o755);
  chmodSync(configPath(), 0o644);
  await login("bz_live_troca_0002\n");
  expect(mode(configPath())).toBe(0o600);
  expect(mode(configDir())).toBe(0o700);
  expect(readFileSync(configPath(), "utf8")).toBe(`${JSON.stringify({ apiKey: "bz_live_troca_0002" }, null, 2)}\n`);
});

it("config ilegível conta como vazio, e gravar por cima volta a funcionar", async () => {
  for (const content of ["{quebrado", "null", "42"]) {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(configPath(), content);
    const r = await run(registerConfig, ["-o", "json", "config", "get"]);
    expect(JSON.parse(r.stdout), content).toEqual({ apiKey: null, baseUrl: null });
    const set = await run(registerConfig, ["config", "set", "baseUrl", "http://127.0.0.1:9/v1"]);
    expect(set.error, content).toBeUndefined();
    expect(stored()).toEqual({ baseUrl: "http://127.0.0.1:9/v1" });
  }
});

it("BOTOZAP_CONFIG_DIR é aparado; vazio ou só espaço cai em ~/.botozap/cli", async () => {
  process.env.BOTOZAP_CONFIG_DIR = `  ${join(home, "outro")}  `;
  expect(configPath()).toBe(join(home, "outro", "config.json"));
  for (const value of ["", "   "]) {
    process.env.BOTOZAP_CONFIG_DIR = value;
    expect(configPath()).toBe(join(home, ".botozap", "cli", "config.json"));
  }
  delete process.env.BOTOZAP_CONFIG_DIR;
  expect(configPath()).toBe(join(home, ".botozap", "cli", "config.json"));
});
