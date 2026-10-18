/**
 * Textos curtos sobre os tetos do plano Free (1 negócio e 1 número) para as
 * descrições das tools do catálogo completo. O perfil assistant não recebe
 * estes textos (ver `catalog-profile.ts`).
 */

/** Recusas de envio por recurso suspenso no Free (e negócio pausado por fatura). */
export const FREE_SEND_NOTE =
  "Recusas por Cliente ou Número suspenso no plano Free (o recurso continua recebendo, mas não envia; repetir não adianta): 402 free_number_cap = Número acima do teto de 1 número (assine ou desconecte o outro número); 402 free_cap = Cliente acima do teto de 1 negócio (assine ou apague o outro Cliente). 402 business_payment_required = negócio pausado por fatura de slot vencida (pague a fatura).";

/** Leitura de Clientes com `plan_suspended`. */
export const FREE_CUSTOMER_NOTE =
  "No plano Free (1 negócio), `plan_suspended: true` marca o Cliente acima do teto: continua recebendo, mas não conecta canais nem envia (402 free_cap). Para liberar, assine ou apague o outro Cliente.";

/** Leitura de Números com `plan_suspended`. */
export const FREE_NUMBER_NOTE =
  "No plano Free (1 número), `plan_suspended: true` marca o Número (ou o Cliente dele) acima do teto: continua recebendo, mas não envia (402 free_number_cap ou free_cap). Para liberar, assine ou desconecte o outro número.";
