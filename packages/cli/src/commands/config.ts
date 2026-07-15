import { Command } from "commander";
import {
  readConfig,
  setConfigValue,
  configPath,
  type StoredConfig,
} from "../config.js";
import { resolveFormat, printJson, printLine, dim } from "../output.js";

const ALLOWED_KEYS: (keyof StoredConfig)[] = ["apiKey", "baseUrl"];

/** Mascara a API key, mostrando só o prefixo e os últimos 4 caracteres. */
function maskKey(key?: string): string {
  if (!key) return "(não definida)";
  if (key.length <= 12) return key.slice(0, 4) + "…";
  return key.slice(0, 8) + "…" + key.slice(-4);
}

export function registerConfig(program: Command): void {
  const config = program
    .command("config")
    .description("Ler e gravar a configuração local da CLI");

  config
    .command("set <chave> <valor>")
    .description("Define uma chave de config (apiKey | baseUrl)")
    .action((key: string, value: string) => {
      if (!ALLOWED_KEYS.includes(key as keyof StoredConfig)) {
        throw new Error(
          `Chave inválida: "${key}". Use uma de: ${ALLOWED_KEYS.join(", ")}.`,
        );
      }
      setConfigValue(key as keyof StoredConfig, value);
      printLine(`Gravado em ${configPath()}`);
      if (key === "apiKey") {
        printLine(dim(`apiKey = ${maskKey(value)}`));
      } else {
        printLine(dim(`${key} = ${value}`));
      }
    });

  config
    .command("get")
    .description("Mostra a config atual (apiKey mascarada)")
    .action((_opts, cmd: Command) => {
      const format = resolveFormat(cmd.optsWithGlobals().output);
      const stored = readConfig();
      if (format === "json") {
        return printJson({
          apiKey: stored.apiKey ? maskKey(stored.apiKey) : null,
          baseUrl: stored.baseUrl ?? null,
        });
      }
      printLine(`apiKey   ${maskKey(stored.apiKey)}`);
      printLine(`baseUrl  ${stored.baseUrl ?? dim("(padrão)")}`);
    });

  config
    .command("path")
    .description("Mostra o caminho do arquivo de configuração")
    .action(() => {
      printLine(configPath());
    });
}
