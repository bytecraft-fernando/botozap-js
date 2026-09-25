/**
 * Adições da API de 25/09/2026: `display_name` de Contatos (#137), `label` de
 * Números com `PATCH /v1/phone_numbers/:id` (#138), custo Meta em
 * `GET /v1/usage/meta-costs` (#126/#127) e origem Click-to-WhatsApp/Free Entry
 * Point nas Conversas (#125). Fixtures no formato real das rotas `/v1`.
 */
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BotoZap,
  BotoZapError,
  type Contact,
  type Conversation,
  type ConversationReferral,
  type MetaCostReport,
  type PhoneNumber,
  type UpdatePhoneNumberParams,
} from "../src/index.js";

const BASE_URL = "https://example.test/v1";
const PHONE_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const CONVERSATION_ID = "44444444-4444-4444-8444-444444444444";

function client(respond: () => Response) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => respond());
  return { fetch, c: new BotoZap({ apiKey: "bz_live_fake", baseUrl: BASE_URL, fetch }) };
}

function call(fetch: ReturnType<typeof client>["fetch"], index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    method: init?.method,
    path: parsed.pathname.replace(/^\/v1/, ""),
    query: Object.fromEntries(parsed.searchParams),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

const phoneNumber = {
  id: PHONE_ID,
  phone_number_id: "1279498075235551",
  display_phone_number: "+55 11 99999-9999",
  verified_name: "BotoZap",
  label: "Recepção",
  quality_rating: "GREEN",
  type: "customer_owned",
  waba_connection_id: "55555555-5555-4555-8555-555555555555",
  customer_id: CUSTOMER_ID,
  waba_id: "4207187232868022",
  connection_status: "active",
  token_status: "valid",
  created_at: "2026-09-25T12:00:00.000Z",
};

const metaCosts = {
  customer_id: CUSTOMER_ID,
  source: "meta_pricing_analytics",
  approximate: true,
  from: "2026-09-01",
  to: "2026-09-02",
  unavailable: true,
  unavailable_reason: "cost_not_returned",
  totals: [
    { currency: "BRL", volume: 12, cost: null, estimated_cost: 1.25, cost_source: "mixed" },
  ],
  by_day: [
    { day: "2026-09-01", currency: "BRL", volume: 10, cost: 0.9, estimated_cost: 0.9, cost_source: "meta" },
    { day: "2026-09-02", currency: "BRL", volume: 2, cost: null, estimated_cost: 0.35, cost_source: "estimate" },
  ],
  by_category: [
    {
      pricing_category: "MARKETING",
      pricing_type: "REGULAR",
      currency: "BRL",
      volume: 12,
      cost: null,
      estimated_cost: 1.25,
      cost_source: "mixed",
    },
  ],
  estimate: {
    available: true,
    basis: "published_rates",
    market: "BR",
    rates_effective_from: "2026-07-01",
    rates_as_of: "2026-09-20",
    source_url: "https://developers.facebook.com/docs/whatsapp/pricing",
    excludes: ["volume_tiers", "non_brazil_recipients"],
  },
  sync: {
    connections: 1,
    synced_connections: 1,
    last_synced_at: "2026-09-25T06:00:00.000Z",
    covered_from: "2026-08-01",
  },
};

describe("contacts — display_name", () => {
  it("sends display_name on create and returns it on the contact", async () => {
    const { c, fetch } = client(() =>
      Response.json({ data: { id: CONTACT_ID, wa_id: "5592999990000", display_name: "Ana (loja)" } }, { status: 201 }),
    );
    const contact = await c.contacts.create({ wa_id: "5592999990000", display_name: "Ana (loja)" });
    expect(contact.display_name).toBe("Ana (loja)");
    expect(call(fetch)).toMatchObject({
      method: "POST",
      path: "/contacts",
      body: { wa_id: "5592999990000", display_name: "Ana (loja)" },
    });
  });

  it("sends display_name: null on update to clear it", async () => {
    const { c, fetch } = client(() => Response.json({ data: { id: CONTACT_ID, display_name: null } }));
    const contact = await c.contacts.update(CONTACT_ID, { display_name: null });
    expect(contact.display_name).toBeNull();
    expect(call(fetch)).toMatchObject({
      method: "PATCH",
      path: `/contacts/${CONTACT_ID}`,
      body: { display_name: null },
    });
  });

  it("types display_name on Contact and on create/update params", () => {
    expectTypeOf<Contact["display_name"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Parameters<BotoZap["contacts"]["create"]>[0]["display_name"]>().toEqualTypeOf<
      string | null | undefined
    >();
  });
});

describe("phoneNumbers.update — label", () => {
  it("PATCHes only the label and unwraps the number", async () => {
    const { c, fetch } = client(() => Response.json({ data: phoneNumber }));
    const updated = await c.phoneNumbers.update(PHONE_ID, { label: "Recepção" });
    expect(updated.label).toBe("Recepção");
    expect(call(fetch)).toEqual({
      method: "PATCH",
      path: `/phone_numbers/${PHONE_ID}`,
      query: {},
      body: { label: "Recepção" },
    });
  });

  it("sends label: null to clear and accepts the Meta phone_number_id", async () => {
    const { c, fetch } = client(() => Response.json({ data: { ...phoneNumber, label: null } }));
    const updated = await c.phoneNumbers.update("1279498075235551", { label: null });
    expect(updated.label).toBeNull();
    expect(call(fetch)).toMatchObject({
      path: "/phone_numbers/1279498075235551",
      body: { label: null },
    });
  });

  it("does not forward keys other than label", async () => {
    const { c, fetch } = client(() => Response.json({ data: phoneNumber }));
    await c.phoneNumbers.update(PHONE_ID, {
      label: "Vendas",
      verified_name: "Outro",
    } as UpdatePhoneNumberParams);
    expect(call(fetch).body).toEqual({ label: "Vendas" });
  });

  it("surfaces the API validation error", async () => {
    const { c } = client(() =>
      Response.json(
        { error: { code: "invalid_request", message: "'label' excede 100 caracteres." } },
        { status: 422 },
      ),
    );
    const error = await c.phoneNumbers.update(PHONE_ID, { label: "x".repeat(101) }).catch((e) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect(error).toMatchObject({ code: "invalid_request", status: 422 });
  });

  it("types label on PhoneNumber and requires it in the params", () => {
    expectTypeOf<PhoneNumber["label"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<UpdatePhoneNumberParams>().toEqualTypeOf<{ label: string | null }>();
  });
});

describe("usage.metaCosts", () => {
  it("GETs /usage/meta-costs with the filters and unwraps the report", async () => {
    const { c, fetch } = client(() => Response.json({ data: metaCosts }));
    const report = await c.usage.metaCosts({
      customer_id: CUSTOMER_ID,
      from: "2026-09-01",
      to: "2026-09-02",
    });
    expect(report).toEqual(metaCosts);
    expect(call(fetch)).toEqual({
      method: "GET",
      path: "/usage/meta-costs",
      query: { customer_id: CUSTOMER_ID, from: "2026-09-01", to: "2026-09-02" },
      body: undefined,
    });
  });

  it("omits absent filters so the API applies its 30-day default", async () => {
    const { c, fetch } = client(() => Response.json({ data: { ...metaCosts, customer_id: null } }));
    const report = await c.usage.metaCosts();
    expect(report.customer_id).toBeNull();
    expect(call(fetch).query).toEqual({});
  });

  it("keeps missing Meta cost as null instead of 0", async () => {
    const { c } = client(() => Response.json({ data: metaCosts }));
    const report = await c.usage.metaCosts();
    expect(report.totals[0]!.cost).toBeNull();
    expect(report.totals[0]!.estimated_cost).toBe(1.25);
    expect(report.unavailable_reason).toBe("cost_not_returned");
  });

  it("surfaces range_too_large as BotoZapError", async () => {
    const { c } = client(() =>
      Response.json(
        { error: { code: "range_too_large", message: "O intervalo tem dados demais." } },
        { status: 422 },
      ),
    );
    await expect(c.usage.metaCosts({ from: "2025-09-25", to: "2026-09-25" })).rejects.toMatchObject({
      code: "range_too_large",
      status: 422,
    });
  });

  it("types the report", () => {
    expectTypeOf<MetaCostReport["totals"][number]["cost"]>().toEqualTypeOf<number | null>();
    expectTypeOf<MetaCostReport["by_day"][number]["day"]>().toEqualTypeOf<string>();
    expectTypeOf<MetaCostReport["unavailable_reason"]>().toEqualTypeOf<
      "not_synced" | "cost_not_returned" | null
    >();
  });
});

describe("conversations — Click-to-WhatsApp and Free Entry Point", () => {
  const referral = {
    source_id: "120210000000000000",
    source_url: "https://fb.me/abc",
    headline: "Promoção de setembro",
    ctwa_clid: "ARAkLkA8rmlFeiCktEJQ",
    received_at: "2026-09-25T12:00:00.000Z",
  };

  it("returns entry_point, referral and FEP fields from get and list", async () => {
    const row = {
      id: CONVERSATION_ID,
      phone_number_id: PHONE_ID,
      entry_point: "ctwa",
      referral,
      fep_expires_at: "2026-09-28T12:00:00.000Z",
      fep_reply_by: "2026-09-26T12:00:00.000Z",
    };
    const { c } = client(() => Response.json({ data: row, paging: { cursors: { before: null, after: null }, next: null, previous: null } }));
    const conversation = await c.conversations.get(CONVERSATION_ID);
    expect(conversation.entry_point).toBe("ctwa");
    expect(conversation.referral).toEqual(referral);
    expect(conversation.fep_expires_at).toBe("2026-09-28T12:00:00.000Z");
    expect(conversation.fep_reply_by).toBe("2026-09-26T12:00:00.000Z");
  });

  it("types the new conversation fields", () => {
    expectTypeOf<Conversation["entry_point"]>().toEqualTypeOf<"ctwa" | "organic" | null | undefined>();
    expectTypeOf<Conversation["referral"]>().toEqualTypeOf<ConversationReferral | null | undefined>();
    expectTypeOf<ConversationReferral["ctwa_clid"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Conversation["fep_reply_by"]>().toEqualTypeOf<string | null | undefined>();
  });
});
