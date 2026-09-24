import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { registerAi } from "../src/commands/ai.js";
import { run } from "./helpers.js";
let directory: string;
const fetch = vi.fn(),
  id = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "botozap-ai-"));
  fetch
    .mockReset()
    .mockImplementation(async () => Response.json({ data: { id } }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
async function call(group: string, command: string, input: unknown) {
  const file = join(directory, "input.json");
  await writeFile(file, JSON.stringify(input));
  return run(registerAi, [
    "ai",
    group,
    command,
    "--input-file",
    file,
    "--api-key",
    "bz_live_fake",
    "--api-url",
    "https://example.test/v1",
    "-o",
    "json",
  ]);
}
it("preserves opaque revisions and does not retry conflict", async () => {
  fetch.mockImplementation(async () =>
    Response.json(
      { error: { code: "revision_conflict", message: "Mudou" } },
      { status: 409 },
    ),
  );
  const body = {
    id,
    customer_id: id,
    expected_revision: "9007199254740993",
    name: "Agente",
    config: { system_prompt: "Olá\n😀" },
  };
  const result = await call("agents", "save-draft", body);
  expect(result.error).toMatchObject({ code: "revision_conflict" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(fetch.mock.calls[0]![1].body).expected_revision).toBe(
    body.expected_revision,
  );
});
it("requires attempt UUID input and explicit real-send confirmation", async () => {
  const result = await call("agents", "preview", {
    customer_id: id,
    id,
    version_id: id,
    messages: [{ role: "user", content: "Oi" }],
  });
  expect(String(result.error)).toContain("operation_key");
  const send = await call("notices", "test", {
    customer_id: id,
    operation_key: id,
    confirm_send: false,
  });
  expect(String(send.error)).toContain("confirm_send");
  expect(fetch).not.toHaveBeenCalled();
});
it("keeps numeric budget CAS separate from opaque credential CAS", async () => {
  const result = await call("usage", "save-budget", {
    customer_id: id,
    expected_revision: 0,
    mode: "off",
    monthly_limit_usd: null,
    alarm_threshold_pct: 80,
  });
  expect(result.error).toBeUndefined();
  const bad = await call("credentials", "revalidate", {
    customer_id: id,
    id,
    expected_revision: 3,
  });
  expect(String(bad.error)).toContain("string");
});
it("reads only the explicitly supplied upload path and sends bytes directly", async () => {
  const path = join(directory, "skill.zip");
  await writeFile(path, Buffer.from([80, 75, 1]));
  fetch.mockImplementation(async (url, options) =>
    String(url).endsWith("/ai/uploads")
      ? Response.json({
          data: {
            upload_id: id,
            upload_url: "https://storage.test/file",
            headers: { "Content-Type": "application/zip" },
            expires_at: "2999-01-01T00:00:00Z",
          },
        })
      : String(url) === "https://storage.test/file"
        ? new Response(null, { status: 200 })
        : Response.json({ data: { id } }),
  );
  const result = await call("skills", "import-zip", {
    customer_id: id,
    file_path: path,
  });
  expect(result.error).toBeUndefined();
  expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toMatchObject({
    file_name: "skill.zip",
    customer_id: id,
    byte_size: 3,
  });
  expect(fetch.mock.calls[1]![1].headers).not.toHaveProperty("Authorization");
  expect(
    new Uint8Array(await (fetch.mock.calls[1]![1].body as Blob).arrayBuffer()),
  ).toEqual(new Uint8Array([80, 75, 1]));
});
