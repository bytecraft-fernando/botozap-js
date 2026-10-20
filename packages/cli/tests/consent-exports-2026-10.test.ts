import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerBilling } from "../src/commands/billing.js";
import { registerContacts } from "../src/commands/contacts.js";
import { registerConversations } from "../src/commands/conversations.js";
import { registerCustomers } from "../src/commands/customers.js";
import { registerExports } from "../src/commands/exports.js";
import { registerTeamEvents } from "../src/commands/team-events.js";
import { registerTemplates } from "../src/commands/templates.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...base, "-o", "json"];

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    method: init?.method as string | undefined,
    path: parsed.pathname.replace(/^\/v1/, ""),
    query: Object.fromEntries(parsed.searchParams),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("conversations request-consent e delete", () => {
  it("request-consent manda finalidades e texto e mostra o canal", async () => {
    fetch.mockImplementation(async () =>
      Response.json(
        { data: { id: "m1", channel: "instagram", purposes: ["marketing", "utility"], body: "Oi", warnings: [{ code: "send_unrecorded", message: "não reenvie" }] } },
        { status: 201 },
      ),
    );
    const result = await run(registerConversations, [
      "conversations", "request-consent", "cv1", "--purpose", "marketing", "--purpose", "utility", "--body", "Oi", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({
      method: "POST",
      path: "/conversations/cv1/consent-request",
      body: { purposes: ["marketing", "utility"], body: "Oi" },
    });
    expect(result.stdout).toContain("Instagram");
    expect(result.stdout).toContain("send_unrecorded");
  });

  it("request-consent recusa finalidade inválida sem chamar a API", async () => {
    const result = await run(registerConversations, ["conversations", "request-consent", "cv1", "--purpose", "x", ...base]);
    expect(String((result.error as Error).message)).toContain("marketing ou utility");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("delete sem --yes e sem terminal recusa e não chama a API", async () => {
    const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const result = await run(registerConversations, ["conversations", "delete", "cv1", ...base]).finally(() => {
      if (original) Object.defineProperty(process.stdin, "isTTY", original);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
    });
    expect(String((result.error as Error).message)).toContain("--yes");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("delete --yes chama DELETE /conversations/{id}", async () => {
    fetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const result = await run(registerConversations, ["conversations", "delete", "cv1", "--yes", ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "DELETE", path: "/conversations/cv1" });
    expect(JSON.parse(result.stdout)).toEqual({ deleted: true });
  });
});

describe("contacts consents", () => {
  const consent = { id: "k1", channel: "whatsapp", purpose: "marketing", state: "revoked", origin: "template_button", recorded_by: null, evidence: "", created_at: "2026-10-20T10:00:00Z" };

  it("consents lista o vigente e o histórico", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { current: [consent], history: [consent] } }));
    const result = await run(registerContacts, ["contacts", "consents", "ct1", ...base]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "GET", path: "/contacts/ct1/consents" });
    expect(result.stdout).toContain("template_button");
    expect(result.stdout).toContain("Vigente");
  });

  it("record-consent exige canal, finalidade e estado e faz POST", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { ...consent, state: "granted", origin: "api" } }, { status: 201 }));
    const result = await run(registerContacts, [
      "contacts", "record-consent", "ct1", "--channel", "whatsapp", "--purpose", "marketing", "--state", "granted", "--evidence", "site", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({
      method: "POST",
      path: "/contacts/ct1/consents",
      body: { channel: "whatsapp", purpose: "marketing", state: "granted", evidence: "site" },
    });
    const missing = await run(registerContacts, ["contacts", "record-consent", "ct1", "--channel", "whatsapp", ...base]);
    expect(missing.error).toBeDefined();
  });

  it("create mostra os avisos de consentimento", async () => {
    fetch.mockImplementation(async () =>
      Response.json(
        { data: { id: "ct1", wa_id: "5531", warnings: [{ code: "consent_opted_out", message: "recusou", channel: "whatsapp", purpose: "marketing" }] } },
        { status: 201 },
      ),
    );
    const result = await run(registerContacts, ["contacts", "create", "--wa-id", "5531", ...base]);
    expect(result.stdout).toContain("Aviso [consent_opted_out] (whatsapp, marketing): recusou");
  });
});

describe("customers update e templates", () => {
  it("customers update manda palavras e confirmações, e --clear limpa a lista", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { id: "cu1", name: "A" } }));
    const result = await run(registerCustomers, [
      "customers", "update", "cu1",
      "--opt-out-keyword", "sair", "--opt-out-keyword", "parar", "--clear-opt-in-keywords",
      "--opt-out-confirmation", "Ok", "--opt-in-confirmation", "Bem-vindo", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual({
      opt_out_keywords: ["sair", "parar"],
      opt_in_keywords: [],
      opt_out_confirmation: "Ok",
      opt_in_confirmation: "Bem-vindo",
    });
    const both = await run(registerCustomers, ["customers", "update", "cu1", "--opt-in-keyword", "a", "--clear-opt-in-keywords", ...base]);
    expect(both.error).toBeDefined();
  });

  it("templates update marca botões de saída; sem opção, recusa", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { id: "t1", opt_out_buttons: ["Sair"] } }));
    const result = await run(registerTemplates, ["templates", "update", "t1", "--opt-out-button", "Sair", ...base]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "PATCH", path: "/templates/t1", body: { opt_out_buttons: ["Sair"] } });

    const cleared = await run(registerTemplates, ["templates", "update", "t1", "--clear-opt-out-buttons", ...base]);
    expect(cleared.error).toBeUndefined();
    expect(request(1).body).toEqual({ opt_out_buttons: [] });

    const none = await run(registerTemplates, ["templates", "update", "t1", ...base]);
    expect(none.error).toBeDefined();
  });
});

describe("exports, team-events e billing", () => {
  const record = { id: "e1", status: "pending", format: "csv", scope: { type: "customer", customer_id: "cu1", customer_name: "Padaria" }, requested_by: "API", requested_via: "api", created_at: "2026-10-20T10:00:00Z", finished_at: null, expires_at: null, size_bytes: null, counts: null, error: null, download: null };

  it("exports create/list/get", async () => {
    fetch.mockImplementation(async () => Response.json({ data: record }, { status: 202 }));
    const created = await run(registerExports, ["exports", "create", "--customer-id", "cu1", "--format", "csv", ...base]);
    expect(created.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "POST", path: "/exports", body: { customer_id: "cu1", format: "csv" } });
    expect(created.stdout).toContain("Cliente Padaria");

    fetch.mockImplementation(async () => Response.json({ data: [record] }));
    const listed = await run(registerExports, ["exports", "list", ...base]);
    expect(request(1)).toMatchObject({ method: "GET", path: "/exports" });
    expect(listed.stdout).toContain("e1");

    fetch.mockImplementation(async () => Response.json({ data: { ...record, status: "ready", download: { url: "https://r2.example/e1.zip", expires_in: 300 } } }));
    const got = await run(registerExports, ["exports", "get", "e1", ...base]);
    expect(request(2)).toMatchObject({ method: "GET", path: "/exports/e1" });
    expect(got.stdout).toContain("https://r2.example/e1.zip");
    expect(got.stdout).toContain("300s");
  });

  it("exports create recusa formato inválido", async () => {
    const result = await run(registerExports, ["exports", "create", "--format", "xml", ...base]);
    expect(result.error).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("team-events list manda os filtros", async () => {
    fetch.mockImplementation(async () =>
      Response.json({
        data: [{ id: "ev1", created_at: "2026-10-20T10:00:00Z", actor: { label: "Chave X" }, action: "export.requested", action_label: "Pediu a exportação", target: { label: "Conta inteira" }, ip_address: "203.0.113.9" }],
        paging: { cursors: { before: null, after: null }, next: null, previous: null },
      }),
    );
    const result = await run(registerTeamEvents, [
      "team-events", "list", "--since", "2026-10-01", "--actor-id", "k1", "--action", "export.requested", "--target-type", "export", "--target-id", "e1", "--limit", "5", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({
      method: "GET",
      path: "/team_events",
      query: { since: "2026-10-01", actor_id: "k1", action: "export.requested", target_type: "export", target_id: "e1", limit: "5" },
    });
    expect(result.stdout).toContain("Pediu a exportação");
  });

  it("billing mostra a garantia de 7 dias", async () => {
    fetch.mockImplementation(async () =>
      Response.json({
        data: { plan: "paid", included_businesses: 1, legacy_extra_businesses: 0, slot_amount_cents: 4700, can_add_slot: true, slots: [], guarantee: { term: "annual", amount_cents: 97000, deadline: "2026-10-27T12:00:00Z" } },
      }),
    );
    const result = await run(registerBilling, ["billing", ...base]);
    expect(result.stdout).toContain("garantia de 7 dias");
    expect(result.stdout).toContain("R$ 970,00");
  });
});
