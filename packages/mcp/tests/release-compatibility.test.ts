import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { MESSAGE_ID, CONVERSATION_ID, PHONE_ID } from "./contract-fixtures.js";
import { fullAccessIdentity } from "./helpers/identity.js";

type Schema = Record<string, any>;
const published = JSON.parse(readFileSync(new URL("./fixtures/release-0.6.0-tools.json", import.meta.url), "utf8")) as {
  provenance: Record<string, unknown>; tools: Array<{ name: string; inputSchema: Schema }>;
};
function resolve(schema: Schema, root: Schema): Schema {
  if (!schema.$ref) return schema;
  if (!schema.$ref.startsWith("#/")) throw new Error(`Unsupported reference: ${schema.$ref}`);
  return schema.$ref.slice(2).split("/").reduce((node: Schema, key: string) => node[key.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}
/** Conservative inclusion check: every input accepted by the release must still
 * be accepted. Unchanged constraints are allowed; unproved restrictions fail. */
function incompatibilities(previous: Schema, next: Schema, previousRoot: Schema, nextRoot: Schema, path = "$", depth = 0): string[] {
  if (depth > 100) throw new Error(`Schema reference recursion at ${path}`);
  const a = resolve(previous, previousRoot), b = resolve(next, nextRoot);
  const issues: string[] = [];
  const problem = (message: string) => issues.push(`${path}: ${message}`);
  if (a.anyOf || b.anyOf) {
    for (const [index, branch] of (a.anyOf ?? [a]).entries()) {
      const candidates = b.anyOf ?? [b];
      if (!candidates.some((candidate: Schema) => incompatibilities(branch, candidate, previousRoot, nextRoot, path, depth + 1).length === 0)) problem(`union branch ${index} no longer accepted`);
    }
    return issues;
  }
  const oldTypes = Array.isArray(a.type) ? a.type : a.type ? [a.type] : [];
  const newTypes = Array.isArray(b.type) ? b.type : b.type ? [b.type] : [];
  if (newTypes.length && (!oldTypes.length || oldTypes.some((type: string) => !newTypes.includes(type) && !(type === "integer" && newTypes.includes("number"))))) problem("type narrowed");
  if (b.enum && (!a.enum || a.enum.some((value: unknown) => !b.enum.some((candidate: unknown) => JSON.stringify(candidate) === JSON.stringify(value))))) problem("enum narrowed");
  if (b.const !== undefined && JSON.stringify(a.const) !== JSON.stringify(b.const)) problem("const added or changed");
  for (const key of ["format", "pattern", "multipleOf"]) if (b[key] !== undefined && b[key] !== a[key]) problem(`${key} added or changed`);
  for (const key of ["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"]) if (b[key] !== undefined && (a[key] === undefined || b[key] > a[key])) problem(`${key} increased`);
  for (const key of ["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"]) if (b[key] !== undefined && (a[key] === undefined || b[key] < a[key])) problem(`${key} decreased`);
  if (b.uniqueItems && !a.uniqueItems) problem("uniqueItems added");
  for (const key of b.required ?? []) if (!(a.required ?? []).includes(key)) problem(`new required property ${key}`);
  for (const [key, schema] of Object.entries(a.properties ?? {})) {
    if (!b.properties?.[key]) problem(`property ${key} removed`);
    else issues.push(...incompatibilities(schema as Schema, b.properties[key], previousRoot, nextRoot, `${path}.${key}`, depth + 1));
  }
  if (b.additionalProperties === false && a.additionalProperties !== false) problem("additional properties forbidden");
  if (typeof b.additionalProperties === "object") {
    if (typeof a.additionalProperties !== "object") problem("additional properties constrained");
    else issues.push(...incompatibilities(a.additionalProperties, b.additionalProperties, previousRoot, nextRoot, `${path}.*`, depth + 1));
  }
  for (const key of ["items", "propertyNames"]) if (b[key]) {
    if (!a[key]) problem(`${key} restriction added`);
    else issues.push(...incompatibilities(a[key], b[key], previousRoot, nextRoot, `${path}.${key}`, depth + 1));
  }
  for (const key of ["allOf", "oneOf", "not", "if", "then", "else", "dependentRequired", "contains"]) if (b[key] && JSON.stringify(a[key]) !== JSON.stringify(b[key])) problem(`${key} changed without compatibility proof`);
  return issues;
}

describe("published @botozap/mcp@0.6.0 input compatibility", () => {
  it("keeps every published tool and accepts its input contract for full live access", async () => {
    expect(published.provenance).toMatchObject({ version: "0.6.0", sha256: "6906fefc8a822619c5131b0eb0938de3f94274886ca74a83480110d0a0ca96b7", apiCalls: 0 });
    const server = await buildServer({ apiKey: "bz_live_compatibility", fetch: async () => { throw new Error("Catalogue collection must not call the API"); } }, fullAccessIdentity);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "release-compatibility", version: "1" });
    try {
      await Promise.all([server.connect(st), client.connect(ct)]);
      const current = new Map((await client.listTools()).tools.map(tool => [tool.name, tool]));
      const issues: string[] = [];
      for (const tool of published.tools) {
        const next = current.get(tool.name);
        if (!next) issues.push(`${tool.name}: published tool missing`);
        else issues.push(...incompatibilities(tool.inputSchema, next.inputSchema, tool.inputSchema, next.inputSchema).map(issue => `${tool.name} ${issue}`));
      }
      expect(issues).toEqual([]);
    } finally { await client.close(); await server.close(); }
  });
  it("executes all three legacy send tools without an idempotency key", async () => {
    const calls: Array<{ method: string; path: string; headers: Headers }> = [];
    const server = await buildServer({ apiKey: "bz_live_compatibility", baseUrl: "https://api.test/v1", fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method ?? "GET";
      calls.push({ method, path, headers: new Headers(init?.headers) });
      if (path === `/v1/conversations/${CONVERSATION_ID}`) return Response.json({ data: { phone_number_id: PHONE_ID, contact: { wa_id: "5511999999999" } } });
      if (path !== "/v1/messages" || method !== "POST") throw new Error("Unexpected legacy API call");
      return Response.json({ id: MESSAGE_ID, wamid: "wamid.compat", to: "5511999999999", status: "sent" });
    } }, fullAccessIdentity);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "legacy-send-compatibility", version: "1" });
    try {
      await Promise.all([server.connect(st), client.connect(ct)]);
      for (const [name, args] of [
        ["send_message", { to: "5511999999999", type: "text", text: { body: "Olá" } }],
        ["send_media_message", { to: "5511999999999", type: "image", link: "https://example.test/image.png" }],
        ["reply_to_conversation", { conversation_id: CONVERSATION_ID, text: { body: "Olá" } }],
      ] as const) {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError, `${name}: ${JSON.stringify(result)}`).not.toBe(true);
      }
      expect(calls.filter(call => call.method === "POST")).toHaveLength(3);
      expect(calls.every(call => !call.headers.has("idempotency-key"))).toBe(true);
    } finally { await client.close(); await server.close(); }
  });
  it("detects nested required additions, narrowing enums and string constraints", () => {
    for (const [a, b] of [
      [{ type: "object", properties: { x: { type: "object", properties: { y: { type: "string" } } } } }, { type: "object", properties: { x: { type: "object", required: ["y"], properties: { y: { type: "string" } } } } }],
      [{ type: "string", enum: ["a", "b"] }, { type: "string", enum: ["a"] }],
      [{ type: "string" }, { type: "string", minLength: 1 }],
    ]) expect(incompatibilities(a, b, a, b).length).toBeGreaterThan(0);
  });
});
