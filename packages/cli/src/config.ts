import { homedir } from "node:os";
import { join } from "node:path";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from "node:fs";

/** URL base padrão da API pública do BotoZap. */
export const DEFAULT_BASE_URL = "https://botozap.com.br/api/v1";

/** Diretório de configuração: `~/.botozap/cli/`. */
export function configDir(): string {
  return join(homedir(), ".botozap", "cli");
}

/** Caminho do arquivo de configuração: `~/.botozap/cli/config.json`. */
export function configPath(): string {
  return join(configDir(), "config.json");
}

/** Formato persistido em disco. Todos os campos são opcionais. */
export interface StoredConfig {
  apiKey?: string;
  baseUrl?: string;
}

/** Lê o config do disco (ou objeto vazio se não existir/inválido). */
export function readConfig(): StoredConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as StoredConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Grava o config no disco, criando o diretório com permissão restrita. */
export function writeConfig(config: StoredConfig): void {
  const dir = configDir();
  const path = configPath();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Permissões restritas ANTES de gravar o segredo: `mode` do writeFileSync só
  // vale na criação; num arquivo preexistente frouxo (ex.: legado 0644), gravar
  // primeiro abriria uma janela em que a API key fica legível por outros
  // usuários locais (TOCTOU). Endurece → escreve → reforça.
  chmodSync(dir, 0o700);
  if (existsSync(path)) chmodSync(path, 0o600);
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

/** Define uma chave individual no config persistido. */
export function setConfigValue(key: keyof StoredConfig, value: string): void {
  const current = readConfig();
  current[key] = value;
  writeConfig(current);
}

export interface ResolvedAuth {
  apiKey?: string;
  baseUrl: string;
  /** De onde veio a apiKey: flag, env, config ou nenhuma. */
  apiKeySource: "flag" | "env" | "config" | "none";
}

/**
 * Resolve credenciais com a prioridade documentada:
 * apiKey:  --api-key  > BOTOZAP_API_KEY  > config.json
 * baseUrl: --api-url  > BOTOZAP_API_URL  > config.json > DEFAULT_BASE_URL
 */
export function resolveAuth(opts: {
  apiKey?: string;
  apiUrl?: string;
}): ResolvedAuth {
  const stored = readConfig();

  let apiKey: string | undefined;
  let apiKeySource: ResolvedAuth["apiKeySource"] = "none";
  if (opts.apiKey) {
    apiKey = opts.apiKey;
    apiKeySource = "flag";
  } else if (process.env.BOTOZAP_API_KEY) {
    apiKey = process.env.BOTOZAP_API_KEY;
    apiKeySource = "env";
  } else if (stored.apiKey) {
    apiKey = stored.apiKey;
    apiKeySource = "config";
  }

  const baseUrl =
    opts.apiUrl ||
    process.env.BOTOZAP_API_URL ||
    stored.baseUrl ||
    DEFAULT_BASE_URL;

  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, ""), apiKeySource };
}
