import { once } from "node:events";
import { endpointConfig, workerConfig } from "./config.mjs";
import { createEndpointServer } from "./endpoint.mjs";
import {
  createEndpointRuntime,
  createWorkerRuntime,
  installShutdown,
} from "./runtime.mjs";

const endpoint = endpointConfig();
const workerSettings = workerConfig();
const endpointRuntime = await createEndpointRuntime(endpoint);
const workerRuntime = await createWorkerRuntime(workerSettings);
const server = createEndpointServer({
  secret: endpoint.webhookSecret,
  store: endpointRuntime.store,
});
server.listen(endpoint.port, "0.0.0.0");
await once(server, "listening");
console.log(`[agent-endpoint] ouvindo na porta ${endpoint.port}`);

installShutdown(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await workerRuntime.worker.stop();
  await Promise.all([
    endpointRuntime.store.close(),
    workerRuntime.store.close(),
  ]);
});
