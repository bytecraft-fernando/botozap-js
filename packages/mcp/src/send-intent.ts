/** A send intent is created before the side effect, so host retries retain its key. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Register } from "./register.js";

export const sendIntentKey = z.string().min(8).max(200).regex(/^[!-~]+$/)
  .describe("Opcional para compatibilidade. Recomendado: chave obtida em prepare_send_intent ou stage_review_reply. Reutilize em retries da mesma intenção; nunca gere outra após timeout. Recusa confirmada (outcome=rejected) libera a chave para repetir após backoff/correção. Nova intenção explícita recebe nova chave.");

export function registerSendIntent(register: Register): void {
  register("prepare_send_intent",
    "Gera uma chave para uma nova intenção de envio autorizada pelo usuário, sem enviar. Passe a chave para send_message, send_media_message ou reply_to_conversation e preserve-a em todo retry. Não crie outra chave para resolver timeout ou envio pendente.",
    {}, z.object({ idempotency_key: z.string().uuid() }).strict(),
    async () => ({ idempotency_key: randomUUID() }));
}
