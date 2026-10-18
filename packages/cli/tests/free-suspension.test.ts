import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerCustomers } from "../src/commands/customers.js";
import { registerNumbers } from "../src/commands/numbers.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const meta = { page: 1, per_page: 20, total_pages: 1, total_count: 3 };

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

const lineOf = (stdout: string, text: string) => stdout.split("\n").find((line) => line.includes(text)) ?? "";

describe("coluna SUSPENSO (teto do Free)", () => {
  it("customers list mostra quem está suspenso", async () => {
    fetch.mockImplementation(async () =>
      Response.json({
        data: [
          { id: "c1", name: "Ativo", external_customer_id: null, plan_suspended: false, created_at: "2026-10-01" },
          { id: "c2", name: "Excedente", external_customer_id: null, plan_suspended: true, created_at: "2026-10-02" },
          { id: "c3", name: "Antigo", external_customer_id: null, created_at: "2026-10-03" },
        ],
        meta,
      }),
    );
    const result = await run(registerCustomers, ["customers", "list", ...base]);
    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain("SUSPENSO");
    expect(lineOf(result.stdout, "Excedente")).toContain("sim (Free)");
    expect(lineOf(result.stdout, "Ativo")).toContain("não");
    expect(lineOf(result.stdout, "Antigo")).not.toContain("sim");
  });

  it("numbers list mostra o número suspenso", async () => {
    fetch.mockImplementation(async () =>
      Response.json({
        data: [
          { id: "p1", display_phone_number: "+55 11 90000-0001", verified_name: "Loja", plan_suspended: false },
          { id: "p2", display_phone_number: "+55 11 90000-0002", verified_name: "Filial", plan_suspended: true },
        ],
        meta: { ...meta, total_count: 2 },
      }),
    );
    const result = await run(registerNumbers, ["numbers", "list", ...base]);
    expect(result.error).toBeUndefined();
    expect(lineOf(result.stdout, "Filial")).toContain("sim (Free)");
    expect(lineOf(result.stdout, "Loja")).toContain("não");
  });

  it("customers create no Free propaga 402 free_cap", async () => {
    fetch.mockImplementation(async () =>
      Response.json(
        { error: { code: "free_cap", message: "O plano Free permite 1 negócio." } },
        { status: 402 },
      ),
    );
    const result = await run(registerCustomers, ["customers", "create", "--name", "Segundo", ...base]);
    expect(result.error).toMatchObject({ code: "free_cap", status: 402 });
  });
});
