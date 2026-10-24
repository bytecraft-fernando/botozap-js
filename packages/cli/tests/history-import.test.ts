/**
 * CLI `numbers history-import get|set`: conversas antigas do app WhatsApp
 * Business (coexistência).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerNumbers } from "../src/commands/numbers.js";
import { buildProgram, run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...base, "-o", "json"];
const PHONE = "c0000000-0000-4000-8000-0000000000a1";

const item = {
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

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    method: init?.method as string | undefined,
    path: parsed.pathname.replace(/^\/v1/, ""),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("numbers history-import", () => {
  it("get faz GET e mostra a situação e como escolher enquanto can_choose", async () => {
    fetch.mockImplementation(async () => Response.json({ data: item }));
    const result = await run(registerNumbers, ["numbers", "history-import", "get", PHONE, ...base]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({ method: "GET", path: `/phone_numbers/${PHONE}/history-import`, body: undefined });
    expect(result.stdout).toContain("esperando a escolha");
    expect(result.stdout).toContain(`history-import set ${PHONE} --days 0|30|180`);
    expect(result.stdout).toContain("2026-10-25T12:00:00.000Z");
  });

  it("get -o json devolve o item cru", async () => {
    fetch.mockImplementation(async () => Response.json({ data: item }));
    const result = await run(registerNumbers, ["numbers", "history-import", "get", PHONE, ...json]);
    expect(JSON.parse(result.stdout)).toEqual(item);
  });

  it.each([
    ["0", 0, "não vai trazer conversas antigas"],
    ["30", 30, "últimos 30 dias"],
    ["180", 180, "últimos 180 dias"],
  ] as const)("set --days %s faz PUT com window_days numérico", async (arg, days, message) => {
    const chosen = { ...item, status: days === 0 ? "skipped" : "queued", window_days: days, window_source: "customer", can_choose: false };
    fetch.mockImplementation(async () => Response.json({ data: chosen }));
    const result = await run(registerNumbers, ["numbers", "history-import", "set", PHONE, "--days", arg, ...base]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({ method: "PUT", path: `/phone_numbers/${PHONE}/history-import`, body: { window_days: days } });
    expect(result.stdout).toContain(message);
    expect(result.stdout).not.toContain("Dá para escolher");
  });

  it.each(["7", "30.0", "abc", "-30", ""])("set --days %j fora de 0/30/180 recusa sem chamar a API", async (arg) => {
    const result = await run(registerNumbers, ["numbers", "history-import", "set", PHONE, "--days", arg, ...base]);
    expect(String((result.error as Error)?.message)).toContain("--days deve ser 0, 30 ou 180");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("set sem --days recusa sem chamar a API", async () => {
    const result = await run(registerNumbers, ["numbers", "history-import", "set", PHONE, ...base]);
    expect(result.error).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [409, "history_import_locked"],
    [404, "history_import_not_available"],
  ] as const)("propaga %i %s", async (status, code) => {
    fetch.mockImplementation(async () => Response.json({ error: { code, message: "recusa" } }, { status }));
    const result = await run(registerNumbers, ["numbers", "history-import", "set", PHONE, "--days", "30", ...base]);
    expect(result.error).toMatchObject({ code, status });
  });

  it("ajuda lista get e set e explica a escolha única", () => {
    const program = buildProgram(registerNumbers);
    const group = program.commands.find((c) => c.name() === "numbers")!.commands.find((c) => c.name() === "history-import")!;
    expect(group.commands.map((c) => c.name())).toEqual(["get", "set"]);
    const set = group.commands.find((c) => c.name() === "set")!;
    expect(set.description()).toContain("uma vez por conexão");
    expect(set.description()).toContain("history_import_locked");
    expect(set.helpInformation()).toContain("--days <dias>");
  });
});
