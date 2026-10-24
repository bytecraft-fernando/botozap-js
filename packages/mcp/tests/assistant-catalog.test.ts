/**
 * O que o perfil assistant (OAuth, app revisado do ChatGPT) anuncia: nome,
 * título, descrição, entrada, saída (com o erro estruturado) e anotações de
 * cada tool. Mudar qualquer um exige nova revisão da OpenAI; o snapshot torna a
 * mudança deliberada. Campos novos do catálogo completo não podem vazar aqui.
 * Descrição e schemas entram como sha256 para o snapshot apontar a tool e a
 * parte que mudou sem guardar o catálogo inteiro.
 */
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer, type ApiIdentity } from "../src/server.js";
import { MCP_TOOL_POLICIES } from "../src/permissions.js";
import { fullAccessIdentity } from "./helpers/identity.js";

vi.mock("node:fs/promises", async (original) => ({
  ...(await original<any>()),
  readFile: vi.fn(async () => '<main id="app"></main>'),
}));

const clientId = "e948ea06-d925-41b6-980c-d7ea3538a4ac";
const routes = [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => p.requiredRoutes ?? []))];
const oauth: ApiIdentity = {
  ...fullAccessIdentity, auth_type: "oauth", client_id: clientId,
  user_id: "operator", grant_id: "grant", allowed_routes: routes,
};
const clients: Client[] = [];
afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((c) => c.close()));
  vi.unstubAllEnvs();
});

const digest = (value: unknown) =>
  value === undefined ? undefined : createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function announced(ui: boolean) {
  vi.stubEnv("BOTOZAP_MCP_OAUTH_CLIENT_PROFILES", `${clientId}:assistant`);
  const fetch = vi.fn(async () => Response.json({ data: [] }));
  const server = await buildServer({ apiKey: "bz_live_test", baseUrl: "https://api.test/v1", uiEnabled: ui, fetch }, oauth);
  const client = new Client({ name: "assistant-catalog", version: "1" }, {
    capabilities: ui ? { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } as any : {},
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  clients.push(client);
  const tools = (await client.listTools()).tools;
  expect(fetch).not.toHaveBeenCalled();
  return Object.fromEntries(tools.map(({ name, title, description, inputSchema, outputSchema, annotations }) =>
    [name, { title, annotations, description: digest(description), inputSchema: digest(inputSchema), outputSchema: digest(outputSchema) }]));
}

describe("perfil assistant (OAuth/ChatGPT): definição anunciada congelada", () => {
  it.each([[true], [false]])("UI=%s", async (ui) => {
    expect(await announced(ui)).toMatchSnapshot();
  });
});
