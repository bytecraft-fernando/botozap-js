/**
 * Receptor de webhooks do BotoZap — porta fiel do snippet contratado
 * (`src/lib/api-examples/receiver.ts` do core, validado nos contract tests
 * contra assinaturas reais). Os quatro pontos onde receptores erram:
 *
 *   1. bytes CRUS do corpo (nunca reserializar o JSON — mudaria
 *      espaçamento/ordem de chaves e invalidaria o HMAC);
 *   2. a assinatura com data: `X-Webhook-Signature-V2` = HMAC-SHA256 hex de
 *      `<X-Webhook-Timestamp>.<X-Idempotency-Key>.<corpo cru>`, comparação constant-time (sem
 *      prefixo `sha256=`), e o timestamp a no máximo 5 minutos do relógio do
 *      receptor (uma entrega capturada não serve depois). A
 *      `X-Webhook-Signature`, só do corpo, segue indo para quem já valida;
 *   3. dedupe PERSISTENTE por `X-Idempotency-Key`, gravando a chave E o
 *      efeito na MESMA transação (o BotoZap reentrega em timeout/erro) —
 *      nunca check-then-act;
 *   4. responder 2xx SÓ depois de persistir o efeito — 2xx é o único ACK;
 *      fora disso (ou timeout) = nova tentativa automática (at-least-once).
 */
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_SECRET = process.env.BOTOZAP_WEBHOOK_SECRET; // whsec_... (tela Webhooks)

// Entrega com o timestamp a mais de 5 minutos do seu relógio é recusada: uma
// entrega capturada não serve depois. Mantenha o relógio sincronizado (NTP).
const TOLERANCE_SECONDS = 300;

/**
 * Verifica a assinatura com data do BotoZap (headers X-Webhook-Timestamp,
 * X-Idempotency-Key e X-Webhook-Signature-V2): HMAC-SHA256 hex de
 * "<timestamp>.<idempotency key>.<corpo cru>". Assinar a chave impede reenviar
 * a entrega capturada com outra chave para escapar do dedupe.
 * IMPORTANTE: calcule o HMAC sobre os BYTES CRUS do corpo — nunca sobre
 * JSON.stringify(JSON.parse(rawBody)), que pode reordenar chaves ou mudar
 * espaçamento e invalidar a assinatura.
 */
export function verifyBotozapSignature(rawBody, headers, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const { timestamp, idempotencyKey, signature } = headers;
  if (!timestamp || !idempotencyKey || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + idempotencyKey + ".").update(rawBody).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Processe o efeito E registre a X-Idempotency-Key NA MESMA TRANSAÇÃO. Um Set
 * em memória não serve, e inserir só a chave antes do efeito também é
 * incorreto: se o processo cair no meio, o retry parecerá uma duplicata e o
 * efeito será perdido. O padrão relacional é:
 *
 *   BEGIN;
 *   INSERT INTO processed_webhooks (idempotency_key) VALUES ($1)
 *     ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key;
 *   -- se inseriu: aplique aqui as escritas do evento, na MESMA transação
 *   COMMIT;
 *
 * Em conflito, retorne "duplicate" sem repetir o efeito. Em crash antes do
 * COMMIT, banco reverte chave+efeito juntos e o retry pode processar de novo.
 */
async function processEventOnce(idempotencyKey, event) {
  throw new Error(
    "implemente uma transação única para idempotencyKey + escritas do evento",
  );
}

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const rawBody = Buffer.concat(chunks); // bytes CRUS — nunca reserializar

    const header = (name) => {
      const value = req.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const signed = {
      timestamp: header("x-webhook-timestamp"),
      idempotencyKey: header("x-idempotency-key"),
      signature: header("x-webhook-signature-v2"),
    };
    if (!verifyBotozapSignature(rawBody, signed, WEBHOOK_SECRET)) {
      res.writeHead(401).end();
      return;
    }

    const idempotencyHeader = req.headers["x-idempotency-key"];
    const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
    if (!idempotencyKey) {
      res.writeHead(400).end();
      return;
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    // Chave + efeito são commitados juntos. Só depois responda: 2xx é o único
    // ACK; fora de 2xx OU timeout = nova tentativa automática.
    await processEventOnce(idempotencyKey, event);

    res.writeHead(200).end();
  });
});

server.listen(process.env.PORT ?? 3001);
