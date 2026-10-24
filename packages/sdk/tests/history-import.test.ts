/**
 * Conversas antigas do app WhatsApp Business (coexistência):
 * `GET|PUT /v1/phone_numbers/{id}/history-import`.
 */
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BotoZap,
  BotoZapError,
  type BotoZapErrorCode,
  type HistoryImport,
  type SetHistoryImportParams,
} from "../src/index.js";

const PHONE = "c0000000-0000-4000-8000-0000000000a1";

const item: HistoryImport = {
  phone_id: PHONE,
  status: "awaiting_choice",
  window_days: null,
  window_source: null,
  window_set_at: null,
  can_choose: true,
  default_window_days: 30,
  default_at: "2026-10-25T08:00:00.000Z",
  deadline_at: "2026-10-25T12:00:00.000Z",
  onboarded_at: "2026-10-24T12:00:00.000Z",
};

function setup(response: () => Response) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  const client = new BotoZap({ apiKey: "bz_live_secret_for_test", baseUrl: "https://example.test/v1", fetch });
  const call = (i = 0) => {
    const init = fetch.mock.calls[i]?.[1] as RequestInit | undefined;
    return {
      url: fetch.mock.calls[i]?.[0] as string,
      method: init?.method,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
  };
  return { client, call };
}

describe("phoneNumbers.getHistoryImport e setHistoryImport", () => {
  it("getHistoryImport faz GET em /phone_numbers/{id}/history-import e devolve o item", async () => {
    const { client, call } = setup(() => Response.json({ data: item }));
    const result = await client.phoneNumbers.getHistoryImport(PHONE);
    expect(result).toEqual(item);
    expectTypeOf(result).toEqualTypeOf<HistoryImport>();
    expect(call()).toEqual({
      method: "GET",
      url: `https://example.test/v1/phone_numbers/${PHONE}/history-import`,
      body: undefined,
    });
  });

  it("setHistoryImport faz PUT só com window_days", async () => {
    const chosen: HistoryImport = { ...item, status: "queued", window_days: 180, window_source: "customer", window_set_at: "2026-10-24T13:00:00.000Z", can_choose: false };
    const { client, call } = setup(() => Response.json({ data: chosen }));
    const extra = { window_days: 180, other: "x" } as unknown as SetHistoryImportParams;
    const result = await client.phoneNumbers.setHistoryImport("1234567890", extra);
    expect(result).toEqual(chosen);
    expect(call()).toEqual({
      method: "PUT",
      url: "https://example.test/v1/phone_numbers/1234567890/history-import",
      body: { window_days: 180 },
    });
    expectTypeOf<SetHistoryImportParams["window_days"]>().toEqualTypeOf<0 | 30 | 180>();
  });

  it("0 é enviado (não some como falsy)", async () => {
    const { client, call } = setup(() => Response.json({ data: { ...item, status: "skipped", window_days: 0 } }));
    await client.phoneNumbers.setHistoryImport(PHONE, { window_days: 0 });
    expect(call().body).toEqual({ window_days: 0 });
  });

  it.each([
    [404, "history_import_not_available"],
    [409, "history_import_locked"],
  ] as const)("recusa %i vira BotoZapError %s", async (status, code) => {
    const { client } = setup(() => Response.json({ error: { code, message: "recusa" } }, { status }));
    const error = await client.phoneNumbers.setHistoryImport(PHONE, { window_days: 30 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect(error).toMatchObject({ code, status });
    const typed: BotoZapErrorCode = code;
    expect(typed).toBe(code);
  });
});
