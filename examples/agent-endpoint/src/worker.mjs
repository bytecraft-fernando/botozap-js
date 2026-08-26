const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const WINDOW_SAFETY_MS = 60 * 1000;

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseInboundJob(job) {
  const payload = job.payload;
  if (
    job.event_type !== "whatsapp.message.received" ||
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const message = payload.message;
  const contact = payload.contact;
  if (!message || typeof message !== "object" || !contact || typeof contact !== "object") {
    return null;
  }

  const text = nonEmpty(message.text?.body);
  const to =
    nonEmpty(contact.phone) ??
    nonEmpty(contact.user_id) ??
    nonEmpty(contact.wa_id);
  const from = nonEmpty(payload.phone_number_id);
  if (!text || !to || !from) return null;

  return { text, to, from, timestamp: nonEmpty(message.timestamp), payload };
}

export function isFreeformWindowOpen(timestamp, now = Date.now()) {
  const sentAt = Number(timestamp) * 1000;
  const age = now - sentAt;
  return (
    Number.isFinite(sentAt) &&
    age >= 0 &&
    age < SESSION_WINDOW_MS - WINDOW_SAFETY_MS
  );
}

function errorCode(error) {
  if (error && typeof error === "object" && typeof error.code === "string") {
    return error.code.slice(0, 80);
  }
  return "agent_error";
}

export function createAgentWorker({ store, agent, messenger, now = () => Date.now() }) {
  let activeDrain = null;
  let stopListening = null;
  let retryTimer = null;
  let scheduledWakeAt = null;

  function reportDrainFailure() {
    console.error("[agent-endpoint] falha ao drenar fila após notificação");
  }

  function scheduleWake(wakeAt) {
    const at = new Date(wakeAt).getTime();
    if (!Number.isFinite(at)) return;
    if (retryTimer && scheduledWakeAt <= at) return;
    if (retryTimer) clearTimeout(retryTimer);
    scheduledWakeAt = at;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      scheduledWakeAt = null;
      void worker.drain().catch(reportDrainFailure);
    }, Math.max(0, at - Date.now() + 5));
    retryTimer.unref?.();
  }

  async function runDrain() {
    for (;;) {
      const job = await store.claimNext();
      if (!job) {
        const wakeAt = await store.nextWakeAt();
        if (wakeAt) scheduleWake(wakeAt);
        return;
      }

      const inbound = parseInboundJob(job);
      if (!inbound) {
        await store.ignore(job.id, "unsupported_event");
        continue;
      }

      let reply;
      try {
        reply = nonEmpty(await agent({
          text: inbound.text,
          event: inbound.payload,
        }));
        if (!reply) throw Object.assign(new Error("empty_agent_reply"), { code: "empty_agent_reply" });
      } catch (error) {
        await store.failProcessing(job.id, errorCode(error));
        continue;
      }

      const sendInput = {
        to: inbound.to,
        from: inbound.from,
        text: reply,
        freeformAllowed: isFreeformWindowOpen(inbound.timestamp, now()),
      };

      // A transição para `sending` acontece ANTES do I/O. Jobs nesse estado
      // nunca são retomados automaticamente: uma queda deixa resultado ambíguo,
      // mas não duplica a resposta ao Contato.
      await store.markSending(job.id, sendInput);
      try {
        const result = await messenger.sendResponse(sendInput);
        await store.complete(job.id, result.wamid);
      } catch (error) {
        const code = errorCode(error);
        const status = error && typeof error === "object" ? error.status : null;
        const definitelyNotSent = Number.isInteger(status) && status >= 400 && status < 500;
        await store.failSending(
          job.id,
          definitelyNotSent ? "failed" : "ambiguous",
          code,
        );
      }
    }
  }

  const worker = {
    drain() {
      if (activeDrain) return activeDrain;
      activeDrain = runDrain().finally(() => {
        activeDrain = null;
      });
      return activeDrain;
    },
    async start() {
      if (stopListening) return;
      stopListening = await store.listen(
        () => {
          void worker.drain().catch(reportDrainFailure);
        },
        () => {
          console.error("[agent-endpoint] listener PostgreSQL desconectado; reinicie o worker");
        },
      );
      // LISTEN primeiro, catch-up durável depois: nenhum intervalo entre scan
      // inicial e live tail pode se perder.
      await worker.drain();
    },
    async stop() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
        scheduledWakeAt = null;
      }
      if (!stopListening) return;
      const stop = stopListening;
      stopListening = null;
      await stop();
      if (activeDrain) await activeDrain;
    },
  };

  return worker;
}
