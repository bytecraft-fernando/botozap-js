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
 * Agenda, Calendário, Jornadas, Regras de mensagem do Direct e Perguntas e menu
 * fora do plano), `free_number_cap` (402, setup além do teto de Números do Free
 * ou envio por um Número suspenso no Free), `free_cap` (402, criar o 2º Cliente
 * no Free ou enviar por um Cliente suspenso no Free). Consentimento:
 * `consent_opted_out` (409, registrar aceite sobre uma recusa do contato; nada é
 * gravado), `consent_revoked` (422, envio de template de marketing a quem
 * recusou, também quando a recusa foi por outro número da Conta; `consent_basis`
 * não desfaz); só o próprio contato volta a aceitar. Pedido de consentimento
 * (`conversations.requestConsent`): `outside_window` (WhatsApp) e `window_closed`
 * (Instagram) com a janela de 24h fechada, `channel_not_supported`. IA:
 * `provider_not_enabled` (422, provedor descontinuado: o catálogo aceita só
 * `openai` e `anthropic`; vale na credencial nova, ao ativar ou trocar a chave,
 * revalidar, nos vínculos de provedor e ao salvar agente com provedor
 * descontinuado). Conexão: `not_connected` (409, número desconectado ou sem
 * token no envio, na mídia, no pedido de consentimento, em transmissão e ao criar template). Acesso:
 * `ip_not_allowed` (403, chave com lista de IPs autorizados e chamada de outro
 * IP), `admin_required` (403, registro de atividades só para Administrador),
 * `gone` (410, rota removida; nenhuma ação é necessária, como as de
 * data-use da IA). Cobrança:
 * `business_payment_required` (402 no envio: o negócio está pausado porque a
 * fatura do slot venceu há mais de 7 dias; pague e envie de novo),
 * `plan_required` (402, comprar slot no Free ou teste), `slot_limit` (402, já há
 * 2 slots com fatura em aberto), `billing_customer_required` (402, conta sem
 * cadastro de cobrança), `slot_in_use` (409, cancelar slot ocupado).
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
  | "free_cap"
  | "feature_unavailable"
  | "provider_not_enabled"
  | "consent_opted_out"
  | "consent_revoked"
  | "outside_window"
  | "window_closed"
  | "channel_not_supported"
  | "not_connected"
  | "ip_not_allowed"
  | "admin_required"
  | "gone"
  | "business_payment_required"
  | "plan_required"
  | "slot_limit"
  | "slot_in_use"
  | "billing_customer_required"
  | (string & {});

/** Códigos que indicam limite ou restrição do plano contratado. */
export const PLAN_ERROR_CODES = [
  "plan_restricted",
  "free_form_limit_reached",
  "free_number_cap",
  "free_cap",
] as const;

/** True quando o erro é recusa por plano (upgrade resolve; retry não). */
export function isPlanError(error: unknown): error is BotoZapError {
  return (
    error instanceof BotoZapError &&
    (PLAN_ERROR_CODES as readonly string[]).includes(error.code)
  );
}

/**
 * True quando o envio foi recusado porque o negócio está pausado: a fatura do
 * slot venceu há mais de 7 dias. Pagar a fatura libera na hora; repetir antes
 * disso não adianta. Não é recusa de plano ({@link isPlanError} é `false`).
 */
export function isBusinessPaymentRequired(error: unknown): error is BotoZapError {
  return error instanceof BotoZapError && error.code === "business_payment_required";
}

/**
 * True quando a API recusou por causa do teto de 1 negócio (Cliente) do plano
 * Free (402 `free_cap`): criar o 2º Cliente (`customers.create`) ou enviar por
 * um Cliente suspenso. O Cliente suspenso (`plan_suspended: true`) continua
 * recebendo, mas não conecta canais nem envia. Libera na hora ao assinar; no
 * Free, apagar o outro Cliente (ou, no envio, desconectar os canais dele)
 * libera a vaga. Repetir antes disso não adianta. É recusa de plano
 * ({@link isPlanError} é `true`).
 */
export function isFreeCap(error: unknown): error is BotoZapError {
  return error instanceof BotoZapError && error.code === "free_cap";
}

/**
 * True quando a API recusou por causa do teto de 1 número do plano Free (402
 * `free_number_cap`): enviar por um Número suspenso ou conectar outro número
 * no setup. O Número suspenso (`plan_suspended: true`) continua recebendo, mas
 * não envia. Libera na hora ao assinar ou ao desconectar o outro número;
 * repetir antes disso não adianta. É recusa de plano ({@link isPlanError} é
 * `true`).
 */
export function isFreeNumberCap(error: unknown): error is BotoZapError {
  return error instanceof BotoZapError && error.code === "free_number_cap";
}

/**
 * True quando a API recusou registrar um aceite porque o contato recusou
 * mensagens (409 `consent_opted_out`, em `contacts.recordConsent`). Nada foi
 * gravado e repetir não adianta: só o próprio contato volta a aceitar (botão do
 * pedido de consentimento ou Palavra de volta cadastrada pelo Cliente).
 */
export function isConsentOptedOut(error: unknown): error is BotoZapError {
  return error instanceof BotoZapError && error.code === "consent_opted_out";
}

/**
 * True quando o envio de um template de marketing foi recusado porque o
 * contato recusou marketing (422 `consent_revoked`), sem enviar. Vale também
 * para quem recusou por outro número da mesma Conta. `consent_basis` não desfaz
 * a recusa; só o contato volta a aceitar.
 */
export function isConsentRevoked(error: unknown): error is BotoZapError {
  return error instanceof BotoZapError && error.code === "consent_revoked";
}

/**
 * True quando a API recusou porque o número está desconectado ou sem token de
 * acesso (409 `not_connected`): envio, mídia, pedido de consentimento, transmissão ou template.
 * Reconecte o número em Canais; repetir antes disso não adianta.
 */
export function isNotConnected(error: unknown): error is BotoZapError {
  return error instanceof BotoZapError && error.code === "not_connected";
}
