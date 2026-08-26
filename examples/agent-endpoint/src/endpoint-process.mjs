import { once } from "node:events";
import { endpointConfig } from "./config.mjs";
import { createEndpointServer } from "./endpoint.mjs";
import { createEndpointRuntime, installShutdown } from "./runtime.mjs";

const config = endpointConfig();
const runtime = await createEndpointRuntime(config);
const server = createEndpointServer({
  secret: config.webhookSecret,
  store: runtime.store,
});
server.listen(config.port, "0.0.0.0");
await once(server, "listening");
console.log(`[agent-endpoint] Endpoint ouvindo na porta ${config.port}`);

installShutdown(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await runtime.store.close();
});
