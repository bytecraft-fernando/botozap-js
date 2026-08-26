import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";

const API_KEY = "bz_live_media_mcp_secreta";
const BASE_URL = "https://api.test/v1";
const clients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
});

async function connect(fetchImpl: typeof fetch): Promise<Client> {
  const server = buildServer({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchImpl });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "send-media-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

describe("MCP — send_media_message", () => {
  it("anuncia o contrato de mídia e seus limites sem degradar o schema", async () => {
    const client = await connect((async () => {
      throw new Error("fetch não deve ser chamado na descoberta");
    }) as typeof fetch);

    const discovery = await client.listTools();
    const tool = discovery.tools.find((item) => item.name === "send_media_message");

    expect(tool).toBeDefined();
    expect(tool?.inputSchema).toMatchObject({
      type: "object",
      required: ["to", "type", "link"],
      properties: {
        to: { type: "string" },
        from: { type: "string" },
        type: { type: "string", enum: ["image", "video", "audio", "document"] },
        link: {
          type: "string",
          maxLength: 2048,
          format: "uri",
          pattern: "^https:\\/\\/",
        },
        caption: { type: "string", minLength: 1, maxLength: 1024 },
        filename: { type: "string", maxLength: 240 },
      },
    });
    expect(tool?.outputSchema?.properties).toBeDefined();
    expect(Object.keys(tool?.outputSchema?.properties ?? {})).not.toHaveLength(0);
    expect({
      inputSchema: tool?.inputSchema,
      outputSchema: tool?.outputSchema,
    }).toMatchSnapshot();
  });

  it("delega image, video, audio e document ao POST /messages sem baixar a mídia", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const client = await connect((async (input, init) => {
      requests.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse(201, {
        id: "10000000-0000-4000-8000-000000000001",
        wamid: `wamid.media.${requests.length}`,
        to: "5511999999999",
        status: "sent",
      });
    }) as typeof fetch);

    const calls = [
      {
        type: "image",
        link: "https://cdn.example.test/foto.jpg",
        caption: "Foto",
      },
      {
        type: "video",
        link: "https://cdn.example.test/demo.mp4",
        caption: "Vídeo",
      },
      {
        type: "audio",
        link: "https://cdn.example.test/audio.ogg",
      },
      {
        type: "document",
        link: "https://cdn.example.test/fatura.pdf",
        caption: "Fatura",
        filename: "fatura.pdf",
      },
    ] as const;

    for (const args of calls) {
      const result = await client.callTool({
        name: "send_media_message",
        arguments: { to: "+5511999999999", from: "1279498075235551", ...args },
      });
      expect(result.isError, args.type).toBeFalsy();
      expect(result.structuredContent, args.type).toMatchObject({
        wamid: expect.stringMatching(/^wamid\.media\./),
        status: "sent",
      });
      expect(JSON.stringify(result), args.type).not.toContain(API_KEY);
    }

    expect(requests).toEqual([
      {
        url: `${BASE_URL}/messages`,
        body: {
          to: "+5511999999999",
          from: "1279498075235551",
          type: "image",
          image: { link: "https://cdn.example.test/foto.jpg", caption: "Foto" },
        },
      },
      {
        url: `${BASE_URL}/messages`,
        body: {
          to: "+5511999999999",
          from: "1279498075235551",
          type: "video",
          video: { link: "https://cdn.example.test/demo.mp4", caption: "Vídeo" },
        },
      },
      {
        url: `${BASE_URL}/messages`,
        body: {
          to: "+5511999999999",
          from: "1279498075235551",
          type: "audio",
          audio: { link: "https://cdn.example.test/audio.ogg" },
        },
      },
      {
        url: `${BASE_URL}/messages`,
        body: {
          to: "+5511999999999",
          from: "1279498075235551",
          type: "document",
          document: {
            link: "https://cdn.example.test/fatura.pdf",
            caption: "Fatura",
            filename: "fatura.pdf",
          },
        },
      },
    ]);
  });

  it("rejeita caption em audio e filename fora de document antes do request", async () => {
    let fetches = 0;
    const client = await connect((async () => {
      fetches += 1;
      throw new Error("não deveria chamar a API");
    }) as typeof fetch);

    const audio = await client.callTool({
      name: "send_media_message",
      arguments: {
        to: "5511999999999",
        type: "audio",
        link: "https://cdn.example.test/audio.ogg",
        caption: "inválida",
      },
    });
    const image = await client.callTool({
      name: "send_media_message",
      arguments: {
        to: "5511999999999",
        type: "image",
        link: "https://cdn.example.test/foto.jpg",
        filename: "foto.jpg",
      },
    });

    expect(fetches).toBe(0);
    for (const result of [audio, image]) {
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: { code: "tool_error", status: 0 },
      });
      expect(JSON.stringify(result)).not.toContain(API_KEY);
    }
  });

  it("rejeita URL, caption e filename fora dos limites antes do request", async () => {
    let fetches = 0;
    const client = await connect((async () => {
      fetches += 1;
      throw new Error("não deveria chamar a API");
    }) as typeof fetch);
    const invalid = [
      {
        to: "5511999999999",
        type: "image",
        link: "http://cdn.example.test/foto.jpg",
      },
      {
        to: "5511999999999",
        type: "image",
        link: `https://cdn.example.test/${"a".repeat(2049)}`,
      },
      {
        to: "5511999999999",
        type: "video",
        link: "https://cdn.example.test/demo.mp4",
        caption: "a".repeat(1025),
      },
      {
        to: "5511999999999",
        type: "document",
        link: "https://cdn.example.test/fatura.pdf",
        filename: "a".repeat(241),
      },
    ];

    for (const args of invalid) {
      const result = await client.callTool({
        name: "send_media_message",
        arguments: args,
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain(API_KEY);
    }
    expect(fetches).toBe(0);
  });

  it("estrutura erro da API/Meta e remove credenciais", async () => {
    const client = await connect((async () =>
      jsonResponse(422, {
        error: {
          code: "meta_error",
          message: `Meta 131042 recusou Bearer ${API_KEY}`,
        },
      })) as typeof fetch);

    const result = await client.callTool({
      name: "send_media_message",
      arguments: {
        to: "5511999999999",
        type: "image",
        link: "https://cdn.example.test/foto.jpg",
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: "meta_error",
        message: "Meta 131042 recusou Bearer [credencial removida]",
        status: 422,
      },
    });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
