import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida `X-Webhook-Signature`: HMAC-SHA256 hex sobre os bytes crus.
 * A assinatura de Endpoint do BotoZap não usa o prefixo `sha256=`.
 */
export function verifyBotoZapSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !secret) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const receivedBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}
