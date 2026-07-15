/**
 * Integração leve CLI ⇄ SDK contra um servidor HTTP efêmero (node:http, porta 0).
 *
 * Verifica que a CLI propaga fielmente os erros que o SDK deriva da resposta:
 *   - 401 estruturado → BotoZapError, e a apiKey nunca aparece no erro/saída;
 *   - 200 sem envelope de cursor → malformed_response (contrato do SDK);
 *   - conexão recusada → network_error (status 0).
 */
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { BotoZapError } from "../src/client.js";
import { registerMessages } from "../src/commands/messages.js";
import { run } from "./helpers.js";

let server: Server;
let baseUrl: string;
let responder: () => { status: number; json: unknown } = () => ({
  status: 200,
  json: { data: [], paging: { cursors: { before: null, after: null }, next: null, previous: null } },
});

beforeAll(async () => {
  server = createServer((_req, res) => {
    const out = responder();
    res.writeHead(out.status, { "content-type": "application/json" });
    res.end(JSON.stringify(out.json));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("sem porta");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

const ORIGINAL_HOME = process.env.HOME;
let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "botozap-cli-int-"));
  process.env.HOME = home;
  delete process.env.BOTOZAP_API_KEY;
  delete process.env.BOTOZAP_API_URL;
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  if (ORIGINAL_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = ORIGINAL_HOME;
});

describe("401 estruturado", () => {
  it("vira BotoZapError e a apiKey não vaza no erro nem na saída", async () => {
    const secret = "bz_live_SECRETdoNotLeak";
    responder = () => ({
      status: 401,
      json: {
        error: {
          code: "authentication_error",
          message: "Chave de API inválida ou expirada.",
        },
      },
    });
    const { stdout, error } = await run(registerMessages, [
      "messages",
      "get",
      "msg_1",
      "--api-url",
      baseUrl,
      "--api-key",
      secret,
    ]);
    expect(error).toBeInstanceOf(BotoZapError);
    const err = error as BotoZapError;
    expect(err.code).toBe("authentication_error");
    expect(err.status).toBe(401);
    expect(`Erro [${err.code}]: ${err.message}`).not.toContain(secret);
    expect(stdout).not.toContain(secret);
  });
});

describe("200 sem envelope → malformed_response", () => {
  it("`messages list` recebendo {} lança malformed_response", async () => {
    responder = () => ({ status: 200, json: {} });
    const { error } = await run(registerMessages, [
      "messages",
      "list",
      "--api-url",
      baseUrl,
      "--api-key",
      "bz_live_test",
    ]);
    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).code).toBe("malformed_response");
    expect((error as BotoZapError).status).toBe(0);
  });
});

describe("conexão recusada → network_error", () => {
  it("aponta para porta fechada e recebe network_error (status 0)", async () => {
    const { error } = await run(registerMessages, [
      "messages",
      "list",
      "--api-url",
      "http://127.0.0.1:1",
      "--api-key",
      "bz_live_test",
    ]);
    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).code).toBe("network_error");
    expect((error as BotoZapError).status).toBe(0);
  });
});
