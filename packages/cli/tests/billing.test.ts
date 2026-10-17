import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerBilling } from "../src/commands/billing.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const slotId = "11111111-1111-4111-8111-111111111111";
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...base, "-o", "json"];

const slot = {
  id: slotId,
  status: "open",
  customer_id: null,
  customer_name: null,
  amount_cents: 4700,
  paid: false,
  next_due_date: "2026-11-17",
  invoice_url: null,
  paused: false,
  created_at: "2026-10-17T12:00:00.000Z",
};

const billing = {
  plan: "paid",
  included_businesses: 1,
  legacy_extra_businesses: 0,
  slot_amount_cents: 4700,
  can_add_slot: true,
  slots: [
    slot,
    { ...slot, id: "22222222-2222-4222-8222-222222222222", customer_id: "c1", customer_name: "Padaria", paid: true, paused: true },
  ],
};

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  return {
    method: init?.method as string | undefined,
    path: new URL(String(url)).pathname.replace(/^\/v1/, ""),
    idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
    body: init?.body,
  };
}

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("billing", () => {
  it("mostra plano e slots em JSON", async () => {
    fetch.mockImplementation(async () => Response.json({ data: billing }));
    const result = await run(registerBilling, ["billing", ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "GET", path: "/billing" });
    expect(JSON.parse(result.stdout)).toEqual(billing);
  });

  it("mostra plano e slots no modo humano", async () => {
    fetch.mockImplementation(async () => Response.json({ data: billing }));
    const result = await run(registerBilling, ["billing", ...base]);
    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain("pago");
    expect(result.stdout).toContain("R$ 47,00/mês");
    expect(result.stdout).toContain("vazio");
    expect(result.stdout).toContain("Padaria");
    expect(result.stdout).toContain("ainda não disponível");
    expect(result.stdout).toContain("pausado");
  });
});

describe("billing slots", () => {
  it("create faz POST /billing/slots com Idempotency-Key", async () => {
    fetch.mockImplementation(async () => Response.json({ data: slot }, { status: 201 }));
    const result = await run(registerBilling, [
      "billing", "slots", "create", "--idempotency-key", "compra-slot-0001", ...json,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({
      method: "POST",
      path: "/billing/slots",
      idempotencyKey: "compra-slot-0001",
      body: undefined,
    });
    expect(JSON.parse(result.stdout)).toEqual(slot);
  });

  it("create sem chave não manda Idempotency-Key", async () => {
    fetch.mockImplementation(async () => Response.json({ data: slot }, { status: 201 }));
    const result = await run(registerBilling, ["billing", "slots", "create", ...base]);
    expect(result.error).toBeUndefined();
    expect(request().idempotencyKey).toBeNull();
    expect(result.stdout).toContain("Slot comprado.");
  });

  it("cancel faz DELETE /billing/slots/:id e aceita 204", async () => {
    fetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const result = await run(registerBilling, ["billing", "slots", "cancel", slotId, ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "DELETE", path: `/billing/slots/${slotId}` });
    expect(JSON.parse(result.stdout)).toEqual({ canceled: true });
  });

  it("cancel de slot ocupado propaga slot_in_use", async () => {
    fetch.mockImplementation(async () =>
      Response.json({ error: { code: "slot_in_use", message: "Desconecte o negócio antes." } }, { status: 409 }),
    );
    const result = await run(registerBilling, ["billing", "slots", "cancel", slotId, ...json]);
    expect(result.error).toMatchObject({ code: "slot_in_use", status: 409 });
  });
});
