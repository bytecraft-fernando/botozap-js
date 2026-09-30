import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerMessages } from "../src/commands/messages.js";
import { run } from "./helpers.js";

const fetch = vi.fn();
const json = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1", "-o", "json"];
const sent = { id: null, wamid: "wamid.x", to: "5511999999999", status: "sent" };

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    query: Object.fromEntries(parsed.searchParams),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  fetch.mockReset().mockImplementation(async () => Response.json(sent, { status: 201 }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("messages — tipos novos", () => {
  it("send-interactive com --json", async () => {
    const interactive = { type: "cta_url", body: { text: "Veja" }, action: { name: "cta_url", parameters: { display_text: "Abrir", url: "https://x.test" } } };
    const r = await run(registerMessages, ["messages", "send-interactive", "--to", "5511999999999", "--json", JSON.stringify(interactive), ...json]);
    expect(r.error).toBeUndefined();
    expect(request().body).toEqual({ to: "5511999999999", type: "interactive", interactive });
  });

  it("send-location converte coordenadas", async () => {
    await run(registerMessages, ["messages", "send-location", "--to", "5511999999999", "--latitude", "-3.1", "--longitude", "-60", "--name", "Loja", ...json]);
    expect(request().body).toEqual({ to: "5511999999999", type: "location", location: { latitude: -3.1, longitude: -60, name: "Loja" } });
  });

  it("react --remove manda emoji vazio", async () => {
    await run(registerMessages, ["messages", "react", "--to", "5511999999999", "--message-id", "wamid.in", "--remove", ...json]);
    expect(request().body).toEqual({ to: "5511999999999", type: "reaction", reaction: { message_id: "wamid.in", emoji: "" } });
  });

  it("list --sort event_at e recusa valor inválido antes do HTTP", async () => {
    fetch.mockImplementation(async () => Response.json({ data: [], paging: { next: null, previous: null, has_more: false } }));
    await run(registerMessages, ["messages", "list", "--sort", "event_at", ...json]);
    expect(request().query.sort).toBe("event_at");
    const bad = await run(registerMessages, ["messages", "list", "--sort", "x", ...json]);
    expect(String(bad.error)).toContain("--sort");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
