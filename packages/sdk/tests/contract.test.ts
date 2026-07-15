/**
 * Contract tests do SDK `@botozap/sdk` (item aberto do E0.3).
 *
 * Sobe um servidor HTTP efêmero (node:http, porta 0) que faz o papel da API
 * `/v1`: grava cada request (método, path, query, header de auth, body) e
 * responde fixtures NO FORMATO REAL das rotas (ver `src/lib/api/v1.ts`):
 *   - `ok`       → `{ data: <obj> }`         (item singular — SDK desempacota)
 *   - `okCursor` → `{ data: [...], paging }` (lista por cursor — SDK devolve inteiro)
 *   - `okOffset` → `{ data: [...], meta }`   (lista por offset — SDK devolve inteiro)
 *   - POST /messages responde o objeto DIRETO (sem `{ data }`), status 201.
 *   - DELETE responde 204 sem corpo.
 *   - Erro → envelope `{ error: { code, message } }` com status 4xx/5xx.
 *
 * Cada teste prova o REQUEST que o SDK monta E o RESPONSE que ele entrega ao
 * chamador — é isso que "contrato" significa aqui: se a rota mudar o envelope
 * ou o SDK mudar o unwrap/serialização, o teste quebra.
 *
 * Import relativo do fonte TS do SDK (`../src/index.js`): o Vite resolve
 * a extensão `.js` do source NodeNext para o `.ts` real; não usa o `dist`.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BotoZap, BotoZapError } from "../src/index.js";

/** Request capturado pelo servidor-mock — o que o SDK REALMENTE mandou. */
type CapturedRequest = {
  method: string;
  /** pathname puro, ex.: "/messages" ou "/messages/abc" (sem query). */
  path: string;
  query: Record<string, string>;
  authorization: string | undefined;
  contentType: string | undefined;
  /** body já parseado (JSON) ou undefined quando não há corpo. */
  body: unknown;
  rawBody: string;
};

/** Resposta que o mock deve devolver para o próximo request. */
type MockResponse = {
  status?: number;
  /** Corpo serializado como JSON. */
  json?: unknown;
  /** Corpo cru literal (para 204/sem corpo, use ausência de json e raw). */
  raw?: string;
};

const API_KEY = "bz_live_contract_test";

let server: Server;
let baseUrl: string;
let boto: BotoZap;

const captured: CapturedRequest[] = [];
let responder: (req: CapturedRequest) => MockResponse = () => ({
  status: 200,
  json: { data: null },
});

/** Último request que o servidor recebeu. */
function lastRequest(): CapturedRequest {
  const r = captured.at(-1);
  if (!r) throw new Error("nenhum request capturado");
  return r;
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
        contentType: firstHeader(req.headers["content-type"]),
        body: raw ? JSON.parse(raw) : undefined,
        rawBody: raw,
      });

      const out = responder(captured.at(-1)!);
      const status = out.status ?? 200;
      if (out.json !== undefined) {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(out.json));
      } else if (out.raw !== undefined) {
        res.writeHead(status);
        res.end(out.raw);
      } else {
        // 204 e afins: sem corpo.
        res.writeHead(status);
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
  // default seguro; cada teste sobrescreve conforme o contrato que exercita.
  responder = () => ({ status: 200, json: { data: null } });
});

function firstHeader(h: string | string[] | undefined): string | undefined {
  return Array.isArray(h) ? h[0] : h;
}

describe("SDK contract — request montado + response entregue", () => {
  it("messages.send: POST /messages, Bearer, body {to,type,text}; resposta DIRETA sem unwrap", async () => {
    responder = () => ({
      status: 201,
      json: {
        id: "msg_uuid_1",
        wamid: "wamid.HBgADEADBEEF",
        to: "+5531988887777",
        status: "sent",
      },
    });

    const result = await boto.messages.send({
      to: "+5531988887777",
      text: "Olá, mundo!",
    });

    // REQUEST
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/messages");
    expect(req.authorization).toBe(`Bearer ${API_KEY}`);
    expect(req.contentType).toBe("application/json");
    expect(req.body).toMatchObject({
      to: "+5531988887777",
      type: "text",
      text: { body: "Olá, mundo!" },
    });

    // RESPONSE: o objeto vem DIRETO (POST /messages não usa envelope {data}).
    expect(result).toEqual({
      id: "msg_uuid_1",
      wamid: "wamid.HBgADEADBEEF",
      to: "+5531988887777",
      status: "sent",
    });
    expect(result.wamid).toBe("wamid.HBgADEADBEEF");
  });

  it("messages.get: GET /messages/:id; DESEMPACOTA o envelope {data}", async () => {
    responder = () => ({
      status: 200,
      json: { data: { id: "msg_uuid_1", to: "+5531988887777", status: "delivered" } },
    });

    const msg = await boto.messages.get("msg uuid/1");

    // REQUEST: id vai encodado no path, GET, Bearer.
    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/messages/msg%20uuid%2F1");
    expect(req.authorization).toBe(`Bearer ${API_KEY}`);
    expect(req.body).toBeUndefined();

    // RESPONSE: recebe o objeto INTERNO, não o envelope.
    expect(msg).toEqual({ id: "msg_uuid_1", to: "+5531988887777", status: "delivered" });
  });

  it("customers.list: GET /customers?page&per_page; retorno OffsetList {data,meta} INTEIRO", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "cus_1", name: "Cliente Um" }],
        meta: { page: 2, per_page: 50, total_pages: 3, total_count: 120 },
      },
    });

    const list = await boto.customers.list({ page: 2, per_page: 50 });

    // REQUEST: params viram query string.
    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/customers");
    expect(req.query).toEqual({ page: "2", per_page: "50" });

    // RESPONSE: lista devolve o envelope offset COMPLETO (data + meta).
    expect(list.data).toEqual([{ id: "cus_1", name: "Cliente Um" }]);
    expect(list.meta).toEqual({ page: 2, per_page: 50, total_pages: 3, total_count: 120 });
  });

  it("contacts.list: GET /contacts?limit&after; retorno CursorList {data,paging} INTEIRO", async () => {
    responder = () => ({
      status: 200,
      json: {
        data: [{ id: "con_1", wa_id: "BR.1A2B" }],
        paging: {
          cursors: { before: null, after: "cur_after" },
          next: "cur_after",
          previous: null,
        },
      },
    });

    const list = await boto.contacts.list({ limit: 10, after: "cur_prev" });

    // REQUEST: só os params setados aparecem (undefined é omitido).
    const req = lastRequest();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/contacts");
    expect(req.query).toEqual({ limit: "10", after: "cur_prev" });

    // RESPONSE: envelope de cursor COMPLETO (data + paging).
    expect(list.data).toEqual([{ id: "con_1", wa_id: "BR.1A2B" }]);
    expect(list.paging.next).toBe("cur_after");
    expect(list.paging.cursors).toEqual({ before: null, after: "cur_after" });
  });

  it("webhooks.delete: DELETE /webhooks/:id → 204 sem corpo → resolve void sem crashar", async () => {
    responder = () => ({ status: 204 }); // sem json nem raw = corpo vazio

    const result = await boto.webhooks.delete("wh_123");

    // REQUEST
    const req = lastRequest();
    expect(req.method).toBe("DELETE");
    expect(req.path).toBe("/webhooks/wh_123");
    expect(req.rawBody).toBe("");

    // RESPONSE: 204 sem corpo não pode virar erro de JSON.parse; resolve undefined.
    expect(result).toBeUndefined();
  });

  it("media.upload: POST /media com body {source, phone_number_id}; DESEMPACOTA {data}", async () => {
    responder = () => ({
      status: 200,
      json: { data: { id: "media_987", mime_type: "image/png" } },
    });

    const media = await boto.media.upload({
      source: "https://exemplo.com/foto.png",
      phone_number_id: "1279498075235551",
    });

    // REQUEST: o contrato exige {source, phone_number_id} — NÃO {url, from}
    // (bug histórico). Prova que o body carrega exatamente essas chaves.
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/media");
    expect(req.body).toMatchObject({
      source: "https://exemplo.com/foto.png",
      phone_number_id: "1279498075235551",
    });
    const body = req.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("from");

    // RESPONSE: item singular vem em {data} e é desempacotado.
    expect(media).toEqual({ id: "media_987", mime_type: "image/png" });
  });

  it("messages.sendTemplate: POST /messages com template.language como OBJETO {code}", async () => {
    responder = () => ({
      status: 201,
      json: { id: "msg_t1", wamid: "wamid.TEMPLATE", to: "+5531988887777", status: "sent" },
    });

    const result = await boto.messages.sendTemplate({
      to: "+5531988887777",
      template: { name: "hello_world", language: { code: "pt_BR" } },
    });

    // REQUEST: language é OBJETO {code}, não string solta (a rota rejeita string).
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/messages");
    const body = req.body as { type: string; template: { name: string; language: unknown } };
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("hello_world");
    expect(body.template.language).toEqual({ code: "pt_BR" });
    expect(typeof body.template.language).toBe("object");

    // RESPONSE: direta (POST /messages), sem unwrap.
    expect(result.wamid).toBe("wamid.TEMPLATE");
  });

  it("erro: {error:{code,message}} com 4xx → lança BotoZapError com code/message/status", async () => {
    responder = () => ({
      status: 422,
      json: { error: { code: "missing_text", message: "text.body é obrigatório para type=text." } },
    });

    await expect(
      boto.messages.send({ to: "+5531988887777", text: "" }),
    ).rejects.toMatchObject({
      name: "BotoZapError",
      code: "missing_text",
      message: "text.body é obrigatório para type=text.",
      status: 422,
    });

    // Confirma o TIPO concreto (não só o shape) e que o request de fato saiu.
    const err = await boto.messages
      .send({ to: "+5531988887777", text: "" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(BotoZapError);
    expect(lastRequest().path).toBe("/messages");
  });
});
