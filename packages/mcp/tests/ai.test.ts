import { afterEach, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AI_OPERATIONS } from "@botozap/sdk";
import { buildServer } from "../src/server.js";
const id = "11111111-1111-4111-8111-111111111111",
  revision = "9007199254740993",
  clients: Client[] = [];
async function connect(payload: unknown = { data: { id } }, status = 200) {
  const fetch = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url).endsWith("/ai/uploads"))
      return Response.json({
        data: {
          upload_id: id,
          upload_url: "https://storage.test/file",
          headers: {
            "Content-Type": JSON.parse(String(options?.body)).mime_type,
          },
          expires_at: "2999-01-01T00:00:00Z",
        },
      });
    if (String(url) === "https://storage.test/file")
      return new Response(null, { status: 200 });
    return status === 204
      ? new Response(null, { status })
      : Response.json(payload, { status });
  });
  const server = buildServer({
    apiKey: "bz_live_fake",
    baseUrl: "https://example.test/v1",
    fetch,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "ai-test", version: "1" });
  await Promise.all([server.connect(b), client.connect(a)]);
  clients.push(client);
  return { client, fetch };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});
it("discovers every explicit AI operation and no discarded managed tools", async () => {
  const { client } = await connect();
  const tools = (await client.listTools()).tools;
  const ai = tools.filter((t) => t.name.startsWith("ai_"));
  expect(ai).toHaveLength(AI_OPERATIONS.length);
  expect(ai.every((t) => t.outputSchema)).toBe(true);
  expect(
    tools.some(
      (t) => t.name === "create_agent" || t.name === "list_agent_models",
    ),
  ).toBe(false);
  expect(
    ai.find((t) => t.name === "ai_proposals_decide")!.description,
  ).toContain("NOVA versão");
  expect(
    ai.find((t) => t.name === "ai_notices_test")!.inputSchema.properties,
  ).toHaveProperty("confirm_send");
});
it("keeps opaque revision, version and nested tools exactly; no implicit activation", async () => {
  const { client, fetch } = await connect({
    data: { agent_id: id, version_id: id, revision },
  });
  const args = {
    customer_id: id,
    id,
    name: "Agente",
    expected_revision: revision,
    config: {
      system_prompt: "Olá\n🌊",
      tool_ids: ["knowledge.search"],
      operator: { enabled: false },
    },
  };
  const result = await client.callTool({
    name: "ai_agents_save_draft",
    arguments: args,
  });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toEqual({
    data: { agent_id: id, version_id: id, revision },
  });
  const { id: _, ...body } = args;
  expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toEqual(body);
  expect(fetch).toHaveBeenCalledOnce();
});
it.each([
  [
    "ai_agents_preview",
    {
      customer_id: id,
      id,
      version_id: id,
      messages: [{ role: "user", content: "Oi" }],
    },
  ],
  [
    "ai_notices_test",
    { customer_id: id, operation_key: id, confirm_send: false },
  ],
  [
    "ai_credentials_revalidate",
    { customer_id: id, id, expected_revision: 9007199254740992 },
  ],
  [
    "ai_proposals_decide",
    { customer_id: id, id, expected_revision: 1, decision: "auto" },
  ],
])("rejects incomplete or unsafe %s before HTTP", async (name, args) => {
  const { client, fetch } = await connect();
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it("passes API approvals without spoofed user identity and never retries unknown", async () => {
  const { client, fetch } = await connect(
    { error: { code: "unknown", message: "Confira recibo" } },
    409,
  );
  const result = await client.callTool({
    name: "ai_followups_resolve_effect",
    arguments: {
      customer_id: id,
      id,
      outcome: "sent",
      note: "Recibo confirmado na Meta",
      wamid: "wamid.real",
    },
  });
  expect(result.isError).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
  expect(
    JSON.parse(fetch.mock.calls[0]![1]?.body as string),
  ).not.toHaveProperty("actor_id");
});
it("imports authorized bytes without access to server filesystem and returns safe 204", async () => {
  const { client, fetch } = await connect();
  const result = await client.callTool({
    name: "ai_skills_import_zip",
    arguments: {
      customer_id: id,
      file_name: "skill.zip",
      file_base64: "UEsA/w==",
    },
  });
  expect(result.isError).not.toBe(true);
  expect(
    new Uint8Array(await (fetch.mock.calls[1]![1]!.body as Blob).arrayBuffer()),
  ).toEqual(new Uint8Array([80, 75, 0, 255]));
  expect(fetch.mock.calls[1]![1]!.headers).not.toHaveProperty("Authorization");
  const empty = await connect(undefined, 204);
  const removed = await empty.client.callTool({
    name: "ai_credentials_remove",
    arguments: { customer_id: id, id, expected_revision: revision },
  });
  expect(removed.isError).not.toBe(true);
  expect(removed.structuredContent).toEqual({ success: true });
});
it("accepts the real manual follow-up wire graph and explicit allow policy", async () => {
  const { client, fetch } = await connect();
  const graph = {
    nodes: [
      {
        id: "start",
        type: "trigger",
        label: "Início",
        position: { x: 0, y: 0 },
        config: {},
      },
      {
        id: "end",
        type: "end",
        label: "Fim",
        position: { x: 200, y: 0 },
        config: { outcome: "exhausted" },
      },
    ],
    edges: [
      {
        id: "edge",
        source: "start",
        target: "end",
        priority: 0,
        condition: { type: "always" },
      },
    ],
  };
  const args = {
    customer_id: id,
    name: "Retorno",
    graph,
    settings: {
      trigger: { kind: "manual" },
      handoff_policy: "allow",
      send_start_hour: 9,
      send_end_hour: 18,
      send_days: [1],
      timezone: "America/Sao_Paulo",
      purpose: "utility",
      environment: "live",
    },
  };
  const result = await client.callTool({
    name: "ai_followup_flows_create",
    arguments: args,
  });
  expect(result.isError).not.toBe(true);
  expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toEqual(args);
});

it("rejects purpose bindings owned by versioned agents and routers", async () => {
  const { client, fetch } = await connect();
  for (const purpose of ["agent_turn", "agent_operator", "router"]) {
    const r = await client.callTool({
      name: "ai_providers_save_binding",
      arguments: {
        customer_id: id,
        purpose,
        provider: "openai",
        model: "gpt-4.1-mini",
        credential_id: id,
      },
    });
    expect(r.isError).toBe(true);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("preserves PDF media type so the knowledge extractor can index it", async () => {
  const { client, fetch } = await connect();
  const r = await client.callTool({
    name: "ai_knowledge_upload",
    arguments: {
      customer_id: id,
      name: "Documento",
      file_name: "catalogo.pdf",
      file_base64: Buffer.from("%PDF-1.4 test").toString("base64"),
    },
  });
  expect(r.isError).not.toBe(true);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body)).mime_type).toBe(
    "application/pdf",
  );
});
it("discovers explicit case reply/consult and reviewed knowledge tools with public schemas", async () => {
  const { client, fetch } = await connect();
  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name);
  expect(names).toContain("ai_cases_reply");
  expect(names).toContain("ai_cases_consult");
  expect(names).toContain("ai_knowledge_conversation_preview");
  expect(names).toContain("ai_skills_install");
  const reply = listed.tools.find((t) => t.name === "ai_cases_reply")!;
  expect(reply.description).toContain("Decisão humana explícita");
  expect(
    (
      await client.callTool({
        name: "ai_cases_reply",
        arguments: {
          customer_id: id,
          id,
          expected_revision: 1,
          operation_key: id,
          action: "need_lead_info",
          body: "Qual é o pedido?",
        },
      })
    ).isError,
  ).not.toBe(true);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toMatchObject({
    operation_key: id,
    action: "need_lead_info",
  });
  expect(
    (
      await client.callTool({
        name: "ai_cases_consult",
        arguments: { customer_id: id, id, operation_key: id, question: "x" },
      })
    ).isError,
  ).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
});
it("accepts case capability and explicit media settings in version configuration", async () => {
  const { client, fetch } = await connect();
  expect(
    (
      await client.callTool({
        name: "ai_agents_create",
        arguments: {
          customer_id: id,
          name: "Suporte",
          config: {
            tool_ids: ["cases.update"],
            media: {
              images_enabled: true,
              documents_enabled: true,
              video_frames_enabled: false,
            },
          },
        },
      })
    ).isError,
  ).not.toBe(true);
  expect(
    JSON.parse(String(fetch.mock.calls[0]![1]?.body)).config.media
      .video_frames_enabled,
  ).toBe(false);
});
