/**
 * Contrato do SDK para headers.Authorization em webhooks.
 * O valor vai no body do POST/PATCH e NÃO é esperado na resposta.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import {
  BotoZap,
  type CreateWebhookParams,
  type UpdateWebhookParams,
} from "../src/index.js";

type CapturedRequest = {
  method: string;
  path: string;
  body: unknown;
};

const API_KEY = "bz_live_wh_auth";
const AUTH_VALUE = "Bearer test-sdk-wh-auth";

let server: Server;
let boto: BotoZap;
const captured: CapturedRequest[] = [];
let responder: () => { status?: number; json?: unknown } = () => ({
  status: 200,
  json: { data: null },
});

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      captured.push({
        method: req.method ?? "",
        path: url.pathname,
        body: raw ? JSON.parse(raw) : undefined,
      });
      const out = responder();
      const status = out.status ?? 200;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(out.json !== undefined ? JSON.stringify(out.json) : "");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("sem porta");
  boto = new BotoZap({ apiKey: API_KEY, baseUrl: `http://127.0.0.1:${addr.port}` });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(() => {
  captured.length = 0;
  responder = () => ({ status: 200, json: { data: null } });
});

describe("SDK — webhooks Authorization", () => {
  it("CreateWebhookParams/UpdateWebhookParams expõem o shape de headers", () => {
    expectTypeOf<CreateWebhookParams["headers"]>().toMatchTypeOf<
      { Authorization: string } | undefined
    >();
    expectTypeOf<UpdateWebhookParams["headers"]>().toMatchTypeOf<
      { Authorization?: string | null } | undefined
    >();
  });

  it("create envia headers.Authorization no body e não espera o valor na resposta", async () => {
    responder = () => ({
      status: 201,
      json: {
        data: {
          id: "wh_1",
          url: "https://hooks.example.test/boto",
          events: ["messages"],
          active: true,
          has_authorization: true,
          secret: "whsec_only_hmac",
          created_at: "2026-08-27T00:00:00.000Z",
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      },
    });

    const created = await boto.webhooks.create({
      url: "https://hooks.example.test/boto",
      events: ["messages"],
      headers: { Authorization: AUTH_VALUE },
    });

    expect(captured[0]?.method).toBe("POST");
    expect(captured[0]?.path).toBe("/webhooks");
    expect(captured[0]?.body).toEqual({
      url: "https://hooks.example.test/boto",
      events: ["messages"],
      headers: { Authorization: AUTH_VALUE },
    });
    expect(created.has_authorization).toBe(true);
    expect(JSON.stringify(created)).not.toContain(AUTH_VALUE);
  });

  it("update envia replace e clear explícitos", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: {
          id: "wh_1",
          url: "https://hooks.example.test/boto",
          events: ["messages"],
          active: true,
          has_authorization: false,
          created_at: "2026-08-27T00:00:00.000Z",
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      },
    });

    await boto.webhooks.update("wh_1", { headers: { Authorization: AUTH_VALUE } });
    expect(captured[0]?.body).toEqual({ headers: { Authorization: AUTH_VALUE } });

    captured.length = 0;
    await boto.webhooks.update("wh_1", { headers: { Authorization: null } });
    expect(captured[0]?.body).toEqual({ headers: { Authorization: null } });
  });
});
