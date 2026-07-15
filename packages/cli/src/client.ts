import { BotoZap } from "@botozap/sdk";
import { resolveAuth } from "./config.js";

// `BotoZapError` (erro de API: `.code`/`.message`/`.status`) vem do SDK — a CLI
// não tem mais cliente HTTP próprio. Re-exporta para o handler central de erro.
export { BotoZapError } from "@botozap/sdk";

/** Erro de configuração local (ex.: falta de API key). Não sai do SDK. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface GlobalOptions {
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Resolve credenciais (flag > env > config) e instancia o cliente do SDK.
 * A ausência de chave é um erro LOCAL (`ConfigError`) — nunca chega a rede.
 */
export function createClient(global: GlobalOptions): BotoZap {
  const auth = resolveAuth({ apiKey: global.apiKey, apiUrl: global.apiUrl });
  if (!auth.apiKey) {
    throw new ConfigError(
      "Nenhuma API key encontrada. Defina com `botozap config set apiKey bz_live_…`, " +
        "exporte BOTOZAP_API_KEY ou passe --api-key. Crie uma chave em /chaves no painel.",
    );
  }
  return new BotoZap({ apiKey: auth.apiKey, baseUrl: auth.baseUrl });
}
