import { endpointConfig, workerConfig } from "./config.mjs";
import {
  createWorkerRuntime,
  installShutdown,
  startEndpointRuntime,
} from "./runtime.mjs";

const endpoint = endpointConfig();
const workerSettings = workerConfig();
const endpointRuntime = await startEndpointRuntime(endpoint);
const workerRuntime = await createWorkerRuntime(workerSettings);
console.log(`[agent-endpoint] ouvindo na porta ${endpoint.port}`);

installShutdown(async () => {
  await workerRuntime.worker.stop();
  await Promise.all([endpointRuntime.stop(), workerRuntime.store.close()]);
});
