import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerSetupLinks } from "../src/commands/setup-links.js";
import { buildProgram, run } from "./helpers.js";

const fetch = vi.fn();
const customerId = "33333333-3333-4333-8333-333333333333";
const linkId = "80000000-0000-4000-8000-000000000001";
const json = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1", "-o", "json"];

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  return {
    method: init?.method as string | undefined,
    path: parsed.pathname.replace(/^\/v1/, ""),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  fetch
    .mockReset()
    .mockImplementation(async () =>
      Response.json({ data: { id: linkId, status: "active", theme_config: null } }, { status: 201 }),
    );
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("setup-links create", () => {
  it("sends an empty body when no option is given", async () => {
    const result = await run(registerSetupLinks, ["setup-links", "create", "--customer", customerId, ...json]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({
      method: "POST",
      path: `/customers/${customerId}/setup_links`,
      body: {},
    });
  });

  it("sends connection types, language and redirect URLs as given", async () => {
    const result = await run(registerSetupLinks, [
      "setup-links", "create", "--customer", customerId,
      "--connection-types", "dedicated, coexistence",
      "--language", "pt_BR",
      "--success-redirect-url", "https://parceiro.example/ok?ref=42",
      "--failure-redirect-url", "https://parceiro.example/erro",
      ...json,
    ]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual({
      allowed_connection_types: ["dedicated", "coexistence"],
      language: "pt_BR",
      success_redirect_url: "https://parceiro.example/ok?ref=42",
      failure_redirect_url: "https://parceiro.example/erro",
    });
  });

  it("has no provision flag and documents the redirect statuses", () => {
    const program = buildProgram(registerSetupLinks);
    const create = program.commands
      .find((c) => c.name() === "setup-links")!
      .commands.find((c) => c.name() === "create")!;
    const flags = create.options.map((o) => o.long);
    expect(flags).not.toContain("--provision-phone-number");
    let help = "";
    create.configureOutput({ writeOut: (s) => (help += s) });
    create.outputHelp();
    expect(help).toContain("status=completed");
    expect(help).toContain("status=failed");
    expect(help).toContain("status=cancelled");
    expect(help).toContain("2048");
  });
});
