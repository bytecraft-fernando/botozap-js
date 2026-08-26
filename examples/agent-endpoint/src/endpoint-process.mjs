import { endpointConfig } from "./config.mjs";
import { installShutdown, startEndpointRuntime } from "./runtime.mjs";

const config = endpointConfig();
const runtime = await startEndpointRuntime(config);
console.log(`[agent-endpoint] Endpoint ouvindo na porta ${config.port}`);

installShutdown(() => runtime.stop());
