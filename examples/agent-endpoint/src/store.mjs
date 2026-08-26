import { readFile } from "node:fs/promises";
import pg from "pg";

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

function safeIdentifier(value, label) {
  if (!IDENTIFIER.test(value)) {
    throw new Error(`${label} precisa ser um identificador PostgreSQL simples.`);
  }
  return value;
}

export class PostgresJobStore {
  #pool;
  #ownsPool;
  #tableName;
  #channelName;
  #generationRetryMs;

  constructor({
    connectionString,
    pool,
    tableName = "agent_jobs",
    channelName = "botozap_agent_jobs",
    generationRetryMs = 5_000,
  }) {
    this.#tableName = safeIdentifier(tableName, "tableName");
    this.#channelName = safeIdentifier(channelName, "channelName");
    if (!Number.isInteger(generationRetryMs) || generationRetryMs < 1) {
      throw new Error("generationRetryMs precisa ser um inteiro positivo.");
    }
    this.#generationRetryMs = generationRetryMs;
    this.#ownsPool = !pool;
    this.#pool = pool ?? new pg.Pool({ connectionString });
    this.#pool.on("error", () => {
      // O próximo uso falha de forma explícita; nunca inclua a connection string no log.
      console.error("[agent-endpoint] conexão PostgreSQL ociosa falhou");
    });
  }

  async migrate() {
    const template = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
    const sql = template
      .replaceAll("__AGENT_JOBS_TABLE__", this.#tableName)
      .replaceAll("__AGENT_JOBS_INDEX__", `${this.#tableName}_state_idx`);
    await this.#pool.query(sql);
  }

  async enqueue({ idempotencyKey, eventType, payload }) {
    const client = await this.#pool.connect();
    try {
      await client.query("begin");
      const inserted = await client.query(
        `insert into ${this.#tableName} (idempotency_key, event_type, payload)
         values ($1, $2, $3::jsonb)
         on conflict (idempotency_key) do nothing
         returning id`,
        [idempotencyKey, eventType, JSON.stringify(payload)],
      );

      let id = inserted.rows[0]?.id;
      if (id) {
        await client.query("select pg_notify($1, $2)", [
          this.#channelName,
          String(id),
        ]);
      } else {
        const existing = await client.query(
          `select id from ${this.#tableName} where idempotency_key = $1`,
          [idempotencyKey],
        );
        id = existing.rows[0].id;
      }

      await client.query("commit");
      return { inserted: inserted.rowCount === 1, id: String(id) };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByIdempotencyKey(idempotencyKey) {
    const result = await this.#pool.query(
      `select * from ${this.#tableName} where idempotency_key = $1`,
      [idempotencyKey],
    );
    return result.rows[0] ?? null;
  }

  async claimNext() {
    const result = await this.#pool.query(
      `with candidate as (
         select id
         from ${this.#tableName}
         where (
           state = 'queued' and available_at <= now()
         ) or (
           state = 'processing'
           and processing_started_at < now() - interval '5 minutes'
         )
         order by id
         for update skip locked
         limit 1
       )
       update ${this.#tableName} as job
       set state = 'processing',
           attempts = attempts + 1,
           processing_started_at = now(),
           updated_at = now()
       from candidate
       where job.id = candidate.id
       returning job.*`,
    );
    return result.rows[0] ?? null;
  }

  async markSending(id, responsePlan) {
    const result = await this.#pool.query(
      `update ${this.#tableName}
       set state = 'sending', response_plan = $2::jsonb, updated_at = now()
       where id = $1 and state = 'processing'
       returning id`,
      [id, JSON.stringify(responsePlan)],
    );
    if (result.rowCount !== 1) throw new Error("job_state_conflict");
  }

  async complete(id, outboundWamid) {
    const result = await this.#pool.query(
      `update ${this.#tableName}
       set state = 'completed', outbound_wamid = $2, updated_at = now()
       where id = $1 and state = 'sending'
       returning id`,
      [id, outboundWamid],
    );
    if (result.rowCount !== 1) throw new Error("job_state_conflict");
  }

  async ignore(id, reason) {
    await this.#pool.query(
      `update ${this.#tableName}
       set state = 'ignored', error_code = $2, updated_at = now()
       where id = $1 and state = 'processing'`,
      [id, reason],
    );
  }

  async failProcessing(id, code) {
    const retryAt = new Date(Date.now() + this.#generationRetryMs).toISOString();
    const result = await this.#pool.query(
      `update ${this.#tableName}
       set state = case when attempts >= 3 then 'failed' else 'queued' end,
           available_at = $3,
           processing_started_at = null,
           error_code = $2,
           updated_at = now()
       where id = $1 and state = 'processing'
       returning state, available_at`,
      [id, code, retryAt],
    );
    return result.rows[0] ?? null;
  }

  async failSending(id, state, code) {
    if (state !== "failed" && state !== "ambiguous") {
      throw new Error("estado terminal inválido");
    }
    await this.#pool.query(
      `update ${this.#tableName}
       set state = $2, error_code = $3, updated_at = now()
       where id = $1 and state = 'sending'`,
      [id, state, code],
    );
  }

  async listen(onWake, onError = () => {}) {
    const client = await this.#pool.connect();
    const handleNotification = (message) => {
      if (message.channel === this.#channelName) onWake();
    };
    const handleError = () => onError(new Error("postgres_listener_disconnected"));
    client.on("notification", handleNotification);
    client.on("error", handleError);

    try {
      await client.query(`listen ${this.#channelName}`);
    } catch (error) {
      client.off("notification", handleNotification);
      client.off("error", handleError);
      client.release(true);
      throw error;
    }

    return async () => {
      client.off("notification", handleNotification);
      client.off("error", handleError);
      try {
        await client.query(`unlisten ${this.#channelName}`);
        client.release();
      } catch {
        client.release(true);
      }
    };
  }

  async nextWakeAt() {
    const result = await this.#pool.query(
      `select min(wake_at) as wake_at
       from (
         select available_at as wake_at
         from ${this.#tableName}
         where state = 'queued'
         union all
         select processing_started_at + interval '5 minutes' as wake_at
         from ${this.#tableName}
         where state = 'processing' and processing_started_at is not null
       ) pending`,
    );
    return result.rows[0]?.wake_at ?? null;
  }

  async close() {
    if (this.#ownsPool) await this.#pool.end();
  }
}
