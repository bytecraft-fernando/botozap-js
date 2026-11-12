import { expect, it, vi } from "vitest";
import { BotoZap } from "../src/index.js";

/** Biblioteca de arquivos do agente (#1447) no SDK: as rotas, o upload direto com kind=file e o file_id no envio de mídia. */
const customer = "11111111-1111-4111-8111-111111111111",
  file = "22222222-2222-4222-8222-222222222222",
  signed = "https://bucket.example.test/signed?signature=secret";
function client(handler: (url: string, init?: RequestInit) => Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (target, init) => handler(String(target), init));
  return { fetch, c: new BotoZap({ apiKey: "bz_live_fake", baseUrl: "https://example.test/v1", fetch }) };
}
const json = (init?: RequestInit) => JSON.parse(String(init?.body));

it("lista, abre, edita com a revisão e apaga pelas rotas /ai/files", async () => {
  const { c, fetch } = client((url, init) => (init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ data: url.endsWith("/files?customer_id=" + customer) ? [] : { id: file } })));
  await c.ai.files.list({ customer_id: customer });
  await c.ai.files.get({ customer_id: customer, id: file });
  await c.ai.files.update({ customer_id: customer, id: file, expected_revision: "3", caption: null, active: false });
  await c.ai.files.remove({ customer_id: customer, id: file, expected_revision: "4" });
  const calls = fetch.mock.calls.map(([u, i]) => `${i?.method} ${new URL(String(u)).pathname}`);
  expect(calls).toEqual(["GET /v1/ai/files", `GET /v1/ai/files/${file}`, `PATCH /v1/ai/files/${file}`, `DELETE /v1/ai/files/${file}`]);
  expect(json(fetch.mock.calls[2]![1])).toEqual({ customer_id: customer, expected_revision: "3", caption: null, active: false });
});

it("sobe pelo upload direto com kind=file, o tipo pela extensão, o nome, o quando mandar e a legenda", async () => {
  const { c, fetch } = client((url) => {
    if (url.endsWith("/ai/uploads")) return Response.json({ data: { upload_id: file, upload_url: signed, headers: { "Content-Type": "video/quicktime" }, expires_at: "2999-01-01T00:00:00Z" } });
    if (url === signed) return new Response(null, { status: 200 });
    return Response.json({ data: { id: file, status: "processing" } });
  });
  const bytes = new Blob([new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112])]);
  await expect(c.ai.files.upload({ customer_id: customer, file: bytes, file_name: "Bastidores.MOV", name: "Bastidores", description: "Quando perguntarem como é feito.", caption: "Feito à mão" })).resolves.toMatchObject({ status: "processing" });
  expect(json(fetch.mock.calls[0]![1])).toMatchObject({ kind: "file", file_name: "Bastidores.MOV", mime_type: "video/quicktime", byte_size: 8, name: "Bastidores", description: "Quando perguntarem como é feito.", caption: "Feito à mão" });
  expect(fetch.mock.calls[1]![1]?.headers).not.toHaveProperty("Authorization");
  expect(() => c.ai.files.upload({ customer_id: customer, file: new Blob([]), file_name: "a.jpg", name: "A", description: "Quando" })).toThrow("Arquivo vazio");
});

it("manda mídia por file_id no lugar do link; um dos dois, nunca os dois", async () => {
  const { c, fetch } = client(() => Response.json({ id: file, wamid: "wamid.1", to: "5511", status: "sent" }));
  await c.messages.sendMedia({ to: "5511999999999", type: "document", file_id: file, filename: "catalogo.pdf" });
  expect(json(fetch.mock.calls[0]![1])).toEqual({ to: "5511999999999", type: "document", document: { file_id: file, filename: "catalogo.pdf" } });
  await expect(c.messages.sendMedia({ to: "5511", type: "image", file_id: file, link: "https://cdn.test/a.jpg" })).rejects.toThrow("um dos dois");
  await expect(c.messages.sendMedia({ to: "5511", type: "image" })).rejects.toThrow("um dos dois");
});
