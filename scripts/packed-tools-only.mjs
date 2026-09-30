import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AI_OPERATIONS } from "@botozap/sdk";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const API_KEY = "bz_live_packed_tools_only";
const requests = [];

const api = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  requests.push({
    authorization: request.headers.authorization,
    pathname: url.pathname,
  });

  if (request.method === "GET" && url.pathname === "/me") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: {
      account_id: "00000000-0000-4000-8000-000000000001",
      environment: "live",
      scopes: ["agents:read", "agents:write", "calendar:read", "calendar:write", "comment-rules:read", "comment-rules:write", "messages:send", "messages:read", "events:read", "conversations:read", "conversations:write", "contacts:read", "contacts:write", "appointments:read", "appointments:write", "journeys:write", "journeys:read", "templates:read", "templates:write", "numbers:read", "numbers:write", "webhooks:read", "webhooks:write", "customers:read", "customers:write", "media:read", "media:write", "broadcasts:read", "broadcasts:write", "saved_replies:read", "saved_replies:write", "crm:read", "crm:write", "inbox:read", "inbox:write", "team:read", "logs:read"],
    } }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/ai/agents") {
    assert.equal(url.searchParams.get("customer_id"), "11111111-1111-4111-8111-111111111111");
    response.writeHead(200,{"content-type":"application/json"});
    response.end(JSON.stringify({data:[],meta:{page:1,per_page:20,total_count:0,total_pages:0}}));return;
  }
  if (request.method === "GET" && url.pathname === "/messages") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        data: [],
        paging: {
          cursors: { before: null, after: null },
          next: null,
          previous: null,
        },
      }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      error: { code: "not_found", message: "fixture sem esta rota" },
    }),
  );
});

await new Promise((resolve, reject) => {
  api.once("error", reject);
  api.listen(0, "127.0.0.1", resolve);
});

const address = api.address();
assert(address && typeof address !== "string", "fixture HTTP sem porta");

const consumerRoot = path.dirname(fileURLToPath(import.meta.url));
const serverCommand = path.join(consumerRoot, "node_modules/.bin/botozap-mcp");
const transport = new StdioClientTransport({
  command: serverCommand,
  args: [],
  env: {
    ...getDefaultEnvironment(),
    BOTOZAP_MCP_UI_ENABLED: "false",
    OAUTH_ENABLED: "false",
    BOTOZAP_API_KEY: API_KEY,
    BOTOZAP_API_URL: `http://127.0.0.1:${address.port}`,
  },
  stderr: "pipe",
});
const client = new Client({ name: "packed-tools-only", version: "0.0.0" });
const watchdog = setTimeout(() => {
  process.stderr.write("clean tarball tools-only: timeout após 30s\n");
  process.exit(1);
}, 30_000);

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const baseline = JSON.parse(readFileSync(new URL("./release-0.6.0-tools.json", import.meta.url), "utf8"));
  const oldNames = new Set(baseline.tools.map(tool => tool.name));
  const currentNames = new Set(tools.tools.map(tool => tool.name));
  const added = [...currentNames].filter(name => !oldNames.has(name)).sort();
  const removed = [...oldNames].filter(name => !currentNames.has(name)).sort();
  process.stdout.write(`packed tools vs 0.6.0: ${JSON.stringify({ added, removed })}\n`);
  assert.deepEqual(added, ["get_profile", "prepare_send_intent"]);
  assert.deepEqual(removed, []);
  assert.equal(tools.tools.length, oldNames.size + added.length);
  for (const name of ["open_review_panel", "stage_review_reply"]) {
    assert(!currentNames.has(name), `UI tool exposed with UI disabled: ${name}`);
  }
  const resources = await client.listResources();
  assert(resources.resources.every(resource => !resource.uri.startsWith("ui://")), "UI resource exposed with UI disabled");
  const snake=(s)=>s.replace(/[A-Z]/g,c=>`_${c.toLowerCase()}`);
  for(const op of AI_OPERATIONS) assert(tools.tools.some(t=>t.name===`ai_${snake(op.group)}_${snake(op.name)}`));
  for (const name of [
    "prepare_send_intent",
    "get_profile",
    "get_inbox_tools",
    "list_saved_replies",
    "list_opportunities",
    "list_radar",
    "list_journeys",
    "list_appointments",
    "list_calendar_connections",
    "ai_agents_list",
    "ai_agents_preview",
    "ai_providers_models",
    "ai_followups_resolve_effect",
    "ai_eligibility_save_channel",
    "ai_commercial_proposals_decide",
    "ai_inferences_list",
    "control_conversation_agent",
  ]) {
    assert.ok(
      tools.tools.some((tool) => tool.name === name),
      `missing packed tool: ${name}`,
    );
  }
  assert(
    tools.tools.every((tool) => tool.outputSchema),
    "tool sem outputSchema",
  );
  assert(tools.tools.every((tool) =>
    ["readOnlyHint", "destructiveHint", "openWorldHint"].every((name) =>
      typeof tool.annotations?.[name] === "boolean")), "tool sem anotação explícita");
  assert.equal(client.getServerCapabilities()?.resources?.subscribe, true);
  const templates = await client.listResourceTemplates();
  assert(
    templates.resourceTemplates.some(
      (item) => item.uriTemplate === "botozap://events{?after,limit}",
    ),
  );
  assert(templates.resourceTemplates.every(resource => !resource.uriTemplate.startsWith("ui://")), "UI resource template exposed with UI disabled");
  const toolNames = new Set(tools.tools.map((tool) => tool.name));
  assert(toolNames.has("list_messages"));
  assert(toolNames.has("send_message"));
  assert(toolNames.has("reply_to_conversation"));
  assert(toolNames.has("send_media_message"));
  assert.equal(
    requests.length,
    1,
    "descoberta deve consultar apenas /me, sem I/O de Eventos",
  );

  assert.equal(requests[0].pathname, "/me");

  const result = await client.callTool({
    name: "list_messages",
    arguments: { limit: 1 },
  });
  assert.notEqual(result.isError, true);

  const expected = {
    data: [],
    paging: {
      cursors: { before: null, after: null },
      next: null,
      previous: null,
    },
  };
  assert.deepEqual(result.structuredContent, expected);

  const firstContent = result.content[0];
  assert(firstContent && firstContent.type === "text");
  assert.deepEqual(JSON.parse(firstContent.text), expected);
  assert.deepEqual(requests, [
    { authorization: `Bearer ${API_KEY}`, pathname: "/me" },
    { authorization: `Bearer ${API_KEY}`, pathname: "/messages" },
  ]);

  const aiResult=await client.callTool({name:"ai_agents_list",arguments:{customer_id:"11111111-1111-4111-8111-111111111111"}});
  assert.notEqual(aiResult.isError,true);
  assert.deepEqual(aiResult.structuredContent,{data:[],meta:{page:1,per_page:20,total_count:0,total_pages:0}});
  process.stdout.write(`clean tarball tools-only: ok (${AI_OPERATIONS.length} AI routes discovered)\n`);
} finally {
  await client.close().catch(() => {});
  await new Promise((resolve, reject) => {
    api.close((error) => (error ? reject(error) : resolve()));
  });
  clearTimeout(watchdog);
}
