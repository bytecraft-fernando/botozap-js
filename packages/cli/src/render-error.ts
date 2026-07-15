import { BotoZapError, ConfigError } from "./client.js";

/**
 * Formatação central de erros da CLI. Fica num módulo próprio (sem side effects
 * de import — ao contrário do `index.ts`, que executa `main()`) para ser
 * testável em processo. O `index.ts` decide human vs. json e escreve em stderr.
 *
 * Regra de segurança: estes renderizadores só tocam `code`/`message`/`status` e
 * os HEADERS DE RESPOSTA do erro (que nunca carregam a apiKey — ver
 * `@botozap/sdk` errors.ts/client.ts). Nada de header de request entra aqui.
 */

/** Campos de rate-limit lidos dos headers de um 429. Todos opcionais. */
export interface RateLimitInfo {
  retryAfter?: string;
  limit?: string;
  remaining?: string;
  reset?: string;
}

function lowerKeys(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
  return out;
}

/**
 * Extrai `Retry-After`/`X-RateLimit-*` de um `BotoZapError` 429. Só nesse caso —
 * fora dele os headers não têm significado de rate-limit. Vazio se ausentes.
 * Lookup case-insensitive (o SDK guarda em minúsculas, mas não dependemos disso).
 */
export function rateLimitInfo(err: BotoZapError): RateLimitInfo {
  if (err.status !== 429 || !err.headers) return {};
  const h = lowerKeys(err.headers);
  const info: RateLimitInfo = {};
  if (h["retry-after"] !== undefined) info.retryAfter = h["retry-after"];
  if (h["x-ratelimit-limit"] !== undefined) info.limit = h["x-ratelimit-limit"];
  if (h["x-ratelimit-remaining"] !== undefined) {
    info.remaining = h["x-ratelimit-remaining"];
  }
  if (h["x-ratelimit-reset"] !== undefined) info.reset = h["x-ratelimit-reset"];
  return info;
}

function hasAny(info: RateLimitInfo): boolean {
  return (
    info.retryAfter !== undefined ||
    info.limit !== undefined ||
    info.remaining !== undefined ||
    info.reset !== undefined
  );
}

/** Sufixo humano com os dados do 429 (só o que veio nos headers). */
function rateLimitSuffix(info: RateLimitInfo): string {
  const parts: string[] = [];
  // Mostra o valor CRU de Retry-After (a spec HTTP permite segundos OU data;
  // não afirmamos a unidade). Os contadores são informativos.
  if (info.retryAfter !== undefined) parts.push(`Retry-After: ${info.retryAfter}`);
  if (info.remaining !== undefined) parts.push(`restantes: ${info.remaining}`);
  if (info.limit !== undefined) parts.push(`limite: ${info.limit}`);
  if (info.reset !== undefined) parts.push(`reset: ${info.reset}`);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

/**
 * Texto humano de um erro. Base preservada:
 *   - `BotoZapError` → `Erro [code]: message`
 *   - `ConfigError`/genérico → `Erro: message`
 * Num 429, ACRESCENTA (não reformata) o sufixo de rate-limit ao fim.
 */
export function renderErrorText(err: unknown): string {
  if (err instanceof BotoZapError) {
    const suffix =
      err.status === 429 ? rateLimitSuffix(rateLimitInfo(err)) : "";
    return `Erro [${err.code}]: ${err.message}${suffix}`;
  }
  if (err instanceof ConfigError) return `Erro: ${err.message}`;
  const message = err instanceof Error ? err.message : String(err);
  return `Erro: ${message}`;
}

/**
 * Objeto de erro estruturado para `-o json` (envelope `{ error: {...} }`, o
 * mesmo shape da API). Num 429 inclui `rate_limit` com os campos presentes.
 */
export function renderErrorJson(err: unknown): {
  error: Record<string, unknown>;
} {
  if (err instanceof BotoZapError) {
    const info = rateLimitInfo(err);
    return {
      error: {
        code: err.code,
        message: err.message,
        status: err.status,
        ...(hasAny(info)
          ? {
              rate_limit: {
                ...(info.retryAfter !== undefined
                  ? { retry_after: info.retryAfter }
                  : {}),
                ...(info.limit !== undefined ? { limit: info.limit } : {}),
                ...(info.remaining !== undefined
                  ? { remaining: info.remaining }
                  : {}),
                ...(info.reset !== undefined ? { reset: info.reset } : {}),
              },
            }
          : {}),
      },
    };
  }
  if (err instanceof ConfigError) {
    return { error: { code: "config_error", message: err.message } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { error: { code: "error", message } };
}
