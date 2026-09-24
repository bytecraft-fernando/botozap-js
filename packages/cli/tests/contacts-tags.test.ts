import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerContacts } from "../src/commands/contacts.js";
import { run } from "./helpers.js";
const fetch = vi.fn(),
  id = "11111111-1111-4111-8111-111111111111";
const flags = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1", "-o", "json"];
beforeEach(() => {
  fetch.mockReset().mockImplementation(async () => Response.json({ data: { id, tags: ["vip"] } }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

it("creates a contact with repeatable tags", async () => {
  const result = await run(registerContacts, [
    "contacts", "create", "--wa-id", "5592999990000", "--tag", "vip", "--tag", "Retorno", ...flags,
  ]);
  expect(result.error).toBeUndefined();
  expect(JSON.parse(fetch.mock.calls[0]![1].body).tags).toEqual(["vip", "Retorno"]);
});

it("keeps create without tags unchanged", async () => {
  await run(registerContacts, ["contacts", "create", "--wa-id", "5592999990000", ...flags]);
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).not.toHaveProperty("tags");
});

it("adds and removes tags without replacing the list", async () => {
  const result = await run(registerContacts, [
    "contacts", "update", id, "--add-tag", "vip", "--remove-tag", "frio", ...flags,
  ]);
  expect(result.error).toBeUndefined();
  expect(fetch.mock.calls[0]![1].method).toBe("PATCH");
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ add_tags: ["vip"], remove_tags: ["frio"] });
});

it("rejects replacing and editing tags together before HTTP", async () => {
  const result = await run(registerContacts, [
    "contacts", "update", id, "--tag", "a", "--add-tag", "b", ...flags,
  ]);
  expect(String(result.error)).toContain("não os dois");
  expect(fetch).not.toHaveBeenCalled();
});
