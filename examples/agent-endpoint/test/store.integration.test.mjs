import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { PostgresJobStore } from "../src/store.mjs";
import { createAgentWorker } from "../src/worker.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

describe("fila durável PostgreSQL", { skip: !connectionString }, () => {
  const tableName = `agent_jobs_test_${randomUUID().replaceAll("-", "")}`;
  const channelName = `agent_jobs_test_${process.pid}`;
  let pool;
  let store;

  before(async () => {
    pool = new pg.Pool({ connectionString });
    store = new PostgresJobStore({ pool, tableName, channelName });
    await store.migrate();
  });

  after(async () => {
    await pool.query(`drop table if exists ${tableName}`);
    await pool.end();
  });

  it("deduplica retries pela chave estável sem criar um segundo job", async () => {
    const event = {
      idempotencyKey: "wamid.retry-1",
      eventType: "whatsapp.message.received",
      payload: { event: "whatsapp.message.received" },
    };

    const first = await store.enqueue(event);
    const retry = await store.enqueue(event);
    const persisted = await store.findByIdempotencyKey(event.idempotencyKey);

    assert.equal(first.inserted, true);
    assert.equal(retry.inserted, false);
    assert.equal(retry.id, first.id);
    assert.equal(persisted.id, first.id);
    assert.equal(persisted.state, "queued");
  });

  it("processa retries do mesmo Evento com no máximo uma mensagem outbound", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const event = {
      idempotencyKey: "wamid.retry-worker-1",
      eventType: "whatsapp.message.received",
      payload: {
        event: "whatsapp.message.received",
        phone_number_id: "123456789",
        message: {
          id: "wamid.retry-worker-1",
          type: "text",
          timestamp,
          text: { body: "Onde está meu pedido?" },
        },
        contact: { phone: "5511988887777", wa_id: "5511988887777" },
      },
    };
    await Promise.all([store.enqueue(event), store.enqueue(event)]);

    let agentRuns = 0;
    const outbound = [];
    const worker = createAgentWorker({
      store,
      agent: async () => {
        agentRuns += 1;
        return "Seu pedido já saiu para entrega.";
      },
      messenger: {
        async sendResponse(input) {
          outbound.push(input);
          return { mode: "text", wamid: "wamid.outbound-1" };
        },
      },
    });

    await worker.drain();
    const persisted = await store.findByIdempotencyKey(event.idempotencyKey);

    assert.equal(agentRuns, 1);
    assert.equal(outbound.length, 1);
    assert.deepEqual(outbound[0], {
      to: "5511988887777",
      from: "123456789",
      text: "Seu pedido já saiu para entrega.",
      freeformAllowed: true,
    });
    assert.equal(persisted.state, "completed");
    assert.equal(persisted.outbound_wamid, "wamid.outbound-1");
  });

  it("acorda o worker por LISTEN/NOTIFY e responde sem polling", async () => {
    let notifyOutbound;
    const outbound = new Promise((resolve) => {
      notifyOutbound = resolve;
    });
    const worker = createAgentWorker({
      store,
      agent: async () => "Resposta orientada a Evento.",
      messenger: {
        async sendResponse() {
          notifyOutbound();
          return { mode: "text", wamid: "wamid.outbound-notify" };
        },
      },
    });
    await worker.start();

    const idempotencyKey = "wamid.notify-1";
    try {
      await store.enqueue({
        idempotencyKey,
        eventType: "whatsapp.message.received",
        payload: {
          event: "whatsapp.message.received",
          phone_number_id: "123456789",
          message: {
            id: idempotencyKey,
            type: "text",
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: "Olá" },
          },
          contact: { phone: "5511988887777" },
        },
      });

      await Promise.race([
        outbound,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("worker não acordou")), 1_000),
        ),
      ]);
      await worker.drain();
      const persisted = await store.findByIdempotencyKey(idempotencyKey);
      assert.equal(persisted.state, "completed");
    } finally {
      await worker.stop();
    }
  });

  it("reagenda uma falha transitória do agente sem polling da fila", async () => {
    const retryStore = new PostgresJobStore({
      pool,
      tableName,
      channelName,
      generationRetryMs: 10,
    });
    let agentRuns = 0;
    let notifyOutbound;
    const outbound = new Promise((resolve) => {
      notifyOutbound = resolve;
    });
    const worker = createAgentWorker({
      store: retryStore,
      agent: async () => {
        agentRuns += 1;
        if (agentRuns === 1) {
          throw Object.assign(new Error("indisponível"), { code: "agent_busy" });
        }
        return "Resposta após retry.";
      },
      messenger: {
        async sendResponse() {
          notifyOutbound();
          return { mode: "text", wamid: "wamid.outbound-retry" };
        },
      },
    });
    await worker.start();

    const idempotencyKey = "wamid.agent-retry-1";
    try {
      await retryStore.enqueue({
        idempotencyKey,
        eventType: "whatsapp.message.received",
        payload: {
          event: "whatsapp.message.received",
          phone_number_id: "123456789",
          message: {
            id: idempotencyKey,
            type: "text",
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: "Tente de novo" },
          },
          contact: { phone: "5511988887777" },
        },
      });

      await Promise.race([
        outbound,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("retry não acordou")), 1_000),
        ),
      ]);
      await worker.drain();
      const persisted = await retryStore.findByIdempotencyKey(idempotencyKey);
      assert.equal(agentRuns, 2);
      assert.equal(persisted.state, "completed");
      assert.equal(persisted.attempts, 2);
    } finally {
      await worker.stop();
    }
  });

  it("move falha terminal para a DLQ e permite replay seguro sem duplicar outbound", async () => {
    const dlqStore = new PostgresJobStore({
      pool,
      tableName,
      channelName,
      generationRetryMs: 10,
    });
    let agentRuns = 0;
    let notifyThirdAttempt;
    const thirdAttempt = new Promise((resolve) => {
      notifyThirdAttempt = resolve;
    });
    let notifyOutbound;
    const outbound = new Promise((resolve) => {
      notifyOutbound = resolve;
    });
    let outboundCount = 0;
    const worker = createAgentWorker({
      store: dlqStore,
      agent: async () => {
        agentRuns += 1;
        if (agentRuns <= 3) {
          if (agentRuns === 3) notifyThirdAttempt();
          throw Object.assign(new Error("indisponível"), { code: "agent_busy" });
        }
        return "Resposta após replay.";
      },
      messenger: {
        async sendResponse() {
          outboundCount += 1;
          notifyOutbound();
          return { mode: "text", wamid: "wamid.outbound-dlq" };
        },
      },
    });
    await worker.start();

    const idempotencyKey = "wamid.agent-dlq-1";
    try {
      await dlqStore.enqueue({
        idempotencyKey,
        eventType: "whatsapp.message.received",
        payload: {
          event: "whatsapp.message.received",
          phone_number_id: "123456789",
          message: {
            id: idempotencyKey,
            type: "text",
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: "Preciso de ajuda" },
          },
          contact: { phone: "5511988887777" },
        },
      });

      await thirdAttempt;
      await worker.drain();
      const failed = await dlqStore.findByIdempotencyKey(idempotencyKey);
      assert.equal(failed.state, "failed");
      assert.equal(failed.attempts, 3);
      assert.equal(outboundCount, 0);

      const replayed = await dlqStore.replayFailed(failed.id);
      assert.equal(replayed, true);
      await Promise.race([
        outbound,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("replay não acordou")), 1_000),
        ),
      ]);
      await worker.drain();

      const completed = await dlqStore.findByIdempotencyKey(idempotencyKey);
      assert.equal(completed.state, "completed");
      assert.equal(completed.attempts, 1);
      assert.equal(outboundCount, 1);
      assert.equal(await dlqStore.replayFailed(completed.id), false);
    } finally {
      await worker.stop();
    }
  });
});
