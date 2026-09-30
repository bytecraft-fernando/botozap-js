/**
 * Erro lançado quando a API responde fora da faixa 2xx. Carrega o envelope
 * de erro da BotoZap: { error: { code, message } }, mais o status HTTP e, quando
 * houve resposta HTTP (status > 0), os headers dela — úteis num 429 para ler
 * `Retry-After` / `X-RateLimit-*`. Os headers são só os da RESPOSTA; nenhum
 * header de request (que carrega a apiKey) entra aqui.
 */
export type SendFailureDetails = {
  outcome?: "rejected" | "accepted" | "unknown";
  retry?: "backoff" | "after_correction" | "reconcile_first" | "unknown";
};

export class BotoZapError extends Error {
  readonly code: string;
  readonly status: number;
  readonly outcome?: SendFailureDetails["outcome"];
  readonly retry?: SendFailureDetails["retry"];
  /** Headers da resposta HTTP. Ausente em erros sem resposta (status 0). */
  readonly headers?: Record<string, string>;

  constructor(
    code: string,
    message: string,
    status: number,
    headers?: Record<string, string>,
    details?: SendFailureDetails,
  ) {
    super(message);
    this.name = "BotoZapError";
    this.code = code;
    this.status = status;
    this.headers = headers;
    this.outcome = details?.outcome;
    this.retry = details?.retry;
  }
}

/**
 * Códigos de erro conhecidos da API (não exaustivo; valores novos podem surgir).
 * Envio (POST /v1/messages): `invalid_reaction`, `missing_reaction_target`,
 * `reaction_target_not_found`, `reaction_target_invalid`,
 * `reaction_target_expired`, `unsupported_type`, `free_form_limit_reached`
 * (429, limite 1:1 do Free). Plano: `plan_restricted` (403, escritas de IA,
 * Agenda, Calendário e Jornadas fora do plano), `free_number_cap` (402, setup
 * além do teto de Números do Free). IA: `provider_not_enabled` (422, credencial
 * nova de provedor com `accepts_new_credentials: false`).
 */
export type BotoZapErrorCode =
  | "invalid_request"
  | "unsupported_type"
  | "invalid_reaction"
  | "missing_reaction_target"
  | "reaction_target_not_found"
  | "reaction_target_invalid"
  | "reaction_target_expired"
  | "free_form_limit_reached"
  | "quota_exceeded"
  | "plan_restricted"
  | "free_number_cap"
  | "provider_not_enabled"
  | (string & {});

/** Códigos que indicam limite ou restrição do plano contratado. */
export const PLAN_ERROR_CODES = [
  "plan_restricted",
  "free_form_limit_reached",
  "free_number_cap",
] as const;

/** True quando o erro é recusa por plano (upgrade resolve; retry não). */
export function isPlanError(error: unknown): error is BotoZapError {
  return (
    error instanceof BotoZapError &&
    (PLAN_ERROR_CODES as readonly string[]).includes(error.code)
  );
}
