import { expect, it, vi } from "vitest";
import { BotoZap } from "../src/index.js";
const id = "11111111-1111-4111-8111-111111111111";
function client() {
  const fetch = vi.fn(async () => Response.json({ data: { id, wa_id: "5592999990000", tags: ["vip"] } }));
  return { fetch, c: new BotoZap({ apiKey: "bz_live_fake", baseUrl: "https://example.test/v1", fetch }) };
}
it("sends tags on create and exposes them on the returned contact", async () => {
  const { c, fetch } = client();
  const contact = await c.contacts.create({ wa_id: "5592999990000", tags: ["vip", "Retorno"] });
  expect(contact.tags).toEqual(["vip"]);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).tags).toEqual(["vip", "Retorno"]);
});
it("keeps replace and incremental tag patches as sent", async () => {
  const { c, fetch } = client();
  await c.contacts.update(id, { tags: [] });
  await c.contacts.update(id, { add_tags: ["vip"], remove_tags: ["frio"] });
  await c.contacts.update(id, { profile_name: "Ana" } as Record<string, unknown>);
  const bodies = fetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
  expect(bodies).toEqual([{ tags: [] }, { add_tags: ["vip"], remove_tags: ["frio"] }, { profile_name: "Ana" }]);
});
