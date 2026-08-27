import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const API_KEY = "bz_sandbox_packed_tools_only";
const requests = [];

const api = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  requests.push({
    authorization: request.headers.authorization,
    pathname: url.pathname,
  });

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
const serverEntry = path.join(
  consumerRoot,
  "node_modules/@botozap/mcp/dist/index.js",
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: {
    ...getDefaultEnvironment(),
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
  const toolNames = new Set(tools.tools.map((tool) => tool.name));
  assert(toolNames.has("list_messages"));
  assert(toolNames.has("send_message"));
  assert(toolNames.has("reply_to_conversation"));
  assert(toolNames.has("send_media_message"));
  assert.equal(requests.length, 0, "descoberta de tools iniciou I/O de Eventos");

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
    { authorization: `Bearer ${API_KEY}`, pathname: "/messages" },
  ]);

  process.stdout.write("clean tarball tools-only: ok\n");
} finally {
  await client.close().catch(() => {});
  await new Promise((resolve, reject) => {
    api.close((error) => (error ? reject(error) : resolve()));
  });
  clearTimeout(watchdog);
}
