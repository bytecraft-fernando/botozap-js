import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { afterEach, describe, it } from "node:test";
import { createEndpointServer } from "../src/endpoint.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise((resolve) => server.close(resolve)),
    ),
  );
});

async function startServer(store) {
  const server = createEndpointServer({
    secret: "whsec_teste_local",
    store,
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return `http://127.0.0.1:${address.port}/webhooks/botozap`;
}

function sign(rawBody) {
  return createHmac("sha256", "whsec_teste_local")
    .update(rawBody)
    .digest("hex");
}

describe("Endpoint HTTP", () => {
  it("rejeita assinatura inválida antes de persistir o Evento", async () => {
    let enqueueCalls = 0;
    const url = await startServer({
      async enqueue() {
        enqueueCalls += 1;
        return { inserted: true };
      },
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "0".repeat(64),
        "x-idempotency-key": "wamid.invalid",
        "x-webhook-event": "whatsapp.message.received",
      },
      body: '{"event":"whatsapp.message.received"}',
    });

    assert.equal(response.status, 401);
    assert.equal(enqueueCalls, 0);
  });

  it("só envia o ACK depois que o Evento cru foi enfileirado com durabilidade", async () => {
    const rawBody = Buffer.from(
      '{\n "event":"whatsapp.message.received", "message":{"id":"wamid.1"}\n}',
    );
    let releaseEnqueue;
    const persisted = new Promise((resolve) => {
      releaseEnqueue = resolve;
    });
    let notifyEnqueueStarted;
    const enqueueStarted = new Promise((resolve) => {
      notifyEnqueueStarted = resolve;
    });
    let receivedJob;
    const url = await startServer({
      async enqueue(job) {
        receivedJob = job;
        notifyEnqueueStarted();
        await persisted;
        return { inserted: true, id: "job-1" };
      },
    });

    let acknowledged = false;
    const responsePromise = fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": sign(rawBody),
        "x-idempotency-key": "wamid.1",
        "x-webhook-event": "whatsapp.message.received",
      },
      body: rawBody,
    }).then((response) => {
      acknowledged = true;
      return response;
    });

    await enqueueStarted;
    assert.equal(acknowledged, false);
    assert.deepEqual(receivedJob, {
      idempotencyKey: "wamid.1",
      eventType: "whatsapp.message.received",
      payload: {
        event: "whatsapp.message.received",
        message: { id: "wamid.1" },
      },
    });

    releaseEnqueue();
    const response = await responsePromise;
    assert.equal(response.status, 202);
  });
});
