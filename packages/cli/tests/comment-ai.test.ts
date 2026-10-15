import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerChannelAccounts } from "../src/commands/channel-accounts.js";
import { run } from "./helpers.js";
const fetch = vi.fn();
const summary = { enabled: false, agent_id: null, daily_limit: 50, status: "inactive", answered_today: 2, reserved_today: 3, timezone: "America/Sao_Paulo", gate_mode: "pre_go_live", readiness: ["Escolha um agente."] };
const base = ["--api-key", "bz_live_test", "--api-url", "https://api.test/v1", "-o", "json", "channel-accounts", "comment-ai"];
beforeEach(() => { fetch.mockReset().mockImplementation(async () => Response.json({ data: summary })); vi.stubGlobal("fetch", fetch); });
afterEach(() => vi.unstubAllGlobals());
it("get imprime configuração completa", async () => {
  const result = await run(registerChannelAccounts, [...base, "get", "conta/1"]);
  expect(result.error).toBeUndefined(); expect(JSON.parse(result.stdout)).toEqual(summary);
  expect(fetch).toHaveBeenCalledWith("https://api.test/v1/channel_accounts/conta%2F1/comment-ai", expect.objectContaining({ method: "GET" }));
});
it.each([
  [["--enabled", "true", "--agent", "agent", "--daily-limit", "200"], { enabled: true, agent_id: "agent", daily_limit: 200 }],
  [["--enabled", "false"], { enabled: false }],
  [["--agent", "null"], { agent_id: null }],
  [["--daily-limit", "1"], { daily_limit: 1 }],
])("set envia somente as flags informadas: %j", async (flags, patch) => {
  const result = await run(registerChannelAccounts, [...base, "set", "account", ...flags]);
  expect(result.error).toBeUndefined(); expect(JSON.parse(result.stdout)).toEqual(summary);
  expect(fetch).toHaveBeenCalledWith("https://api.test/v1/channel_accounts/account/comment-ai", expect.objectContaining({ method: "PATCH", body: JSON.stringify(patch) }));
});
it.each([[], ["--enabled", "yes"], ["--daily-limit", "0"], ["--daily-limit", "201"], ["--daily-limit", "2.5"], ["--daily-limit", "2x"], ["--daily-limit", "NaN"], ["--daily-limit", ""]].map(flags => [flags]))("set rejeita patch vazio ou inválido antes do HTTP: %j", async flags => {
  expect((await run(registerChannelAccounts, [...base, "set", "account", ...flags])).error).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});
it("runs preserva meta e paginação", async () => {
  const data = { data: [{ id: "run", status: "skipped", action: null, reason_message: "Regra tem prioridade", dm_status: "skipped", reply_status: "skipped" }], meta: { page: 2, per_page: 30, total_count: 31, total_pages: 2 } };
  fetch.mockResolvedValue(Response.json(data));
  const result = await run(registerChannelAccounts, [...base, "runs", "account", "--page", "2", "--per-page", "30"]);
  expect(result.error).toBeUndefined(); expect(JSON.parse(result.stdout)).toEqual(data);
  expect(fetch.mock.calls[0][0]).toBe("https://api.test/v1/channel_accounts/account/comment-ai/runs?page=2&per_page=30");
});
it("saída humana mostra prontidão e reservas", async () => {
  const result = await run(registerChannelAccounts, [...base, "get", "account", "-o", "human"]);
  expect(result.error).toBeUndefined(); expect(result.stdout).toContain("Escolha um agente."); expect(result.stdout).toContain("reserved_today");
});
it("set propaga restrição da API", async () => {
  fetch.mockResolvedValue(Response.json({ error: { code: "plan_restricted", message: "Plano sem IA" } }, { status: 422 }));
  expect((await run(registerChannelAccounts, [...base, "set", "account", "--enabled", "true"])).error).toMatchObject({ code: "plan_restricted", status: 422 });
});
