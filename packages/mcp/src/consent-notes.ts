/**
 * Textos curtos sobre consentimento e recusa para as descrições das tools do
 * catálogo completo. O perfil assistant não os recebe (ver `catalog-profile.ts`).
 */

/** Recusas de envio de template de marketing por recusa do contato. */
export const CONSENT_SEND_NOTE =
  "Template de marketing a quem recusou mensagens de marketing responde 422 consent_revoked, sem enviar (vale também para quem recusou por outro número da mesma Conta): só o próprio contato volta a aceitar, tocando no botão do pedido de consentimento (request_consent) ou mandando uma Palavra de volta que o Cliente cadastrou. 409 not_connected = número desconectado ou sem token (reconecte em Canais).";
