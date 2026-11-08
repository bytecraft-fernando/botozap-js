/**
 * Envios sem confirmação da Meta na CLI (task 26 da #1306 no botozap): `conversations
 * pending-sends` e `conversations mark-send --outcome`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerConversations } from "../src/commands/conversations.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const ID = "c0000000-0000-4000-8000-000000000001";
const SEND = "c0000000-0000-4000-8000-0000000000f1";
const pending = { id: SEND, status: "unconfirmed", kind: "text", preview: "oi", created_at: "2026-11-08T12:00:00.000Z" };

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

const call = (i = 0) => {
  const [url, init] = fetch.mock.calls[i]!;
  return { method: init?.method, path: new URL(String(url)).pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

describe("conversations pending-sends e mark-send", () => {
  it("pending-sends lista em JSON e em texto, inclusive vazio", async () => {
    fetch.mockImplementationOnce(async () => Response.json({ data: [pending] }));
    const asJson = await run(registerConversations, ["conversations", "pending-sends", ID, ...base, "-o", "json"]);
    expect(JSON.parse(asJson.stdout)).toEqual([pending]);
    expect(call()).toMatchObject({ method: "GET", path: `/v1/conversations/${ID}/pending-sends` });
    fetch.mockImplementationOnce(async () => Response.json({ data: [pending] }));
    expect((await run(registerConversations, ["conversations", "pending-sends", ID, ...base])).stdout).toContain(SEND);
    fetch.mockImplementationOnce(async () => Response.json({ data: [] }));
    expect((await run(registerConversations, ["conversations", "pending-sends", ID, ...base])).stdout).toContain("Nenhum envio sem confirmação");
  });

  it("mark-send manda o outcome; saiu e não saiu têm o seu texto; outcome inventado não chama a API", async () => {
    fetch.mockImplementationOnce(async () => Response.json({ data: { id: SEND, status: "sent" } }));
    expect((await run(registerConversations, ["conversations", "mark-send", ID, SEND, "--outcome", "sent", ...base])).stdout).toContain("Envio marcado como saiu.");
    expect(call()).toEqual({ method: "POST", path: `/v1/conversations/${ID}/pending-sends/${SEND}`, body: { outcome: "sent" } });
    fetch.mockImplementationOnce(async () => Response.json({ data: { id: SEND, status: "not_sent" } }));
    expect((await run(registerConversations, ["conversations", "mark-send", ID, SEND, "--outcome", "not_sent", ...base])).stdout).toContain("Envio marcado como não saiu.");
    fetch.mockImplementationOnce(async () => Response.json({ data: { id: SEND, status: "not_sent" } }));
    expect(JSON.parse((await run(registerConversations, ["conversations", "mark-send", ID, SEND, "--outcome", "not_sent", ...base, "-o", "json"])).stdout)).toEqual({ id: SEND, status: "not_sent" });
    const wrong = await run(registerConversations, ["conversations", "mark-send", ID, SEND, "--outcome", "talvez", ...base]);
    expect(wrong.error).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
