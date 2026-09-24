import { expect, it, vi } from "vitest";
import {
  AI_CONFIGURABLE_PURPOSES,
  AI_OPERATIONS,
  AI_PURPOSES,
  BotoZap,
} from "../src/index.js";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
function client(payload: unknown = { data: { id } }, status = 200) {
  const fetch = vi.fn(async () =>
    status === 204
      ? new Response(null, { status })
      : Response.json(payload, { status }),
  );
  return {
    fetch,
    c: new BotoZap({
      apiKey: "bz_live_fake",
      baseUrl: "https://example.test/v1",
      fetch,
    }),
  };
}
const url = (fetch: ReturnType<typeof vi.fn>, n = 0) =>
  new URL(String(fetch.mock.calls[n]![0]));
const body = (fetch: ReturnType<typeof vi.fn>, n = 0) =>
  JSON.parse(String(fetch.mock.calls[n]![1]?.body));

it("declares read scope for POST diagnostics that never write", () => {
  const read = AI_OPERATIONS.filter(
    (o) => o.method !== "GET" && o.scope === "agents:read",
  ).map((o) => `${o.group}.${o.name}`);
  expect(read.sort()).toEqual(
    ["knowledge.coverage", "knowledge.search", "knowledge.searchDiagnostics"].sort(),
  );
});

it("exposes granular purposes and keeps version-owned purposes out of bindings", () => {
  expect(AI_PURPOSES).toContain("commercial_proposal");
  expect(AI_CONFIGURABLE_PURPOSES).toContain("vision");
  expect(AI_CONFIGURABLE_PURPOSES).not.toContain("agent_turn");
  expect(AI_CONFIGURABLE_PURPOSES).not.toContain("router");
});

it("sends commercial decision with seq and never retries a changed proposal", async () => {
  const { c, fetch } = client(
    { error: { code: "proposal_changed", message: "Mudou" } },
    409,
  );
  await expect(
    c.ai.commercialProposals.decide({
      customer_id: id,
      id: "p/1",
      decision: "approve",
      seq: 3,
      apply_effect: false,
    }),
  ).rejects.toMatchObject({ code: "proposal_changed", status: 409 });
  expect(fetch).toHaveBeenCalledOnce();
  expect(url(fetch).pathname).toBe("/v1/ai/commercial-proposals/p%2F1/decision");
  expect(body(fetch)).toEqual({
    customer_id: id,
    decision: "approve",
    seq: 3,
    apply_effect: false,
  });
});

it("accepts the queued 202 envelope when requesting a commercial proposal", async () => {
  const receipt = { job_id: id, status: "pending", queued: true, replayed: false };
  const { c, fetch } = client({ data: receipt }, 202);
  expect(
    await c.ai.commercialProposals.request({
      customer_id: id,
      opportunity_id: other,
      request_key: "crm:opp-1",
    }),
  ).toEqual(receipt);
  expect(body(fetch)).toEqual({
    customer_id: id,
    opportunity_id: other,
    request_key: "crm:opp-1",
  });
});

it("keeps open-to-all confirmation explicit and revocation bodyless", async () => {
  const gate = client({ data: { channel_account_id: id, mode: "open" } });
  await gate.c.ai.eligibility.saveChannel({
    customer_id: id,
    id,
    expected_revision: "0",
    mode: "pre_go_live",
    test_phone_numbers: ["+5592999990000"],
  });
  expect(body(gate.fetch)).not.toHaveProperty("confirm_open_to_all");
  await gate.c.ai.eligibility.saveChannel({
    customer_id: id,
    id,
    expected_revision: "4",
    mode: "open",
    test_phone_numbers: [],
    confirm_open_to_all: true,
  });
  expect(body(gate.fetch, 1)).toMatchObject({
    expected_revision: "4",
    confirm_open_to_all: true,
  });
  expect(gate.fetch.mock.calls[1]![1]?.method).toBe("PUT");
  const revoke = client(undefined, 204);
  expect(
    await revoke.c.ai.eligibility.revokeAuthorization({ customer_id: id, id }),
  ).toBeUndefined();
  expect(url(revoke.fetch).pathname).toBe(
    `/v1/ai/eligibility/authorizations/${id}/revoke`,
  );
  expect(body(revoke.fetch)).toEqual({ customer_id: id });
});

it("preserves the inference summary next to offset meta", async () => {
  const page = {
    data: [{ id, outcome: "failed", point_label: "Atendimento" }],
    meta: {
      page: 1,
      per_page: 20,
      total_count: 1,
      total_pages: 1,
      summary: { failures: [], points: [] },
    },
  };
  const { c, fetch } = client(page);
  const result = await c.ai.inferences.list({
    customer_id: id,
    outcome: "failed",
    purpose: "guard",
    agent_id: other,
  });
  expect(result.meta.summary).toEqual({ failures: [], points: [] });
  expect(Object.fromEntries(url(fetch).searchParams)).toEqual({
    customer_id: id,
    outcome: "failed",
    purpose: "guard",
    agent_id: other,
  });
});

it("adds case, alert and usage filters as query parameters", async () => {
  const offset = {
    data: [],
    meta: { page: 1, per_page: 20, total_count: 0, total_pages: 0 },
  };
  const { c, fetch } = client(offset);
  await c.ai.cases.list({ customer_id: id, kind: "financeiro", source: "guardrail" });
  await c.ai.alerts.list({ customer_id: id, kind: "case_stale", severity: "critical" });
  await c.ai.cases.events({ customer_id: id, id, page: 2 });
  expect(url(fetch, 0).searchParams.get("source")).toBe("guardrail");
  expect(url(fetch, 1).searchParams.get("kind")).toBe("case_stale");
  expect(url(fetch, 2).pathname).toBe(`/v1/ai/cases/${id}/events`);
  expect(url(fetch, 2).searchParams.get("page")).toBe("2");
  const usage = client({ data: { totals: {} } });
  await usage.c.ai.usage.get({ customer_id: id, agent_id: other, purpose: "vision" });
  expect(url(usage.fetch).searchParams.get("purpose")).toBe("vision");
});

it("resolves alerts in bulk only up to the listed instant", async () => {
  const { c, fetch } = client({ data: { resolved_count: 2, remaining: 0 } });
  expect(
    await c.ai.alerts.resolveBulk({
      customer_id: id,
      created_before: "2026-09-24T12:00:00.000Z",
      filters: { kind: "handoff", status: "open" },
    }),
  ).toEqual({ resolved_count: 2, remaining: 0 });
  expect(url(fetch).pathname).toBe("/v1/ai/alerts/resolve");
  expect(body(fetch).filters).toEqual({ kind: "handoff", status: "open" });
});

it("routes knowledge diagnostics, catalog sync and citations exactly", async () => {
  const { c, fetch } = client({ data: {} });
  await c.ai.knowledge.searchDiagnostics({
    customer_id: id,
    source_ids: [id],
    query: "preço",
    threshold: 0.3,
  });
  await c.ai.knowledge.syncCatalog({
    customer_id: id,
    id,
    event_key: "evt-1",
    upserts: [{ id: "sku-1", name: "Produto", price: "10,00" }],
    removals: [{ id: "sku-2" }],
  });
  await c.ai.knowledge.citations({ customer_id: id, conversation_id: other });
  await c.ai.knowledge.coverage({ customer_id: id, tool_ids: ["crm.stages.write"] });
  expect(url(fetch, 0).pathname).toBe("/v1/ai/knowledge/search/diagnostics");
  expect(url(fetch, 1).pathname).toBe(`/v1/ai/knowledge/${id}/catalog`);
  expect(body(fetch, 1)).toEqual({
    customer_id: id,
    event_key: "evt-1",
    upserts: [{ id: "sku-1", name: "Produto", price: "10,00" }],
    removals: [{ id: "sku-2" }],
  });
  expect(fetch.mock.calls[2]![1]?.method).toBe("GET");
  expect(url(fetch, 2).searchParams.get("conversation_id")).toBe(other);
  expect(body(fetch, 3)).toEqual({ customer_id: id, tool_ids: ["crm.stages.write"] });
});

it("keeps memory, skill curation, notices, operator and provider catalog paths", async () => {
  const { c, fetch } = client({ data: {} });
  await c.ai.memory.reactivateEntry({ customer_id: id, id, expected_revision: "0" });
  await c.ai.memory.entryEvents({ customer_id: id, id });
  await c.ai.skills.decideNearMiss({
    customer_id: id,
    id,
    expected_revision: "2",
    decision: "accept",
    phrase: "segunda via",
    skill_revision: "5",
  });
  await c.ai.skills.nearMisses({ customer_id: id, status: "pending" });
  await c.ai.skills.composition({ customer_id: id });
  await c.ai.notices.diagnostics({ customer_id: id });
  await c.ai.notices.effect({ customer_id: id, days: 14 });
  await c.ai.operator.metrics({ customer_id: id, days: 7 });
  await c.ai.operator.promises({ customer_id: id, status: "unowned", limit: 10 });
  await c.ai.providers.catalog({ customer_id: id });
  await c.ai.providers.syncCatalog({
    customer_id: id,
    credential_id: other,
    expected_revision: "9007199254740993",
  });
  const calls = fetch.mock.calls.map((call) => {
    const u = new URL(String(call[0]));
    return `${call[1]?.method} ${u.pathname}`;
  });
  expect(calls).toEqual([
    `POST /v1/ai/memory/entries/${id}/reactivate`,
    `GET /v1/ai/memory/entries/${id}/events`,
    `POST /v1/ai/skills/near-misses/${id}`,
    "GET /v1/ai/skills/near-misses",
    "GET /v1/ai/skills/composition",
    "GET /v1/ai/notices/diagnostics",
    "GET /v1/ai/notices/effect",
    "GET /v1/ai/operator-metrics",
    "GET /v1/ai/promises",
    "GET /v1/ai/providers/catalog",
    "POST /v1/ai/providers/catalog",
  ]);
  expect(body(fetch, 0)).toEqual({ customer_id: id, expected_revision: "0" });
  expect(body(fetch, 10).expected_revision).toBe("9007199254740993");
});

it("allows 20 MiB knowledge uploads and still rejects larger files before HTTP", async () => {
  const { c, fetch } = client();
  const big = new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]);
  expect(() =>
    c.ai.knowledge.upload({ customer_id: id, name: "Manual", file: big, file_name: "m.pdf" }),
  ).toThrow("limite");
  expect(fetch).not.toHaveBeenCalled();
  const limit = new Blob([new Uint8Array(20 * 1024 * 1024)]);
  await c.ai.knowledge
    .upload({ customer_id: id, name: "Manual", file: limit, file_name: "m.pdf" })
    .catch(() => undefined);
  expect(url(fetch).pathname).toBe("/v1/ai/uploads");
  expect(body(fetch).byte_size).toBe(20 * 1024 * 1024);
});

it("pages the unified follow-up queue by cursor and keeps promise idempotency", async () => {
  const page = { data: [{ kind: "promise", id }], next_cursor: "eyJiIjowfQ" };
  const { c, fetch } = client({ data: page });
  expect(
    await c.ai.followups.queue({
      customer_id: id,
      kind: "promise",
      cursor: "abc",
      limit: 50,
    }),
  ).toEqual(page);
  expect(Object.fromEntries(url(fetch).searchParams)).toEqual({
    customer_id: id,
    kind: "promise",
    cursor: "abc",
    limit: "50",
  });
  await c.ai.followups.promises({ customer_id: id, status: "scheduled" });
  expect(url(fetch, 1).pathname).toBe("/v1/ai/followups/promises");
  const input = {
    customer_id: id,
    contact_id: id,
    conversation_id: other,
    agent_id: id,
    operation_key: other,
    reason: "Cliente pediu retorno",
    promise: "Retornar com o orçamento",
    promised_at: "2026-09-25T13:00:00-04:00",
    outside_window: "alert" as const,
  };
  await c.ai.followups.schedulePromise(input);
  expect(fetch.mock.calls[2]![1]?.method).toBe("POST");
  expect(body(fetch, 2)).toEqual(input);
  await c.ai.followups.cancelPromise({ customer_id: id, id, reason: "Resolvido" });
  await c.ai.followups.resolvePromise({
    customer_id: id,
    id,
    outcome: "sent",
    note: "Confirmado no WhatsApp Manager",
    wamid: "wamid.X",
  });
  await c.ai.followups.getPromise({ customer_id: id, id });
  expect(
    fetch.mock.calls.slice(3).map((call) => `${call[1]?.method} ${new URL(String(call[0])).pathname}`),
  ).toEqual([
    `POST /v1/ai/followups/promises/${id}/cancel`,
    `POST /v1/ai/followups/promises/${id}/resolve`,
    `GET /v1/ai/followups/promises/${id}`,
  ]);
});

it("never retries an ambiguous promise schedule", async () => {
  const { c, fetch } = client(
    { error: { code: "unavailable", message: "Tente novamente" } },
    503,
  );
  await expect(
    c.ai.followups.schedulePromise({
      customer_id: id,
      contact_id: id,
      conversation_id: id,
      agent_id: id,
      operation_key: other,
      reason: "r",
      promise: "p",
      promised_at: "2026-09-25T13:00:00Z",
    }),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledOnce();
});

it("covers capability usage, evolution and style adjustments with exact CAS", async () => {
  const { c, fetch } = client({ data: {} });
  await c.ai.agents.capabilityUsage({ customer_id: id, id, days: 14 });
  await c.ai.evolution.get({ customer_id: id, days: 90, agent_id: other });
  await c.ai.styleAdjustments.list({ customer_id: id });
  await c.ai.styleAdjustments.save({
    customer_id: id,
    adjustment: "sem_travessao_longo",
    enabled: true,
    expected_revision: "0",
  });
  expect(
    fetch.mock.calls.map((call) => `${call[1]?.method} ${new URL(String(call[0])).pathname}`),
  ).toEqual([
    `GET /v1/ai/agents/${id}/capability-usage`,
    "GET /v1/ai/evolution",
    "GET /v1/ai/style-adjustments",
    "PUT /v1/ai/style-adjustments",
  ]);
  expect(url(fetch, 1).searchParams.get("days")).toBe("90");
  expect(body(fetch, 3)).toEqual({
    customer_id: id,
    adjustment: "sem_travessao_longo",
    enabled: true,
    expected_revision: "0",
  });
});

it("keeps the additive execution security trail from preview", async () => {
  const security = {
    summary: { hold: "evaluation_vetoed", guard: null, evaluation: { verdict: "vetoed", attempts: 1, codes: ["x"] }, disclosure_version: 1 },
    events: null,
    events_unavailable: true,
  };
  const { c } = client({ data: { id, status: "awaiting_approval", security } });
  const r = await c.ai.agents.preview({
    customer_id: id,
    id,
    version_id: id,
    operation_key: other,
    messages: [{ role: "user", content: "Oi" }],
  });
  expect(r.security).toEqual(security);
});
