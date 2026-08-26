import { once } from "node:events";
import { BotoZap } from "@botozap/sdk";
import { createAgent } from "./agent.mjs";
import { createEndpointServer } from "./endpoint.mjs";
import { createBotoZapMessenger } from "./messenger.mjs";
import { PostgresJobStore } from "./store.mjs";
import { createAgentWorker } from "./worker.mjs";

export async function startEndpointRuntime(config) {
  const store = new PostgresJobStore({ connectionString: config.databaseUrl });
  await store.migrate();
  const server = createEndpointServer({
    secret: config.webhookSecret,
    store,
  });
  server.listen(config.port, "0.0.0.0");
  await once(server, "listening");

  return {
    async stop() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await store.close();
    },
  };
}

export async function createWorkerRuntime(config) {
  const store = new PostgresJobStore({ connectionString: config.databaseUrl });
  await store.migrate();
  const boto = new BotoZap({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  const worker = createAgentWorker({
    store,
    agent: createAgent({
      endpointUrl: config.agentEndpointUrl,
      bearerToken: config.agentBearerToken,
    }),
    messenger: createBotoZapMessenger({
      boto,
      fallbackTemplate: config.fallbackTemplate,
    }),
  });
  await worker.start();
  return { store, worker };
}

export function installShutdown(shutdown) {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await shutdown();
      process.exitCode = 0;
    } catch {
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
