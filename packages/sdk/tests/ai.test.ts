import { expect, it, vi } from "vitest";
import { BotoZap, BotoZapError, AI_OPERATIONS } from "../src/index.js";
const id = "11111111-1111-4111-8111-111111111111",
  revision = "9007199254740993";
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
it("keeps precise CAS, Unicode and nested draft config without publishing", async () => {
  const { c, fetch } = client({
    data: { agent_id: id, version_id: id, revision },
  });
  const body = {
    customer_id: id,
    name: "Recepção 🌊",
    expected_revision: revision,
    config: {
      system_prompt: "Orientar\ncom contexto",
      tool_ids: ["knowledge.search" as const],
      operator: { enabled: false },
    },
  };
  expect(await c.ai.agents.saveDraft({ id: "a/b", ...body })).toMatchObject({
    revision,
  });
  expect(fetch.mock.calls[0]![0]).toBe(
    "https://example.test/v1/ai/agents/a%2Fb",
  );
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual(body);
  expect(fetch).toHaveBeenCalledOnce();
});
it("preserves preview UUID and ambiguous provider outcome without implicit retry", async () => {
  const { c, fetch } = client(
    { error: { code: "unknown", message: "Resultado incerto" } },
    409,
  );
  const body = {
    customer_id: id,
    id,
    version_id: id,
    operation_key: id,
    messages: [{ role: "user" as const, content: "Oi" }],
  };
  await expect(c.ai.agents.preview(body)).rejects.toMatchObject({
    code: "unknown",
    status: 409,
  });
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).operation_key).toBe(
    id,
  );
});
it("keeps offset envelope distinct from array libraries", async () => {
  const paged = {
    data: [{ id }],
    meta: { page: 2, per_page: 20, total_count: 21, total_pages: 2 },
  };
  const { c, fetch } = client(paged);
  expect(await c.ai.executions.list({ customer_id: id, page: 2 })).toEqual(
    paged,
  );
  expect(
    new URL(String(fetch.mock.calls[0]![0])).searchParams.get("page"),
  ).toBe("2");
  const library = client({ data: [{ id }] });
  expect(await library.c.ai.credentials.list({ customer_id: id })).toEqual([
    { id },
  ]);
  const malformed = client({ data: [{ id }] });
  await expect(
    malformed.c.ai.agents.list({ customer_id: id }),
  ).rejects.toBeInstanceOf(BotoZapError);
});

it("handles bodyless deletion and never exports the discarded agents API", async () => {
  const { c, fetch } = client(undefined, 204);
  expect(
    await c.ai.credentials.remove({
      id,
      customer_id: id,
      expected_revision: revision,
    }),
  ).toBeUndefined();
  expect(fetch.mock.calls[0]![1]?.method).toBe("DELETE");
  expect(c).not.toHaveProperty("agents");
  expect(AI_OPERATIONS.every((op) => op.path.startsWith("/ai/"))).toBe(true);
  expect(
    new Set(AI_OPERATIONS.map((op) => `${op.method} ${op.path}`)).size,
  ).toBe(AI_OPERATIONS.length);
  expect(() => c.ai.invoke("unknown", "send", {})).toThrow();
});
it("covers every public AI method/path in the independently captured API inventory", async () => {
  const { default: routes } = await import("./fixtures/ai-routes.json");
  const key = (v: { method: string; path: string }) =>
    `${v.method} ${v.path.replace(/:[a-zA-Z_]+/g, (p) => p.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()))}`;
  expect(AI_OPERATIONS.map(key).sort()).toEqual(routes.map(key).sort());
});
it("keeps case human decision distinct from internal consultation", async () => {
  const { c, fetch } = client({
    data: { queued: false, queue_reason: "agent_unavailable" },
  });
  const r = await c.ai.cases.reply({
    customer_id: id,
    id,
    expected_revision: 7,
    operation_key: id,
    action: "need_lead_info",
    body: "Pergunte o número do pedido.",
  });
  expect(r.queued).toBe(false);
  expect(r.queue_reason).toBe("agent_unavailable");
  expect(fetch.mock.calls[0]![0]).toContain("/cases/" + id + "/reply");
  await c.ai.cases.consult({
    customer_id: id,
    id,
    operation_key: id,
    question: "O que falta?",
  });
  expect(fetch.mock.calls[1]![0]).toContain("/chat");
  expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body))).not.toHaveProperty(
    "action",
  );
});
it("preserves reviewed conversation hash, zero permission revision and skill slug encoding", async () => {
  const { c, fetch } = client();
  await c.ai.knowledge.conversationPermission({
    customer_id: id,
    id,
    expected_revision: "0",
    allowed: true,
  });
  expect(
    JSON.parse(String(fetch.mock.calls[0]![1]?.body)).expected_revision,
  ).toBe("0");
  await c.ai.knowledge.importSource({
    customer_id: id,
    name: "Atendimento revisado",
    kind: "conversation",
    conversation_id: id,
    permission_revision: "1",
    preview_hash: "a".repeat(64),
    reviewed: true,
  });
  expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body))).toMatchObject({
    preview_hash: "a".repeat(64),
    reviewed: true,
  });
  await c.ai.skills.install({
    customer_id: id,
    slug: "custom/skill",
    version_id: id,
  });
  expect(fetch.mock.calls[2]![0]).toContain("/catalog/custom%2Fskill/install");
});
