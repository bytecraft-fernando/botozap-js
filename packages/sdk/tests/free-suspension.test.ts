import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BotoZap,
  BotoZapError,
  isBusinessPaymentRequired,
  isFreeCap,
  isFreeNumberCap,
  isPlanError,
  PLAN_ERROR_CODES,
  type Customer,
  type PhoneNumber,
} from "../src/index.js";

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
  });
  return { client, call };
}

const refusal = (code: string, message: string) => () =>
  Response.json({ error: { code, message } }, { status: 402 });

describe("plan_suspended nas leituras", () => {
  it("customers.list devolve plan_suspended de cada Cliente", async () => {
    const { client, call } = setup(() =>
      Response.json({
        data: [
          { id: "c1", name: "Ativo", business_slot: null, plan_suspended: false },
          { id: "c2", name: "Suspenso", business_slot: null, plan_suspended: true },
        ],
        meta: { page: 1, per_page: 20, total: 2, total_pages: 1 },
      }),
    );

    const res = await client.customers.list();

    expect(call()).toMatchObject({ method: "GET", url: "https://example.test/v1/customers" });
    expect(res.data.map((c) => c.plan_suspended)).toEqual([false, true]);
  });

  it("phoneNumbers.get devolve plan_suspended do Número", async () => {
    const { client, call } = setup(() =>
      Response.json({ data: { id: "p2", phone_number_id: "1002", plan_suspended: true } }),
    );

    const phone = await client.phoneNumbers.get("p2");

    expect(call()).toMatchObject({ method: "GET", url: "https://example.test/v1/phone_numbers/p2" });
    expect(phone.plan_suspended).toBe(true);
  });

  it("o campo é opcional (servidores antigos não mandam)", () => {
    expectTypeOf<Customer["plan_suspended"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<PhoneNumber["plan_suspended"]>().toEqualTypeOf<boolean | undefined>();
    const legacy: PhoneNumber = { id: "p1" };
    expect(legacy.plan_suspended).toBeUndefined();
  });
});

describe("isFreeCap e isFreeNumberCap", () => {
  it("reconhecem o 402 free_number_cap do envio por Número suspenso", async () => {
    const { client } = setup(
      refusal("free_number_cap", "Este número está suspenso no plano Free, que permite 1 número."),
    );

    const error = await client.messages
      .send({ to: "+5531988887777", text: "Olá" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BotoZapError);
    expect((error as BotoZapError).status).toBe(402);
    expect(isFreeNumberCap(error)).toBe(true);
    expect(isFreeCap(error)).toBe(false);
    expect(isBusinessPaymentRequired(error)).toBe(false);
    expect(isPlanError(error)).toBe(true);
  });

  it("reconhecem o 402 free_cap do envio por Cliente suspenso", async () => {
    const { client } = setup(
      refusal("free_cap", "Este negócio está suspenso no plano Free, que permite 1 negócio."),
    );

    const error = await client.messages
      .send({ to: "+5531988887777", text: "Olá" })
      .catch((e: unknown) => e);

    expect(isFreeCap(error)).toBe(true);
    expect(isFreeNumberCap(error)).toBe(false);
    expect(isPlanError(error)).toBe(true);
  });

  it("reconhecem o 402 free_cap ao criar o 2º Cliente no Free", async () => {
    const { client, call } = setup(
      refusal("free_cap", "O plano Free permite 1 negócio. Assine o BotoZap para cadastrar outros negócios."),
    );

    const error = await client.customers.create({ name: "Segundo" }).catch((e: unknown) => e);

    expect(call()).toMatchObject({ method: "POST", url: "https://example.test/v1/customers" });
    expect(isFreeCap(error)).toBe(true);
    expect((error as BotoZapError).message).toContain("1 negócio");
  });

  it("free_cap entra em PLAN_ERROR_CODES; outros erros não casam", () => {
    expect(PLAN_ERROR_CODES).toContain("free_cap");
    expect(PLAN_ERROR_CODES).toContain("free_number_cap");
    expect(isFreeCap(new BotoZapError("business_payment_required", "x", 402))).toBe(false);
    expect(isFreeNumberCap(new BotoZapError("plan_restricted", "x", 403))).toBe(false);
    expect(isFreeCap(new Error("free_cap"))).toBe(false);
    expect(isFreeNumberCap({ code: "free_number_cap" })).toBe(false);
  });
});
