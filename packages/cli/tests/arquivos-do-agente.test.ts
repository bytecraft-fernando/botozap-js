import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerAi } from "../src/commands/ai.js";
import { registerMessages } from "../src/commands/messages.js";
import { run } from "./helpers.js";

/** Arquivos do agente (#1447) na CLI: `ai files upload` com o arquivo de `file_path` e `messages send-media --file-id`. */
let directory: string;
const fetch = vi.fn(),
  id = "11111111-1111-4111-8111-111111111111",
  base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1", "-o", "json"];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "botozap-arquivos-"));
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

it("ai files upload lê só o file_path, sobe direto com kind=file e devolve o arquivo", async () => {
  const path = join(directory, "anel.jpg"), input = join(directory, "input.json");
  await writeFile(path, Buffer.from([0xff, 0xd8, 0xff]));
  await writeFile(input, JSON.stringify({ customer_id: id, file_path: path, name: "Anel", description: "Quando pedirem o anel.", caption: "Ouro 18k" }));
  fetch.mockImplementation(async (url) =>
    String(url).endsWith("/ai/uploads")
      ? Response.json({ data: { upload_id: id, upload_url: "https://storage.test/file", headers: { "Content-Type": "image/jpeg" }, expires_at: "2999-01-01T00:00:00Z" } })
      : String(url) === "https://storage.test/file"
        ? new Response(null, { status: 200 })
        : Response.json({ data: { id, status: "ready" } }),
  );
  const result = await run(registerAi, ["ai", "files", "upload", "--input-file", input, ...base]);
  expect(result.error).toBeUndefined();
  expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toMatchObject({ kind: "file", file_name: "anel.jpg", mime_type: "image/jpeg", byte_size: 3, name: "Anel", description: "Quando pedirem o anel.", caption: "Ouro 18k" });
  expect(fetch.mock.calls[1]![1].headers).not.toHaveProperty("Authorization");
  const vazio = join(directory, "vazio.pdf"), semBytes = join(directory, "sem.json");
  await writeFile(vazio, Buffer.alloc(0));
  await writeFile(semBytes, JSON.stringify({ customer_id: id, file_path: vazio, name: "Vazio", description: "Nunca" }));
  expect((await run(registerAi, ["ai", "files", "upload", "--input-file", semBytes, ...base])).error).toBeDefined();
});

it("messages send-media --file-id manda o arquivo da biblioteca; exige --link ou --file-id, e audio só por link", async () => {
  fetch.mockImplementation(async () => Response.json({ id, wamid: "wamid.X", to: "5511999999999", status: "sent" }, { status: 201 }));
  const enviar = (args: string[]) => run(registerMessages, ["messages", "send-media", "--to", "5511999999999", ...args, ...base]);
  expect((await enviar(["--type", "document", "--file-id", id, "--filename", "catalogo.pdf"])).error).toBeUndefined();
  expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toEqual({ to: "5511999999999", type: "document", document: { file_id: id, filename: "catalogo.pdf" } });
  for (const args of [["--type", "image"], ["--type", "image", "--file-id", id, "--link", "https://cdn.test/a.jpg"], ["--type", "audio", "--file-id", id]]) {
    expect((await enviar(args)).error, args.join(" ")).toBeDefined();
  }
  expect(fetch).toHaveBeenCalledTimes(1);
});
