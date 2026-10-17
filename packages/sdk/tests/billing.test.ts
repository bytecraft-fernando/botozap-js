import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BotoZap,
  BotoZapError,
  isBusinessPaymentRequired,
  isPlanError,
  PLAN_ERROR_CODES,
  type Billing,
  type BusinessSlot,
  type ConnectionBilling,
  type Customer,
  type SetupLink,
} from "../src/index.js";

const slot: BusinessSlot = {
  id: "11111111-1111-4111-8111-111111111111",
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

function setup(response: () => Response) {
  const fetch = vi.fn(async () => response());
  const client = new BotoZap({
    apiKey: "bz_live_secret_for_test",
    baseUrl: "https://example.test/v1",
    fetch,
  });
  const call = (i = 0) => ({
    url: fetch.mock.calls[i]?.[0] as string,
    method: (fetch.mock.calls[i]?.[1] as RequestInit | undefined)?.method,
    headers: new Headers((fetch.mock.calls[i]?.[1] as RequestInit | undefined)?.headers),
    body: (fetch.mock.calls[i]?.[1] as RequestInit | undefined)?.body,
  });
  return { client, fetch, call };
}

describe("billing", () => {
  it("get lê GET /billing e desempacota data", async () => {
    const billing: Billing = {
      plan: "paid",
      included_businesses: 1,
      legacy_extra_businesses: 0,
      slot_amount_cents: 4700,
      can_add_slot: true,
      slots: [slot],
    };
    const { client, call } = setup(() => Response.json({ data: billing }));

    const result = await client.billing.get();

    expect(result).toEqual(billing);
    expectTypeOf(result).toEqualTypeOf<Billing>();
    expect(call().url).toBe("https://example.test/v1/billing");
    expect(call().method).toBe("GET");
  });

  it("slots.create faz POST /billing/slots com Idempotency-Key e sem corpo", async () => {
    const { client, call } = setup(() => Response.json({ data: slot }, { status: 201 }));

    const result = await client.billing.slots.create({ idempotencyKey: "compra-slot-0001" });

    expect(result).toEqual(slot);
    expect(call().url).toBe("https://example.test/v1/billing/slots");
    expect(call().method).toBe("POST");
    expect(call().headers.get("idempotency-key")).toBe("compra-slot-0001");
    expect(call().body).toBeUndefined();
  });

  it("slots.create sem chave não manda Idempotency-Key", async () => {
    const { client, call } = setup(() => Response.json({ data: slot }, { status: 201 }));

    await client.billing.slots.create();

    expect(call().headers.has("idempotency-key")).toBe(false);
  });

  it("slots.cancel faz DELETE /billing/slots/:id e aceita 204", async () => {
    const { client, call } = setup(() => new Response(null, { status: 204 }));

    await expect(client.billing.slots.cancel("slot/1")).resolves.toBeUndefined();

    expect(call().url).toBe("https://example.test/v1/billing/slots/slot%2F1");
    expect(call().method).toBe("DELETE");
  });

  it("recusas viram BotoZapError com o code da API", async () => {
    const { client } = setup(() =>
      Response.json(
        { error: { code: "slot_in_use", message: "Desconecte o negócio antes." } },
        { status: 409 },
      ),
    );

    const error = await client.billing.slots.cancel(slot.id).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).code).toBe("slot_in_use");
    expect((error as BotoZapError).status).toBe(409);
  });
});

describe("isBusinessPaymentRequired", () => {
  it("reconhece o 402 do envio com negócio pausado e não é recusa de plano", async () => {
    const { client } = setup(() =>
      Response.json(
        {
          error: {
            code: "business_payment_required",
            message: "Pague a fatura do slot.",
            retry: "after_correction",
          },
        },
        { status: 402 },
      ),
    );

    const error = await client.messages
      .send({ to: "+5531988887777", text: "Olá" })
      .catch((e: unknown) => e);

    expect(isBusinessPaymentRequired(error)).toBe(true);
    expect(isPlanError(error)).toBe(false);
    expect((PLAN_ERROR_CODES as readonly string[]).includes("business_payment_required")).toBe(false);
    expect((error as BotoZapError).retry).toBe("after_correction");
    expect(isBusinessPaymentRequired(new BotoZapError("plan_required", "x", 402))).toBe(false);
    expect(isBusinessPaymentRequired(new Error("x"))).toBe(false);
  });
});

describe("campos de cobrança em Cliente e link de setup", () => {
  it("são opcionais e tipados", () => {
    const connection: ConnectionBilling = {
      outcome: "creates_slot",
      amount_cents: 4700,
      reason: null,
      message: "Ao conectar, um slot de R$ 47/mês será criado.",
    };
    expectTypeOf<SetupLink["connection_billing"]>().toEqualTypeOf<
      ConnectionBilling | null | undefined
    >();
    const customer: Customer = { id: "c1", business_slot: { slot_id: slot.id, paused: false } };
    const legacy: Customer = { id: "c2" };
    expect(connection.outcome).toBe("creates_slot");
    expect(customer.business_slot?.paused).toBe(false);
    expect(legacy.business_slot).toBeUndefined();
  });
});
