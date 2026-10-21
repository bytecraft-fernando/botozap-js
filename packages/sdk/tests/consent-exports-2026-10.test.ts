import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  AI_CREDENTIAL_PROVIDERS,
  BotoZap,
  BotoZapError,
  isConsentOptedOut,
  isConsentRevoked,
  isNotConnected,
  type AccountExport,
  type AiEnabledProvider,
  type AiProvider,
  type Billing,
  type Consent,
  type ConsentOrigin,
  type ConsentRequestResult,
  type Contact,
  type ContactConsents,
  type Customer,
  type TeamEvent,
  type Template,
} from "../src/index.js";

function setup(response: () => Response) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  const client = new BotoZap({
    apiKey: "bz_live_secret_for_test",
    baseUrl: "https://example.test/v1",
    fetch,
  });
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

const refusal = (status: number, code: string, message = "recusa") => () =>
  Response.json({ error: { code, message } }, { status });

const consent: Consent = {
  id: "c0000000-0000-4000-8000-000000000001",
  channel: "whatsapp",
  purpose: "marketing",
  state: "revoked",
  origin: "contact_keyword",
  recorded_by: null,
  evidence: "SAIR",
  created_at: "2026-10-20T12:00:00.000Z",
};

describe("consentimentos do contato", () => {
  it("listConsents lê GET /contacts/{id}/consents (current e history)", async () => {
    const payload: ContactConsents = { current: [consent], history: [consent] };
    const { client, call } = setup(() => Response.json({ data: payload }));

    const result = await client.contacts.listConsents("ct 1");

    expect(result).toEqual(payload);
    expectTypeOf(result).toEqualTypeOf<ContactConsents>();
    expect(call()).toMatchObject({ method: "GET", url: "https://example.test/v1/contacts/ct%201/consents" });
  });

  it("recordConsent faz POST com channel, purpose, state e evidence", async () => {
    const { client, call } = setup(() => Response.json({ data: { ...consent, state: "granted", origin: "api" } }, { status: 201 }));

    const result = await client.contacts.recordConsent("ct1", {
      channel: "whatsapp",
      purpose: "marketing",
      state: "granted",
      evidence: "formulário",
    });

    expect(result.origin).toBe("api");
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://example.test/v1/contacts/ct1/consents",
      body: { channel: "whatsapp", purpose: "marketing", state: "granted", evidence: "formulário" },
    });
  });

  it("aceite sobre recusa responde 409 consent_opted_out", async () => {
    const { client } = setup(refusal(409, "consent_opted_out"));

    const error = await client.contacts
      .recordConsent("ct1", { channel: "whatsapp", purpose: "marketing", state: "granted" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BotoZapError);
    expect(isConsentOptedOut(error)).toBe(true);
    expect(isConsentRevoked(error)).toBe(false);
    expect((error as BotoZapError).status).toBe(409);
  });

  it("create manda consents e devolve warnings tipados", async () => {
    const warning = {
      code: "consent_opted_out",
      message: "Este contato recusou.",
      channel: "whatsapp",
      purpose: "marketing",
    };
    const { client, call } = setup(() =>
      Response.json({ data: { id: "ct1", wa_id: "5531988887777", warnings: [warning] } }, { status: 201 }),
    );

    const contact = await client.contacts.create({
      wa_id: "5531988887777",
      consents: [{ channel: "whatsapp", purpose: "marketing", state: "granted" }],
    });

    expect(call().body.consents).toEqual([{ channel: "whatsapp", purpose: "marketing", state: "granted" }]);
    expect(contact.warnings).toEqual([warning]);
    expectTypeOf(contact.warnings).toEqualTypeOf<Contact["warnings"]>();
  });

  it("as origens novas cabem em ConsentOrigin", () => {
    const origins: ConsentOrigin[] = ["contact_keyword", "template_button", "meta_opt_out"];
    expect(origins).toHaveLength(3);
  });

  it("template de marketing a quem recusou: 422 consent_revoked, com consent_basis no corpo", async () => {
    const { client, call } = setup(refusal(422, "consent_revoked"));

    const error = await client.messages
      .sendTemplate({
        to: "5531988887777",
        template: { name: "promo", language: { code: "pt_BR" } },
        consent_basis: "cadastro no site",
      })
      .catch((e: unknown) => e);

    expect(call().body.consent_basis).toBe("cadastro no site");
    expect(isConsentRevoked(error)).toBe(true);
  });

  it("sendTemplate sem consent_basis não manda o campo", async () => {
    const { client, call } = setup(() =>
      Response.json({ id: "m1", wamid: "w1", to: "5531988887777", status: "sent" }),
    );

    await client.messages.sendTemplate({ to: "5531988887777", template: { name: "promo", language: { code: "pt_BR" } } });

    expect("consent_basis" in call().body).toBe(false);
  });
});

describe("pedido de consentimento", () => {
  const result: ConsentRequestResult = {
    id: "m1",
    wamid: null,
    conversation_id: "cv1",
    contact_id: "ct1",
    channel: "instagram",
    type: "interactive",
    status: "sent",
    sent_to: "17841400000000000",
    purposes: ["marketing"],
    body: "Posso te enviar novidades?",
  };

  it("requestConsent faz POST /conversations/{id}/consent-request e devolve channel", async () => {
    const { client, call } = setup(() => Response.json({ data: result }, { status: 201 }));

    const sent = await client.conversations.requestConsent("cv1", { purposes: ["marketing", "utility"], body: "Posso?" });

    expect(sent.channel).toBe("instagram");
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://example.test/v1/conversations/cv1/consent-request",
      body: { purposes: ["marketing", "utility"], body: "Posso?" },
    });
  });

  it.each([
    [422, "outside_window"],
    [422, "window_closed"],
    [422, "channel_not_supported"],
    [409, "not_connected"],
  ])("recusa %i %s vira BotoZapError com o código", async (status, code) => {
    const { client } = setup(refusal(status, code));

    const error = await client.conversations.requestConsent("cv1").catch((e: unknown) => e);

    expect(error).toMatchObject({ code, status });
    expect(isNotConnected(error)).toBe(code === "not_connected");
  });
});

describe("conversations.delete", () => {
  it("faz DELETE /conversations/{id} e resolve sem corpo (204)", async () => {
    const { client, call } = setup(() => new Response(null, { status: 204 }));

    await expect(client.conversations.delete("cv1")).resolves.toBeUndefined();
    expect(call()).toMatchObject({ method: "DELETE", url: "https://example.test/v1/conversations/cv1" });
  });
});

describe("clientes e templates", () => {
  it("customers.update manda palavras e confirmações", async () => {
    const payload = {
      opt_out_keywords: ["sair"],
      opt_in_keywords: ["voltar"],
      opt_out_confirmation: "Pronto, sem mais mensagens.",
      opt_in_confirmation: "Bem-vindo de volta.",
    };
    const { client, call } = setup(() => Response.json({ data: { id: "cu1", name: "A", ...payload } }));

    const customer = await client.customers.update("cu1", payload);

    expect(call()).toMatchObject({ method: "PATCH", url: "https://example.test/v1/customers/cu1", body: payload });
    expect(customer.opt_out_keywords).toEqual(["sair"]);
    expectTypeOf<Customer["opt_in_keywords"]>().toEqualTypeOf<string[] | undefined>();
  });

  it("templates.create aceita opt_out_buttons e templates.update faz PATCH", async () => {
    const { client, call } = setup(() =>
      Response.json({ data: { id: "t1", name: "promo", opt_out_buttons: ["Sair"] } }),
    );

    await client.templates.create({
      name: "promo",
      language: "pt_BR",
      category: "MARKETING",
      components: [],
      phone_number_id: "123",
      opt_out_buttons: ["Sair"],
    });
    const updated = await client.templates.update("t1", { opt_out_buttons: [] });

    expect(call(0).body.opt_out_buttons).toEqual(["Sair"]);
    expect(call(1)).toMatchObject({
      method: "PATCH",
      url: "https://example.test/v1/templates/t1",
      body: { opt_out_buttons: [] },
    });
    expectTypeOf(updated).toEqualTypeOf<Template>();
  });
});

describe("exportações", () => {
  const record: AccountExport = {
    id: "e1",
    status: "pending",
    format: "json",
    scope: { type: "account", customer_id: null, customer_name: null },
    requested_by: "API (chave teste)",
    requested_via: "api",
    created_at: "2026-10-20T12:00:00.000Z",
    finished_at: null,
    expires_at: null,
    size_bytes: null,
    counts: null,
    error: null,
    download: null,
  };

  it("create faz POST /exports (202) com customer_id e format", async () => {
    const { client, call } = setup(() => Response.json({ data: record }, { status: 202 }));

    const created = await client.exports.create({ customer_id: "cu1", format: "csv" });

    expect(created.status).toBe("pending");
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://example.test/v1/exports",
      body: { customer_id: "cu1", format: "csv" },
    });
  });

  it("list lê GET /exports e get lê GET /exports/{id} com download", async () => {
    const ready: AccountExport = {
      ...record,
      status: "ready",
      download: { url: "https://r2.example/e1.zip?sig=1", expires_in: 300 },
    };
    const { client, call } = setup(() => Response.json({ data: [record] }));
    expect(await client.exports.list()).toEqual([record]);
    expect(call()).toMatchObject({ method: "GET", url: "https://example.test/v1/exports" });

    const second = setup(() => Response.json({ data: ready }));
    const got = await second.client.exports.get("e1");
    expect(got.download?.expires_in).toBe(300);
    expect(second.call()).toMatchObject({ method: "GET", url: "https://example.test/v1/exports/e1" });
  });
});

describe("registro de atividades", () => {
  it("teamEvents.list manda os filtros e desempacota a página por cursor", async () => {
    const event: TeamEvent = {
      id: "ev1",
      created_at: "2026-10-20T12:00:00.000Z",
      actor: { type: "api_key", user_id: null, api_key_id: "k1", label: "chave" },
      action: "export.requested",
      action_label: "Pediu a exportação",
      target: { type: "export", type_label: "Exportação", id: "e1", label: "Conta inteira" },
      before: null,
      after: { via: "api" },
      ip_address: "203.0.113.9",
    };
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({
        data: [event],
        paging: { cursors: { before: null, after: "c" }, next: "c", previous: null },
      }),
    );
    const client = new BotoZap({ apiKey: "bz_live_x", baseUrl: "https://example.test/v1", fetch });

    const page = await client.teamEvents.list({
      since: "2026-10-01T00:00:00Z",
      until: "2026-10-31T00:00:00Z",
      actor_id: "k1",
      action: "export.requested",
      target_type: "export",
      target_id: "e1",
      limit: 10,
    });

    expect(page.data).toEqual([event]);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v1/team_events");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      since: "2026-10-01T00:00:00Z",
      until: "2026-10-31T00:00:00Z",
      actor_id: "k1",
      action: "export.requested",
      target_type: "export",
      target_id: "e1",
      limit: "10",
    });
  });

  it("403 admin_required e 403 ip_not_allowed chegam como BotoZapError", async () => {
    const { client } = setup(refusal(403, "admin_required"));
    await expect(client.teamEvents.list()).rejects.toMatchObject({ code: "admin_required", status: 403 });
    const other = setup(refusal(403, "ip_not_allowed"));
    await expect(other.client.teamEvents.list()).rejects.toMatchObject({ code: "ip_not_allowed", status: 403 });
  });
});

describe("billing.guarantee", () => {
  it("lê a garantia de 7 dias e aceita null", async () => {
    const withGuarantee: Billing = {
      plan: "paid",
      included_businesses: 1,
      legacy_extra_businesses: 0,
      slot_amount_cents: 4700,
      can_add_slot: true,
      slots: [],
      guarantee: { term: "monthly", amount_cents: 9700, deadline: "2026-10-27T12:00:00.000Z" },
    };
    const { client } = setup(() => Response.json({ data: withGuarantee }));
    expect((await client.billing.get()).guarantee?.amount_cents).toBe(9700);

    const none = setup(() => Response.json({ data: { ...withGuarantee, guarantee: null } }));
    expect((await none.client.billing.get()).guarantee).toBeNull();
  });
});

describe("410 gone e catálogo de IA", () => {
  it("rota removida responde 410 gone", async () => {
    const { client } = setup(refusal(410, "gone", "removida"));
    await expect(client.ai.credentials.get({ customer_id: "cu1", id: "cr1" })).rejects.toMatchObject({ code: "gone", status: 410 });
  });

  it("a entrada de IA só aceita openai e anthropic; a leitura mantém os seis", () => {
    expect([...AI_CREDENTIAL_PROVIDERS]).toEqual(["openai", "anthropic"]);
    expectTypeOf<AiEnabledProvider>().toEqualTypeOf<"openai" | "anthropic">();
    expectTypeOf<"google">().toExtend<AiProvider>();
    expectTypeOf<"google">().not.toExtend<AiEnabledProvider>();
  });

  it("ai.credentials.create recusa provedor descontinuado em tipo e a API em 422 provider_not_enabled", async () => {
    const { client } = setup(refusal(422, "provider_not_enabled"));
    await expect(
      client.ai.credentials.create({
        customer_id: "cu1",
        // @ts-expect-error provedor descontinuado não é aceito na entrada
        provider: "google",
        label: "x",
        key: "k",
      }),
    ).rejects.toMatchObject({ code: "provider_not_enabled", status: 422 });
  });
});
