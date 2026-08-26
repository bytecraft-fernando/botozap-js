import { workerConfig } from "./config.mjs";
import { createWorkerRuntime, installShutdown } from "./runtime.mjs";

const runtime = await createWorkerRuntime(workerConfig());
console.log("[agent-endpoint] worker aguardando Eventos duráveis");

installShutdown(async () => {
  await runtime.worker.stop();
  await runtime.store.close();
});
