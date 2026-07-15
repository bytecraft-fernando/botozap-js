/**
 * Contract tests das CORREÇÕES e ADIÇÕES da migração E3.2 (Teammate A).
 *
 * Mesmo padrão de `contract.test.ts`: servidor HTTP efêmero (node:http, porta 0)
 * que grava cada request e responde fixtures no formato REAL das rotas `/v1`.
 * Cada teste prova o REQUEST montado (método/path/query/body) E o RESPONSE
 * entregue ao chamador — falha se a rota ou o SDK divergirem do contrato.
 *
 * Cobre: broadcasts.create (body real), broadcasts.update, listRecipients status,
 * flows com phone_number_id, apiLogs filtros, messages.list, templates.create,
 * customers.update/delete, setup links (3), 429 com headers no BotoZapError e o
 * caso `data: null` explícito passando no requestItem.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import {
  BotoZap,
  BotoZapError,
  type CreateAssignmentParams,
} from "../src/index.js";

type CapturedRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  authorization: string | undefined;
  body: unknown;
  rawBody: string;
};

type MockResponse = {
  status?: number;
  json?: unknown;
  raw?: string;
  headers?: Record<string, string>;
};

const API_KEY = "bz_live_additions_test";

let server: Server;
let baseUrl: string;
let boto: BotoZap;

const captured: CapturedRequest[] = [];
let responder: (req: CapturedRequest) => MockResponse = () => ({
  status: 200,
  json: { data: null },
});

function lastRequest(): CapturedRequest {
  const r = captured.at(-1);
  if (!r) throw new Error("nenhum request capturado");
  return r;
}

function firstHeader(h: string | string[] | undefined): string | undefined {
  return Array.isArray(h) ? h[0] : h;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      captured.push({
        method: req.method ?? "",
        path: url.pathname,
        query,
        authorization: firstHeader(req.headers["authorization"]),
        body: raw ? JSON.parse(raw) : undefined,
        rawBody: raw,
      });

      const out = responder(captured.at(-1)!);
      const status = out.status ?? 200;
      const headers = { "content-type": "application/json", ...out.headers };
      if (out.json !== undefined) {
        res.writeHead(status, headers);
        res.end(JSON.stringify(out.json));
      } else if (out.raw !== undefined) {
        res.writeHead(status, out.headers);
        res.end(out.raw);
      } else {
        res.writeHead(status, out.headers);
        res.end();
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("sem porta");
  baseUrl = `http://127.0.0.1:${addr.port}`;
  boto = new BotoZap({ apiKey: API_KEY, baseUrl });
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

describe("SDK contract — correções E3.2", () => {
  it("conversations.createAssignment: envia user_id obrigatório, nunca member_id", async () => {
    expectTypeOf<CreateAssignmentParams>().toEqualTypeOf<{
      user_id: string;
      notes?: string;
    }>();
    responder = () => ({
      status: 201,
      json: { data: { id: "assign_1", user_id: "user_1", active: true } },
    });

    await boto.conversations.createAssignment("conv_1", {
      user_id: "user_1",
      notes: "Plantão",
    });

    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().path).toBe("/conversations/conv_1/assignments");
    expect(lastRequest().body).toEqual({ user_id: "user_1", notes: "Plantão" });
    expect(lastRequest().body).not.toHaveProperty("member_id");
  });
  it("broadcasts.create: body real {template_name, template_language, phone_number_id}; sem customer_id/template", async () => {
    responder = () => ({ status: 201, json: { data: { id: "bc_1", status: "draft" } } });

    const bc = await boto.broadcasts.create({
      name: "Promo de sexta",
      phone_number_id: "1279498075235551",
      template_name: "boas_vindas",
      template_language: "pt_BR",
    });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/broadcasts");
    expect(req.body).toEqual({
      name: "Promo de sexta",
      phone_number_id: "1279498075235551",
      template_name: "boas_vindas",
      template_language: "pt_BR",
    });
    const body = req.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("customer_id");
    expect(body).not.toHaveProperty("template");
    expect(bc).toEqual({ id: "bc_1", status: "draft" });
  });

  it("broadcasts.update: PATCH body {status:'stopped'}; desempacota data", async () => {
    responder = () => ({ status: 200, json: { data: { id: "bc_1", status: "stopped" } } });

    const bc = await boto.broadcasts.update("bc_1", { status: "stopped" });

    const req = lastRequest();
    expect(req.method).toBe("PATCH");
    expect(req.path).toBe("/broadcasts/bc_1");
    expect(req.body).toEqual({ status: "stopped" });
    expect(bc).toEqual({ id: "bc_1", status: "stopped" });
  });

  it("broadcasts.listRecipients: expõe filtro status na query", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "r_1", status: "failed" }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      },
    });

    const list = await boto.broadcasts.listRecipients("bc_1", { limit: 20, status: "failed" });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/broadcasts/bc_1/recipients");
    expect(req.query).toEqual({ limit: "20", status: "failed" });
    expect(list.data).toEqual([{ id: "r_1", status: "failed" }]);
  });

  it("flows.list: envia phone_number_id na query (a rota exige phone_number_id OU waba_connection_id)", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "flow_1", name: "onboarding", status: "published" }],
        meta: { page: 1, per_page: 20, total_pages: 1, total_count: 1 },
      },
    });

    const list = await boto.flows.list({
      page: 1,
      per_page: 20,
      phone_number_id: "1279498075235551",
    });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/flows");
    expect(req.query).toEqual({
      page: "1",
      per_page: "20",
      phone_number_id: "1279498075235551",
    });
    expect(list.data).toEqual([{ id: "flow_1", name: "onboarding", status: "published" }]);
    expect(list.meta.total_count).toBe(1);
  });

  it("flows.list: aceita waba_connection_id como alternativa na query", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [],
        meta: { page: 1, per_page: 20, total_pages: 0, total_count: 0 },
      },
    });

    await boto.flows.list({ waba_connection_id: "conn_1" });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/flows");
    expect(req.query).toEqual({ waba_connection_id: "conn_1" });
  });

  it("flows.get: exige phone_number_id na QUERY", async () => {
    responder = () => ({ status: 200, json: { data: { id: "flow_1", status: "draft" } } });

    const flow = await boto.flows.get("flow_1", { phone_number_id: "1279498075235551" });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/flows/flow_1");
    expect(req.query).toEqual({ phone_number_id: "1279498075235551" });
    expect(req.body).toBeUndefined();
    expect(flow).toEqual({ id: "flow_1", status: "draft" });
  });

  it("flows.delete: phone_number_id na QUERY; 204 → void", async () => {
    responder = () => ({ status: 204 });

    const result = await boto.flows.delete("flow_1", { phone_number_id: "1279498075235551" });

    const req = lastRequest();
    expect(req.method).toBe("DELETE");
    expect(req.path).toBe("/flows/flow_1");
    expect(req.query).toEqual({ phone_number_id: "1279498075235551" });
    expect(result).toBeUndefined();
  });

  it("flows.publish: phone_number_id no BODY", async () => {
    responder = () => ({ status: 200, json: { data: { id: "flow_1", status: "published" } } });

    await boto.flows.publish("flow_1", { phone_number_id: "1279498075235551" });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/flows/flow_1/publish");
    expect(req.body).toEqual({ phone_number_id: "1279498075235551" });
  });

  it("flows.setupEncryption: phone_number_id no BODY", async () => {
    responder = () => ({ status: 200, json: { data: { status: "success" } } });

    await boto.flows.setupEncryption("flow_1", { phone_number_id: "1279498075235551" });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/flows/flow_1/setup_encryption");
    expect(req.body).toEqual({ phone_number_id: "1279498075235551" });
  });

  it("flows.createVersion: body {phone_number_id, flow_json}", async () => {
    responder = () => ({ status: 201, json: { data: { id: "ver_1" } } });

    await boto.flows.createVersion("flow_1", {
      phone_number_id: "1279498075235551",
      flow_json: { version: "5.0" },
    });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/flows/flow_1/versions");
    expect(req.body).toEqual({
      phone_number_id: "1279498075235551",
      flow_json: { version: "5.0" },
    });
  });

  it("flows.setDataEndpoint: body {phone_number_id, forward_url}", async () => {
    responder = () => ({ status: 200, json: { data: { flow_id: "flow_1", has_data_endpoint: true } } });

    await boto.flows.setDataEndpoint("flow_1", {
      phone_number_id: "1279498075235551",
      forward_url: "https://dev.exemplo.com/flow",
    });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/flows/flow_1/data_endpoint");
    expect(req.body).toEqual({
      phone_number_id: "1279498075235551",
      forward_url: "https://dev.exemplo.com/flow",
    });
  });

  it("apiLogs.list: filtros reais source/method/status_code na query", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "log_1", method: "POST", status_code: 201 }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      },
    });

    const list = await boto.apiLogs.list({
      limit: 10,
      source: "api",
      method: "POST",
      status_code: 201,
    });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/api_logs");
    expect(req.query).toEqual({
      limit: "10",
      source: "api",
      method: "POST",
      status_code: "201",
    });
    expect(req.query).not.toHaveProperty("api_key_id");
    expect(req.query).not.toHaveProperty("status");
    expect(list.data).toEqual([{ id: "log_1", method: "POST", status_code: 201 }]);
  });

  it("messages.list: GET /messages com filtros cursor + has_media serializado", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "msg_1", direction: "inbound" }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      },
    });

    const list = await boto.messages.list({
      limit: 25,
      phone_number_id: "1279498075235551",
      conversation_id: "conv_1",
      direction: "inbound",
      status: "delivered",
      message_type: "image",
      has_media: true,
    });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/messages");
    expect(req.query).toEqual({
      limit: "25",
      phone_number_id: "1279498075235551",
      conversation_id: "conv_1",
      direction: "inbound",
      status: "delivered",
      message_type: "image",
      has_media: "true",
    });
    expect(list.data).toEqual([{ id: "msg_1", direction: "inbound" }]);
  });

  it("templates.list: GET /templates com filtros status/category/waba_connection_id/phone_number_id", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "tpl_1", name: "boas_vindas", status: "APPROVED" }],
        meta: { page: 1, per_page: 20, total_pages: 1, total_count: 1 },
      },
    });

    const list = await boto.templates.list({
      page: 1,
      per_page: 20,
      status: "APPROVED",
      category: "MARKETING",
      waba_connection_id: "conn_1",
      phone_number_id: "1279498075235551",
    });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/templates");
    expect(req.query).toEqual({
      page: "1",
      per_page: "20",
      status: "APPROVED",
      category: "MARKETING",
      waba_connection_id: "conn_1",
      phone_number_id: "1279498075235551",
    });
    expect(list.data).toEqual([{ id: "tpl_1", name: "boas_vindas", status: "APPROVED" }]);
    expect(list.meta.total_count).toBe(1);
  });

  it("webhookDeliveries.list: GET /webhook_deliveries com filtros webhook_id/status/event_type", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "wd_1", event_type: "messages", status: "success" }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      },
    });

    const list = await boto.webhookDeliveries.list({
      limit: 15,
      webhook_id: "wh_1",
      status: "success",
      event_type: "messages",
    });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/webhook_deliveries");
    expect(req.query).toEqual({
      limit: "15",
      webhook_id: "wh_1",
      status: "success",
      event_type: "messages",
    });
    expect(list.data).toEqual([{ id: "wd_1", event_type: "messages", status: "success" }]);
  });

  it("templates.create: POST /templates body {name,language,category,components}; desempacota data", async () => {
    responder = () => ({ status: 201, json: { data: { id: "tpl_1", name: "boas_vindas", status: "PENDING" } } });

    const tpl = await boto.templates.create({
      name: "boas_vindas",
      language: "pt_BR",
      category: "MARKETING",
      components: [{ type: "BODY", text: "Olá {{1}}" }],
      phone_number_id: "1279498075235551",
    });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/templates");
    expect(req.body).toEqual({
      name: "boas_vindas",
      language: "pt_BR",
      category: "MARKETING",
      components: [{ type: "BODY", text: "Olá {{1}}" }],
      phone_number_id: "1279498075235551",
    });
    expect(tpl).toEqual({ id: "tpl_1", name: "boas_vindas", status: "PENDING" });
  });

  it("customers.update: PATCH body {name, external_customer_id}; desempacota data", async () => {
    responder = () => ({
      status: 200,
      json: { data: { id: "cus_1", name: "Novo Nome", external_customer_id: "ext-9" } },
    });

    const cus = await boto.customers.update("cus_1", {
      name: "Novo Nome",
      external_customer_id: "ext-9",
    });

    const req = lastRequest();
    expect(req.method).toBe("PATCH");
    expect(req.path).toBe("/customers/cus_1");
    expect(req.body).toEqual({ name: "Novo Nome", external_customer_id: "ext-9" });
    expect(cus).toEqual({ id: "cus_1", name: "Novo Nome", external_customer_id: "ext-9" });
  });

  it("customers.delete: DELETE → 204 → void", async () => {
    responder = () => ({ status: 204 });

    const result = await boto.customers.delete("cus_1");

    const req = lastRequest();
    expect(req.method).toBe("DELETE");
    expect(req.path).toBe("/customers/cus_1");
    expect(req.rawBody).toBe("");
    expect(result).toBeUndefined();
  });

  it("customers.listSetupLinks: GET offset {data,meta}", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "lnk_1", url: "https://botozap.com.br/setup/abc" }],
        meta: { page: 1, per_page: 20, total_pages: 1, total_count: 1 },
      },
    });

    const list = await boto.customers.listSetupLinks("cus_1", { per_page: 20 });

    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/customers/cus_1/setup_links");
    expect(req.query).toEqual({ per_page: "20" });
    expect(list.data).toEqual([{ id: "lnk_1", url: "https://botozap.com.br/setup/abc" }]);
    expect(list.meta.total_count).toBe(1);
  });

  it("customers.createSetupLink: POST body; desempacota data", async () => {
    responder = () => ({
      status: 201,
      json: { data: { id: "lnk_2", status: "active", url: "https://botozap.com.br/setup/xyz" } },
    });

    const link = await boto.customers.createSetupLink("cus_1", {
      allowed_connection_types: ["dedicated"],
      provision_phone_number: true,
    });

    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/customers/cus_1/setup_links");
    expect(req.body).toEqual({
      allowed_connection_types: ["dedicated"],
      provision_phone_number: true,
    });
    expect(link.id).toBe("lnk_2");
  });

  it("customers.updateSetupLink: PATCH body {status}; desempacota data", async () => {
    responder = () => ({
      status: 200,
      json: { data: { id: "lnk_2", status: "revoked" } },
    });

    const link = await boto.customers.updateSetupLink("cus_1", "lnk_2", { status: "revoked" });

    const req = lastRequest();
    expect(req.method).toBe("PATCH");
    expect(req.path).toBe("/customers/cus_1/setup_links/lnk_2");
    expect(req.body).toEqual({ status: "revoked" });
    expect(link.status).toBe("revoked");
  });

  it("BotoZapError: 429 preserva headers da resposta (Retry-After / X-RateLimit-*)", async () => {
    responder = () => ({
      status: 429,
      headers: {
        "retry-after": "30",
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "0",
      },
      json: { error: { code: "rate_limited", message: "Muitas requisições." } },
    });

    const err = await boto.messages
      .send({ to: "+5531988887777", text: "oi" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(BotoZapError);
    expect((err as BotoZapError).status).toBe(429);
    expect((err as BotoZapError).code).toBe("rate_limited");
    const headers = (err as BotoZapError).headers;
    expect(headers).toBeDefined();
    expect(headers?.["retry-after"]).toBe("30");
    expect(headers?.["x-ratelimit-remaining"]).toBe("0");
    // NUNCA vaza credencial: nenhum header carrega a apiKey.
    expect(JSON.stringify(headers)).not.toContain(API_KEY);
  });

  it("requestItem: {data:null} EXPLÍCITO passa (a chave data existe) → resolve null", async () => {
    responder = () => ({ status: 200, json: { data: null } });

    const result = await boto.messages.get("msg_1");

    expect(result).toBeNull();
  });
});
