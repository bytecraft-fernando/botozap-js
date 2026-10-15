import { describe, expect, it, vi } from "vitest";
import { BotoZap, type InstagramCommentAi, type InstagramCommentAiRun, type InstagramCommentAiRepliedEvent, type MessageContent, type AiExecution } from "../src/index.js";

const summary: InstagramCommentAi = { enabled: false, agent_id: null, daily_limit: 50, status: "inactive", answered_today: 2, reserved_today: 3, timezone: "America/Sao_Paulo", gate_mode: "pre_go_live", readiness: ["Escolha um agente publicado."] };
const run: InstagramCommentAiRun = { id: "run", comment_id: "1789", comment_text: null, author_username: null, media_id: null, execution_id: null, status: "skipped", action: null, reason: "rule_won", reason_message: "Regra tem prioridade", reply_text: null, dm_status: "skipped", reply_status: "skipped", created_at: "2026-10-15T12:00:00Z", completed_at: null };
function setup(responses: Response[]) {
  const fetch = vi.fn(async () => { const response = responses.shift(); if (!response) throw Error("requisição inesperada"); return response; });
  return { fetch, api: new BotoZap({ apiKey: "bz_live_test", baseUrl: "https://api.test/v1", fetch }) };
}
describe("IA de comentários", () => {
  it("GET codifica o canal e preserva uso, gate e prontidão", async () => {
    const { api, fetch } = setup([Response.json({ data: summary })]);
    expect(await api.channelAccounts.getCommentAi("conta/1")).toEqual(summary);
    expect(fetch).toHaveBeenCalledWith("https://api.test/v1/channel_accounts/conta%2F1/comment-ai", expect.objectContaining({ method: "GET", body: undefined, headers: expect.objectContaining({ Authorization: "Bearer bz_live_test" }) }));
  });
  it.each([{ enabled: false }, { enabled: true, agent_id: "agent", daily_limit: 200 }, { agent_id: null }, { daily_limit: 1 }])("PATCH parcial preserva valores explícitos: %j", async patch => {
    const { api, fetch } = setup([Response.json({ data: summary })]);
    expect(await api.channelAccounts.updateCommentAi("conta/1", patch)).toEqual(summary);
    expect(fetch).toHaveBeenCalledWith("https://api.test/v1/channel_accounts/conta%2F1/comment-ai", expect.objectContaining({ method: "PATCH", body: JSON.stringify(patch) }));
  });
  it.each([{}, { page: 2, per_page: 30 }])("runs mantém paginação offset e campos nulos: %j", async params => {
    const response = { data: [run], meta: { page: 2, per_page: 30, total_count: 31, total_pages: 2 } };
    const { api, fetch } = setup([Response.json(response)]);
    expect(await api.channelAccounts.listCommentAiRuns("conta/1", params)).toEqual(response);
    const url = new URL((fetch.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe("/v1/channel_accounts/conta%2F1/comment-ai/runs");
    expect(Object.fromEntries(url.searchParams)).toEqual("page" in params ? { page: "2", per_page: "30" } : {});
  });
  it.each([[404, "not_found"], [422, "plan_restricted"], [422, "agent_unavailable"], [422, "credential_unavailable"], [422, "invalid_request"], [403, "forbidden"]])("preserva erro HTTP %s %s", async (status, code) => {
    const { api } = setup([Response.json({ error: { code, message: "Indisponível" } }, { status: Number(status) })]);
    await expect(api.channelAccounts.updateCommentAi("account", { enabled: true })).rejects.toMatchObject({ status, code });
  });
  it.each([0.002, null, undefined])("execuções preservam custo opcional %s e finish_reason comment_ai_*", async cost => {
    const execution = { id: "exec", source: "live", finish_reason: "comment_ai_skipped", ...(cost !== undefined ? { estimated_cost_usd: cost } : {}) };
    const { api } = setup([Response.json({ data: execution })]);
    const actual: AiExecution = await api.ai.executions.get({ id: "exec", agent_id: "agent", customer_id: "customer" });
    expect(actual).toEqual(execution);
    if (cost === undefined) expect(actual).not.toHaveProperty("estimated_cost_usd");
  });
  it("tipa o evento público e o conteúdo da Private Reply sem inventar automation na DM", () => {
    const data: InstagramCommentAiRepliedEvent["data"] = { channel: "instagram", channel_account: { id: "channel", channel: "instagram", display: "@loja" }, external_id: "1789", comment: { id: "1789", reply_id: "reply", text: "Abrimos às 9h.", timestamp: "2026-10-15T12:00:00Z" }, automation: { kind: "instagram_comment_ai", execution_id: "exec", comment_id: "1789" } };
    const content: MessageContent = { body: "Olá!", source: "agent", ai_execution_id: "exec", comment_id: "1789" };
    expect(data.automation.execution_id).toBe(content.ai_execution_id);
  });
});
