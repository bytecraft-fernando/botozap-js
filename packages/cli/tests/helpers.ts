/**
 * Utilitários compartilhados pelos testes da CLI (NÃO é um arquivo de teste —
 * o vitest só coleta `*.test.ts`).
 *
 * `run` executa um comando IN-PROCESS: monta um `Command` como o `index.ts`
 * (mesmas opções globais + `exitOverride` para o erro virar throw em vez de
 * `process.exit`) e captura stdout/stderr. Estável e sem depender do `dist/`.
 */
import { Command } from "commander";
import { spawn } from "node:child_process";

/** Constrói um programa como o `index.ts` (opções globais + comandos pedidos). */
export function buildProgram(register: (p: Command) => void): Command {
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

export interface RunResult {
  stdout: string;
  stderr: string;
  error?: unknown;
}

/** Roda um comando in-process capturando stdout/stderr e o erro lançado. */
export async function run(
  register: (p: Command) => void,
  argv: string[],
): Promise<RunResult> {
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

export interface SpawnResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/**
 * Executa um binário node num processo filho de forma ASSÍNCRONA. Crucial:
 * `spawnSync` bloquearia o event loop do teste — um servidor HTTP efêmero no
 * MESMO processo nunca responderia (deadlock). Com `spawn` o loop segue vivo e
 * o servidor atende o filho. `input` é escrito no stdin e o stdin é sempre
 * encerrado (EOF), para readline/pipe não travarem à espera de mais dados.
 */
export function spawnNode(
  entry: string,
  args: string[],
  opts: { env: Record<string, string>; input?: string; timeoutMs?: number },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { env: opts.env });
    let stdout = "";
    let stderr = "";
    const timer =
      opts.timeoutMs !== undefined
        ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs)
        : undefined;
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on("close", (status, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ status, signal, stdout, stderr });
    });
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
  });
}
