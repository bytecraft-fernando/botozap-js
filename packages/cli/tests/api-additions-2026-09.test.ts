import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerContacts } from "../src/commands/contacts.js";
import { registerNumbers } from "../src/commands/numbers.js";
import { registerUsage } from "../src/commands/usage.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const id = "11111111-1111-4111-8111-111111111111";
const customerId = "33333333-3333-4333-8333-333333333333";
const api = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...api, "-o", "json"];

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    method: init?.method as string | undefined,
    path: parsed.pathname.replace(/^\/v1/, ""),
    query: Object.fromEntries(parsed.searchParams),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

const report = {
  customer_id: customerId,
  source: "meta_pricing_analytics",
  approximate: true,
  from: "2026-09-01",
  to: "2026-09-02",
  unavailable: true,
  unavailable_reason: "cost_not_returned",
  totals: [{ currency: "BRL", volume: 12, cost: null, estimated_cost: 1.25, cost_source: "mixed" }],
  by_day: [],
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
  sync: { connections: 1, synced_connections: 1, last_synced_at: "2026-09-25T06:00:00.000Z", covered_from: "2026-08-01" },
};

beforeEach(() => {
  fetch.mockReset().mockImplementation(async () => Response.json({ data: { id, label: "Recepção" } }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("contacts --display-name", () => {
  it("sends display_name on create", async () => {
    const result = await run(registerContacts, [
      "contacts", "create", "--wa-id", "5592999990000", "--display-name", "Ana (loja)", ...json,
    ]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual({ wa_id: "5592999990000", display_name: "Ana (loja)" });
  });

  it("sets and clears display_name on update", async () => {
    await run(registerContacts, ["contacts", "update", id, "--display-name", "Ana", ...json]);
    await run(registerContacts, ["contacts", "update", id, "--clear-display-name", ...json]);
    expect(request(0)).toMatchObject({ method: "PATCH", body: { display_name: "Ana" } });
    expect(request(1).body).toEqual({ display_name: null });
  });

  it("rejects setting and clearing together before HTTP", async () => {
    const result = await run(registerContacts, [
      "contacts", "update", id, "--display-name", "Ana", "--clear-display-name", ...json,
    ]);
    expect(String(result.error)).toContain("não os dois");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("numbers update", () => {
  it("PATCHes the label", async () => {
    const result = await run(registerNumbers, ["numbers", "update", id, "--label", "Recepção", ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({
      method: "PATCH",
      path: `/phone_numbers/${id}`,
      query: {},
      body: { label: "Recepção" },
    });
    expect(JSON.parse(result.stdout)).toEqual({ id, label: "Recepção" });
  });

  it("sends label: null with --clear-label", async () => {
    await run(registerNumbers, ["numbers", "update", id, "--clear-label", ...json]);
    expect(request().body).toEqual({ label: null });
  });

  it("requires exactly one of --label and --clear-label before HTTP", async () => {
    const none = await run(registerNumbers, ["numbers", "update", id, ...json]);
    const both = await run(registerNumbers, ["numbers", "update", id, "--label", "a", "--clear-label", ...json]);
    expect(String(none.error)).toContain("--clear-label");
    expect(String(both.error)).toContain("não os dois");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("usage meta-costs", () => {
  beforeEach(() => {
    fetch.mockImplementation(async () => Response.json({ data: report }));
  });

  it("GETs /usage/meta-costs with the filters and prints the JSON report", async () => {
    const result = await run(registerUsage, [
      "usage", "meta-costs", "--customer-id", customerId, "--from", "2026-09-01", "--to", "2026-09-02", ...json,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({
      method: "GET",
      path: "/usage/meta-costs",
      query: { customer_id: customerId, from: "2026-09-01", to: "2026-09-02" },
      body: undefined,
    });
    expect(JSON.parse(result.stdout)).toEqual(report);
  });

  it("shows missing Meta cost as unavailable, never 0, in human output", async () => {
    const result = await run(registerUsage, ["usage", "meta-costs", ...api]);
    expect(result.error).toBeUndefined();
    expect(request().query).toEqual({});
    expect(result.stdout).toContain("indisponível");
    expect(result.stdout).toContain("1.2500");
    expect(result.stdout).toContain("a Meta não devolveu o custo");
    expect(result.stdout).not.toMatch(/\b0\.0000\b/);
  });

  it("rejects malformed dates before HTTP", async () => {
    const result = await run(registerUsage, ["usage", "meta-costs", "--from", "01/09/2026", ...json]);
    expect(String(result.error)).toContain("YYYY-MM-DD");
    expect(fetch).not.toHaveBeenCalled();
  });
});
