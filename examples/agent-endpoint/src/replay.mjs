import { PostgresJobStore } from "./store.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
const jobId = process.argv[2]?.trim();

if (!databaseUrl) throw new Error("Defina DATABASE_URL.");
if (!jobId || !/^\d+$/.test(jobId)) {
  throw new Error("Uso: pnpm --filter example-agent-endpoint replay -- <job-id>");
}

const store = new PostgresJobStore({ connectionString: databaseUrl });
try {
  await store.migrate();
  const replayed = await store.replayFailed(jobId);
  if (!replayed) {
    console.error(`[agent-endpoint] job ${jobId} não existe ou não está em failed`);
    process.exitCode = 1;
  } else {
    console.log(`[agent-endpoint] job ${jobId} reenfileirado`);
  }
} finally {
  await store.close();
}
