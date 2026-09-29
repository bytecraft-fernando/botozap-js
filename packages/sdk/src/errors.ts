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
