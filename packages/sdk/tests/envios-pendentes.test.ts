/**
 * Envios sem confirmação da Meta (task 26 da #1306 no botozap): a lista da conversa e "saiu" /
 * "não saiu", como o aviso na conversa no painel.
 */
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { BotoZap, BotoZapError, type PendingSend, type PendingSendMarkResult } from "../src/index.js";

const CONV = "c0000000-0000-4000-8000-000000000001";
const SEND = "c0000000-0000-4000-8000-0000000000f1";

function setup(response: () => Response) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  const client = new BotoZap({ apiKey: "bz_live_secret_for_test", baseUrl: "https://example.test/v1", fetch });
  const call = () => {
    const init = fetch.mock.calls[0]?.[1] as RequestInit | undefined;
    return { url: fetch.mock.calls[0]?.[0] as string, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
  };
  return { client, call };
}

describe("conversations.listPendingSends e markPendingSend", () => {
  it("lista com GET em /conversations/{id}/pending-sends", async () => {
    const send: PendingSend = { id: SEND, status: "unconfirmed", kind: "text", preview: "oi", created_at: "2026-11-08T12:00:00.000Z" };
    const { client, call } = setup(() => Response.json({ data: [send] }));
    const result = await client.conversations.listPendingSends(CONV);
    expect(result).toEqual([send]);
    expectTypeOf(result).toEqualTypeOf<PendingSend[]>();
    expect(call()).toEqual({ method: "GET", url: `https://example.test/v1/conversations/${CONV}/pending-sends`, body: undefined });
  });

  it("marca com POST e o outcome no corpo", async () => {
    const { client, call } = setup(() => Response.json({ data: { id: SEND, status: "not_sent" } }));
    const result = await client.conversations.markPendingSend(CONV, SEND, "not_sent");
    expect(result).toEqual({ id: SEND, status: "not_sent" });
    expectTypeOf(result).toEqualTypeOf<PendingSendMarkResult>();
    expect(call()).toEqual({ method: "POST", url: `https://example.test/v1/conversations/${CONV}/pending-sends/${SEND}`, body: { outcome: "not_sent" } });
  });

  it("envio já resolvido vira send_not_pending (409)", async () => {
    const { client } = setup(() => Response.json({ error: { code: "send_not_pending", message: "já resolvido" } }, { status: 409 }));
    const error = await client.conversations.markPendingSend(CONV, SEND, "sent").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).status).toBe(409);
  });
});
