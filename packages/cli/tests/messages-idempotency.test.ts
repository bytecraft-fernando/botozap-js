import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerMessages } from "../src/commands/messages.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...base, "-o", "json"];
const key = "entrega-123-2026-10-20";
const receipt = { id: "11111111-1111-4111-8111-111111111111", wamid: "wamid.X", to: "5511999999999", status: "sent" };

function request() {
  const [url, init] = fetch.mock.calls[0]!;
  return {
    method: init?.method as string | undefined,
    path: new URL(String(url)).pathname.replace(/^\/v1/, ""),
    idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
}

beforeEach(() => {
  fetch.mockReset();
  fetch.mockImplementation(async () => Response.json(receipt, { status: 201 }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("messages --idempotency-key", () => {
  const to = ["--to", "5511999999999"];
  const commands: Array<[string, string[], string]> = [
    ["send", ["send", ...to, "--text", "Olá"], "text"],
    ["send-media", ["send-media", ...to, "--type", "image", "--link", "https://exemplo.com/a.jpg"], "image"],
    ["send-interactive", ["send-interactive", ...to, "--json", '{"type":"cta_url"}'], "interactive"],
    ["send-location", ["send-location", ...to, "--latitude", "-3.1", "--longitude", "-60"], "location"],
    ["react", ["react", ...to, "--message-id", "wamid.Y", "--emoji", "👍"], "reaction"],
  ];

  for (const [name, args, type] of commands) {
    it(`${name} manda o header Idempotency-Key`, async () => {
      const result = await run(registerMessages, ["messages", ...args, "--idempotency-key", key, ...json]);
      expect(result.error).toBeUndefined();
      expect(request()).toMatchObject({ method: "POST", path: "/messages", idempotencyKey: key });
      expect(request().body.type).toBe(type);
    });
  }

  it("send com --input repassa a chave no payload cru", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "botozap-cli-")), "msg.json");
    writeFileSync(file, JSON.stringify({ to: "5511999999999", type: "text", text: { body: "Olá" } }));
    const result = await run(registerMessages, ["messages", "send", "--input", file, "--idempotency-key", key, ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ idempotencyKey: key, body: { type: "text" } });
  });

  it("sem a opção não manda o header", async () => {
    const result = await run(registerMessages, ["messages", "send", "--to", "5511999999999", "--text", "Olá", ...base]);
    expect(result.error).toBeUndefined();
    expect(request().idempotencyKey).toBeNull();
  });
});
