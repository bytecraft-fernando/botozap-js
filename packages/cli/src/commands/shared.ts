import { Command } from "commander";
import type { BotoZap } from "@botozap/sdk";
import { createClient, type GlobalOptions } from "../client.js";
import { resolveFormat, type OutputFormat } from "../output.js";

/** Opções globais combinadas (herdadas do programa raiz) de um comando. */
export interface CommonContext {
  client: BotoZap;
  format: OutputFormat;
}

/** Lê as flags globais (--api-key/--api-url/--output) de qualquer subcomando. */
export function readGlobals(cmd: Command): {
  apiKey?: string;
  apiUrl?: string;
  output?: string;
} {
  const opts = cmd.optsWithGlobals();
  return {
    apiKey: opts.apiKey,
    apiUrl: opts.apiUrl,
    output: opts.output,
  };
}

/** Constrói client (SDK) + formato a partir do comando atual. */
export function context(cmd: Command): CommonContext {
  const g = readGlobals(cmd);
  const global: GlobalOptions = { apiKey: g.apiKey, apiUrl: g.apiUrl };
  return {
    client: createClient(global),
    format: resolveFormat(g.output),
  };
}

/** Converte string para inteiro, ou undefined se vazio/ inválido. */
export function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Booleano a partir de string "true"/"false" (ou undefined). */
export function toBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}
