/**
 * Textos das novidades de envio (out/2026) para as descrições das tools do
 * catálogo completo. O perfil assistant (app revisado do ChatGPT) não os
 * recebe nem ganha os campos novos (ver `catalog-profile.ts`).
 */

/** Responder citando (`reply_to`) no envio de mensagens. */
export const REPLY_TO_NOTE =
  "Responder citando: reply_to={ message_id } com o UUID interno ou o wamid/mid de uma mensagem da MESMA conversa (vale para text, template, interactive e location; reaction não aceita). A citada fora da conversa responde 422 reply_target_not_found; reação, mensagem apagada ou envio que não saiu, 422 reply_target_unavailable. O recibo traz reply_to { message_id, external_id }.";

/** Leitura de mensagens com os campos novos. */
export const MESSAGE_FIELDS_NOTE =
  "Cada mensagem traz reply_to (a citada: message_id, ou null fora do histórico, e external_id), played_at (mensagem de voz enviada que o contato ouviu; o status continua read) e transcription (áudio recebido já transcrito pela IA; null quando não há).";

/** Responder uma conversa citando uma mensagem dela. */
export const REPLY_CONVERSATION_NOTE =
  "reply_to_message_id (opcional) responde citando uma mensagem desta conversa: UUID interno ou wamid/mid da citada (422 reply_target_not_found fora da conversa; 422 reply_target_unavailable para reação, apagada ou envio que não saiu).";
