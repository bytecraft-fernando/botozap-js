import { createServer } from "node:http";
import { verifyBotoZapSignature } from "./signature.mjs";

const MAX_BODY_BYTES = 1024 * 1024;

async function readRawBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("payload_too_large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export function createEndpointServer({ secret, store }) {
  if (!secret) throw new Error("BOTOZAP_WEBHOOK_SECRET é obrigatório.");

  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/webhooks/botozap") {
      json(response, 404, { error: "not_found" });
      return;
    }

    let rawBody;
    try {
      rawBody = await readRawBody(request);
    } catch {
      json(response, 413, { error: "payload_too_large" });
      return;
    }

    const signature = request.headers["x-webhook-signature"];
    if (
      typeof signature !== "string" ||
      !verifyBotoZapSignature(rawBody, signature, secret)
    ) {
      json(response, 401, { error: "invalid_signature" });
      return;
    }

    const idempotencyKey = request.headers["x-idempotency-key"];
    const eventType = request.headers["x-webhook-event"];
    if (typeof idempotencyKey !== "string" || typeof eventType !== "string") {
      json(response, 400, { error: "missing_event_headers" });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      json(response, 400, { error: "invalid_json" });
      return;
    }

    try {
      const result = await store.enqueue({ idempotencyKey, eventType, payload });
      json(
        response,
        result.inserted ? 202 : 200,
        result.inserted ? { accepted: true } : { accepted: true, duplicate: true },
      );
    } catch {
      // Sem ACK: o BotoZap mantém a Entrega e tenta novamente.
      json(response, 503, { error: "enqueue_unavailable" });
    }
  });
}
