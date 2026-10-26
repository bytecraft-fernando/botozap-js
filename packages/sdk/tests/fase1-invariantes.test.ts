/**
 * Invariantes do SDK (botozap#1010): `reply` responde pelo canal da conversa, o
 * erro carrega `outcome` e `retry` validados vindos da API, e endpoint de item
 * exige o envelope `data`. A API é um `node:http` local; o `fetch` é o de verdade.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { BotoZap, BotoZapError } from "../src/index.js";

type Call = { method: string; path: string; body: unknown };
type Reply = { status?: number; body?: string; headers?: Record<string, string> };

let server: Server;
let baseUrl: string;
let calls: Call[] = [];
let routes: Record<string, Reply> = {};

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    calls.push({ method: req.method ?? "", path, body: await readBody(req) });
    const reply = routes[`${req.method} ${path}`] ?? { status: 404, body: JSON.stringify({ error: { code: "not_found", message: "rota" } }) };
    res.writeHead(reply.status ?? 200, { "content-type": "application/json", ...reply.headers });
    res.end(reply.body ?? "");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  calls = [];
  routes = {};
});

const json = (value: unknown, status = 200, headers?: Record<string, string>): Reply => ({ status, body: JSON.stringify(value), headers });
const sdk = () => new BotoZap({ apiKey: "bz_live_fase1", baseUrl });
const sent = { id: "msg_1", wamid: "wamid.fase1", to: "5511988887777", status: "accepted" };

function conversation(data: Record<string, unknown>) {
  routes["GET /v1/conversations/cv_1"] = json({ data: { id: "cv_1", ...data } });
  routes["POST /v1/messages"] = json(sent, 201);
}

const posted = () => calls.filter((c) => c.method === "POST" && c.path === "/v1/messages").map((c) => c.body);

async function failure(promise: Promise<unknown>): Promise<BotoZapError> {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(BotoZapError);
  return error as BotoZapError;
}

// --- reply pelo canal da conversa ------------------------------------------

it("reply no WhatsApp sai pelo Número da conversa, mesmo com Conta de canal no payload", async () => {
  conversation({ channel: "whatsapp", phone_number_id: "pn_1", channel_account: { id: "ca_ig" }, contact: { wa_id: "5511988887777", phone: "+55 11 90000-0000" } });
  await expect(sdk().conversations.reply("cv_1", { text: "Oi" })).resolves.toEqual(sent);
  expect(posted()).toEqual([{ to: "5511988887777", type: "text", text: { body: "Oi" }, from: "pn_1" }]);
});

it("reply no Instagram sai pela Conta de canal, não pelo Número", async () => {
  conversation({ channel: "instagram", phone_number_id: "pn_1", channel_account: { id: "ca_ig" }, contact: { wa_id: "1789", phone: null } });
  await sdk().conversations.reply("cv_1", { text: "Oi", quick_replies: [{ title: "Sim" }], reply_to: { message_id: "mid.1" } } as never);
  expect(posted()).toEqual([{ to: "1789", type: "text", text: { body: "Oi" }, from: "ca_ig", quick_replies: [{ title: "Sim" }], reply_to: { message_id: "mid.1" } }]);
});

it("reply usa o telefone quando o wa_id falta ou é só espaço", async () => {
  conversation({ channel: "whatsapp", phone_number_id: "pn_1", contact: { wa_id: "   ", phone: "5511977776666" } });
  await sdk().conversations.reply("cv_1", { text: "Oi" });
  conversation({ channel: "whatsapp", phone_number_id: "pn_1", contact: { phone: "5511955554444" } });
  await sdk().conversations.reply("cv_1", { text: "Oi" });
  expect(posted().map((b) => (b as { to: string }).to)).toEqual(["5511977776666", "5511955554444"]);
});

it("reply sem destinatário utilizável recusa antes de enviar", async () => {
  for (const contact of [{ wa_id: " ", phone: "  " }, { wa_id: null, phone: null }, null]) {
    conversation({ channel: "whatsapp", phone_number_id: "pn_1", contact });
    const error = await failure(sdk().conversations.reply("cv_1", { text: "Oi" }));
    expect(error).toMatchObject({ code: "conversation_recipient_unavailable", status: 422, message: "Conversa sem destinatário utilizável no Contato." });
  }
  expect(posted()).toEqual([]);
});

it("reply sem origem do canal recusa antes de enviar, com a mensagem do canal", async () => {
  conversation({ channel: "whatsapp", phone_number_id: "  ", channel_account: { id: "ca_ig" }, contact: { wa_id: "5511988887777" } });
  expect(await failure(sdk().conversations.reply("cv_1", { text: "Oi" }))).toMatchObject({
    code: "malformed_response", status: 0, message: "Conversa sem UUID interno do Número de origem.",
  });
  conversation({ channel: "instagram", phone_number_id: "pn_1", channel_account: null, contact: { wa_id: "1789" } });
  expect(await failure(sdk().conversations.reply("cv_1", { text: "Oi" }))).toMatchObject({
    code: "malformed_response", status: 0, message: "Conversa do Instagram sem UUID da Conta de canal de origem.",
  });
  expect(posted()).toEqual([]);
});

// --- outcome e retry vindos da API -------------------------------------------

it("erro de envio carrega cada outcome e retry válidos, código, status e headers", async () => {
  const cases = [
    ["accepted", "after_correction"],
    ["rejected", "backoff"],
    ["unknown", "reconcile_first"],
    ["unknown", "unknown"],
  ] as const;
  for (const [outcome, retry] of cases) {
    routes["POST /v1/messages"] = json({ error: { code: "meta_error", message: "Meta recusou.", outcome, retry } }, 422, { "retry-after": "7" });
    const error = await failure(sdk().messages.send({ to: "5511988887777", text: "oi" }));
    expect(error).toMatchObject({ code: "meta_error", message: "Meta recusou.", status: 422, outcome, retry });
    expect(error.headers?.["retry-after"]).toBe("7");
  }
});

it("erro com outcome ou retry fora do contrato não repassa o valor", async () => {
  routes["POST /v1/messages"] = json({ error: { code: "x", message: "y", outcome: "sent", retry: "now" } }, 503);
  const error = await failure(sdk().messages.send({ to: "5511988887777", text: "oi" }));
  expect(error.outcome).toBeUndefined();
  expect(error.retry).toBeUndefined();
});

it("erro HTTP sem envelope vira http_error com o status, sem quebrar no corpo", async () => {
  for (const body of ["", "null", "{}", '"texto"', "[]"]) {
    routes["GET /v1/conversations/cv_1"] = { status: 502, body };
    const error = await failure(sdk().conversations.get("cv_1"));
    expect(error).toMatchObject({ code: "http_error", message: "HTTP 502", status: 502, outcome: undefined, retry: undefined });
  }
});

it("200 com envelope de erro é erro, com outcome e retry", async () => {
  routes["POST /v1/messages"] = json({ error: { code: "media_not_ready", message: "Aguarde", outcome: "accepted", retry: "backoff" } }, 202);
  expect(await failure(sdk().messages.send({ to: "5511988887777", text: "oi" }))).toMatchObject({
    code: "media_not_ready", status: 202, outcome: "accepted", retry: "backoff",
  });
});

// --- envelope data dos endpoints de item -------------------------------------

it("item sem envelope data é malformed_response; data: null explícito passa", async () => {
  for (const body of ["null", '"texto"', "{}", "[1]", '{"id":"cv_1"}']) {
    routes["GET /v1/conversations/cv_1"] = { status: 200, body };
    expect(await failure(sdk().conversations.get("cv_1"))).toMatchObject({
      code: "malformed_response", status: 0, message: "resposta sem envelope data — contrato violado",
    });
  }
  routes["GET /v1/conversations/cv_1"] = json({ data: null });
  await expect(sdk().conversations.get("cv_1")).resolves.toBeNull();
});

it("listas exigem data[] com paging (cursor) ou meta (offset)", async () => {
  for (const body of [{ data: {}, paging: {} }, { data: [] }, { data: [], paging: [] }, []]) {
    routes["GET /v1/conversations"] = json(body);
    expect(await failure(sdk().conversations.list())).toMatchObject({ code: "malformed_response", status: 0 });
  }
  routes["GET /v1/conversations"] = json({ data: [], paging: {} });
  await expect(sdk().conversations.list()).resolves.toEqual({ data: [], paging: {} });

  for (const body of [{ data: {}, meta: {} }, { data: [] }, { data: [], meta: null }, []]) {
    routes["GET /v1/conversations/cv_1/assignments"] = json(body);
    expect(await failure(sdk().conversations.listAssignments("cv_1"))).toMatchObject({ code: "malformed_response", status: 0 });
  }
  routes["GET /v1/conversations/cv_1/assignments"] = json({ data: [], meta: { page: 1 } });
  await expect(sdk().conversations.listAssignments("cv_1")).resolves.toEqual({ data: [], meta: { page: 1 } });
});

it("baseUrl com barras no fim não duplica a barra do caminho", async () => {
  routes["GET /v1/conversations/cv_1"] = json({ data: { id: "cv_1" } });
  const client = new BotoZap({ apiKey: "bz_live_fase1", baseUrl: `${baseUrl}///` });
  await expect(client.conversations.get("cv_1")).resolves.toEqual({ id: "cv_1" });
  expect(calls.map((c) => c.path)).toEqual(["/v1/conversations/cv_1"]);
});
