/**
 * Contrato protocolar das saídas estruturadas do MCP.
 *
 * O seam é público: um Client MCP real descobre as tools e as chama por um
 * transporte em memória. O fetch é o único adapter substituído e responde com
 * fixtures fiéis às rotas /v1 do core.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import {
  CONNECTION_ID,
  CUSTOMER_ID,
  MESSAGE_ID,
  PHONE_ID,
  TEMPLATE_ID,
  cursorPagingFixture,
  messageFixture,
  offsetMetaFixture,
} from "./contract-fixtures.js";

const API_KEY = "bz_live_integração_secreta_123";
const BASE_URL = "https://api.test/v1";

const phoneNumber = {
  id: PHONE_ID,
  phone_number_id: "1279498075235551",
  display_phone_number: "+55 11 99999-9999",
  verified_name: "BotoZap",
  quality_rating: "GREEN",
  type: "customer_owned",
  waba_connection_id: CONNECTION_ID,
  customer_id: CUSTOMER_ID,
  waba_id: "4207187232868022",
  connection_status: "active",
  token_status: "valid",
  created_at: "2026-08-25T12:00:00.000Z",
};

const template = {
  id: TEMPLATE_ID,
  name: "boas_vindas",
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  meta_template_id: "987654321",
  components: [{ type: "BODY", text: "Olá" }],
  waba_connection_id: CONNECTION_ID,
  created_at: "2026-08-25T12:00:00.000Z",
  last_synced_at: "2026-08-25T12:01:00.000Z",
};

const calls: Array<{ method: string; path: string }> = [];

const fetchStub = (async (input: unknown, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : String(input));
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname.replace(/^\/v1/, "");
  calls.push({ method, path });

  if (method === "GET" && path === "/templates/missing") {
    return jsonResponse(404, {
      error: {
        code: "not_found",
        message: `Template não encontrado. Credencial ${API_KEY}`,
      },
    });
  }
  if (method === "POST" && path === "/messages") {
    return jsonResponse(201, {
      id: MESSAGE_ID,
      wamid: messageFixture.wamid,
      to: "5511999999999",
      sent_to: "5511999999999",
      status: "sent",
    });
  }
  if (method === "GET" && path === "/messages") {
    return jsonResponse(200, {
      data: [messageFixture],
      paging: cursorPagingFixture,
    });
  }
  if (method === "GET" && path === `/messages/${MESSAGE_ID}`) {
    return jsonResponse(200, { data: messageFixture });
  }
  if (method === "GET" && path === "/phone_numbers") {
    return jsonResponse(200, { data: [phoneNumber], meta: offsetMetaFixture });
  }
  if (method === "GET" && path === `/phone_numbers/${PHONE_ID}/health`) {
    return jsonResponse(200, {
      data: {
        status: "healthy",
        timestamp: "2026-08-25T12:00:00.000Z",
        checks: { token_validity: "valid" },
      },
    });
  }
  if (method === "GET" && path === `/phone_numbers/${PHONE_ID}`) {
    return jsonResponse(200, { data: phoneNumber });
  }
  if (method === "GET" && path === "/templates") {
    return jsonResponse(200, { data: [template], meta: offsetMetaFixture });
  }
  if (method === "GET" && path === `/templates/${TEMPLATE_ID}`) {
    return jsonResponse(200, { data: template });
  }
  if (method === "POST" && path === "/templates") {
    return jsonResponse(201, { data: template });
  }

  return jsonResponse(500, {
    error: { code: "unexpected_test_request", message: `${method} ${path}` },
  });
}) as typeof fetch;

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function connect(fetchImpl: typeof fetch = fetchStub): Promise<Client> {
  const server = buildServer({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    fetch: fetchImpl,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "structured-output-test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.find((item) => item.type === "text")?.text ?? "";
}

function listItemProperties(tool: {
  outputSchema?: { properties?: Record<string, unknown> };
}): Record<string, { description?: string }> | undefined {
  const data = tool.outputSchema?.properties?.data as
    | { items?: { properties?: Record<string, { description?: string }> } }
    | undefined;
  return data?.items?.properties;
}

const callsByTool = [
  [
    "send_message",
    { to: "5511999999999", type: "text", text: { body: "olá" } },
  ],
  ["list_messages", { limit: 20 }],
  ["get_message", { id: MESSAGE_ID }],
  ["list_phone_numbers", { page: 1, per_page: 20 }],
  ["get_phone_number", { id: PHONE_ID }],
  ["phone_number_health", { id: PHONE_ID }],
  ["list_templates", { page: 1, per_page: 20 }],
  ["get_template", { id: TEMPLATE_ID }],
  [
    "create_template",
    {
      name: template.name,
      language: template.language,
      category: template.category,
      components: template.components,
      waba_connection_id: CONNECTION_ID,
    },
  ],
] as const;

describe("MCP — output schemas e structured content", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("anuncia schemas não vazios para as nove tools centrais e distingue os IDs de Número", async () => {
    const client = await connect();
    const discovery = await client.listTools();
    const centralNames = callsByTool.map(([name]) => name);
    const centralTools = discovery.tools.filter((tool) => centralNames.includes(tool.name));

    expect(centralTools.map((tool) => tool.name)).toEqual(centralNames);
    for (const tool of centralTools) {
      expect(tool.inputSchema.properties, `${tool.name} inputSchema`).toBeDefined();
      expect(tool.outputSchema, `${tool.name} outputSchema`).toBeDefined();
      expect(tool.outputSchema?.properties, `${tool.name} outputSchema`).toBeDefined();
      expect(Object.keys(tool.outputSchema?.properties ?? {}), `${tool.name} outputSchema`).not.toHaveLength(0);
    }

    const numberList = centralTools.find((tool) => tool.name === "list_phone_numbers");
    const itemProperties = numberList ? listItemProperties(numberList) : undefined;
    expect(itemProperties?.id?.description).toContain("UUID interno");
    expect(itemProperties?.phone_number_id?.description).toContain("ID Meta");

    expect(
      Object.fromEntries(
        centralTools.map((tool) => [
          tool.name,
          { inputSchema: tool.inputSchema, outputSchema: tool.outputSchema },
        ]),
      ),
    ).toMatchSnapshot();
  });

  it("devolve structuredContent validado e mantém o JSON textual idêntico", async () => {
    const client = await connect();
    await client.listTools();

    for (const [name, args] of callsByTool) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBeFalsy();
      expect(result.structuredContent, name).toEqual(JSON.parse(textOf(result)));
    }
  });

  it("mantém isError e expõe code, message e status sem credencial", async () => {
    const client = await connect();
    await client.listTools();

    const result = await client.callTool({
      name: "get_template",
      arguments: { id: "missing" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Erro [not_found]: Template não encontrado. Credencial [credencial removida]",
    );
    expect(result.structuredContent).toEqual({
      error: {
        code: "not_found",
        message: "Template não encontrado. Credencial [credencial removida]",
        status: 404,
      },
    });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("converte uma resposta que viola o output schema em erro da tool", async () => {
    const malformedFetch = (async () =>
      jsonResponse(200, {
        data: [{ id: MESSAGE_ID }],
        paging: cursorPagingFixture,
      })) as typeof fetch;
    const client = await connect(malformedFetch);
    await client.listTools();

    const result = await client.callTool({
      name: "list_messages",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("output schema");
  });
});
