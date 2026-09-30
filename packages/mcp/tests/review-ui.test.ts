// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountReview } from "../web/panel.js";
const page = { page: 1, total_pages: 1, total_count: 1, per_page: 20 };
const conv = { id: "conversation", contact_id: "contact", channel: "whatsapp", status: "active", phone_number_id: "number", display_phone_number: "+55 92 0000", contact: { name: "Marina", phone: "+55 92 0010", wa_id: "55920010" }, window_expires_at: "2099-01-01T00:00:00Z" };
const data = (structuredContent: unknown) => ({ structuredContent });
const bootstrap = data({ account_id: "account", environment: "live", customers: { data: [{ id: "business", name: "Ateliê" }, { id: "other", name: "Outro negócio" }], meta: page } });
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function event(id: string, name: string) { $(id).dispatchEvent(new Event(name)); }
function harness(reply = vi.fn(async () => data({ id: null, wamid: "wamid.accepted", status: "accepted" }))) {
  const call = vi.fn(async (name: string) => {
    if (name === "open_review_panel") return bootstrap;
    if (name === "list_radar") return data({ data: [{ id: "opportunity", contact_id: "contact", customer_id: "business", entity_type: "opportunity", title: "Retornar orçamento" }], meta: page });
    if (name === "list_opportunity_conversations") return data({ data: [{ conversation_id: "conversation" }], meta: page });
    if (name === "get_conversation") return data(structuredClone({ data: conv }));
    if (name === "list_messages") return data({ data: [{ id: "message", direction: "inbound", content: { text: { body: '<img src=x onerror="window.pwned=true">' } }, created_at: "2026-09-29" }], paging: { next: null } });
    if (name === "reply_to_conversation") return reply();
    throw new Error(`Unexpected ${name}`);
  });
  const context = vi.fn(async () => {});
  const panel = mountReview(document.body, { call, context }); panel.bootstrap(bootstrap);
  return { call, context, panel, reply };
}
async function select() {
  $<HTMLSelectElement>("business").value = "business"; event("business", "change");
  await vi.waitFor(() => expect(document.querySelector(".radar-item")).not.toBeNull());
  (document.querySelector(".radar-item") as HTMLButtonElement).click();
  await vi.waitFor(() => expect($<HTMLTextAreaElement>("draft").disabled).toBe(false));
}
function review() {
  $<HTMLTextAreaElement>("draft").value = "Vou conferir o prazo."; event("draft", "input");
  $("review").click(); $<HTMLInputElement>("consent").checked = true; event("consent", "change");
}
beforeEach(() => { document.body.innerHTML = ""; HTMLElement.prototype.scrollIntoView = vi.fn(); });
describe("review UI safety", () => {
  it("renders contact content as text and never sends during preparation or cancel", async () => {
    const h = harness(); await select(); review(); $("edit").click();
    expect($("history").querySelector("img")).toBeNull(); expect($("history").textContent).toContain("<img");
    expect(h.reply).not.toHaveBeenCalled(); expect($("confirmation").hidden).toBe(true);
    expect(h.context).toHaveBeenCalled();
  });
  it("blocks double click and accepts provider receipt with null local id", async () => {
    const h = harness(); await select(); review(); $("send").click(); $("send").click();
    await vi.waitFor(() => expect(h.reply).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect($("notice").textContent).toContain("aceita"));
    expect($<HTMLTextAreaElement>("draft").value).toBe("");
  });
  it("keeps an uncertain attempt blocked even after reselecting its conversation", async () => {
    const h = harness(vi.fn(async () => { throw new Error("Connection lost after dispatch"); }));
    await select(); review(); $("send").click();
    await vi.waitFor(() => expect($("notice").textContent).toContain("incerto"));
    (document.querySelector(".radar-item") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(h.call.mock.calls.filter(([name]) => name === "get_conversation").length).toBeGreaterThanOrEqual(3));
    expect($<HTMLTextAreaElement>("draft").disabled).toBe(true); expect(h.reply).toHaveBeenCalledTimes(1);
  });
  it("does not send if the reviewed recipient changes before confirmation", async () => {
    const h = harness(); await select(); review();
    const original = h.call.getMockImplementation()!;
    h.call.mockImplementation(async name => name === "get_conversation" ? data({ data: { ...conv, contact_id: "different" } }) : original(name));
    $("send").click(); await vi.waitFor(() => expect($("notice").textContent).toContain("mudaram"));
    expect(h.reply).not.toHaveBeenCalled();
  });
  it("rejects an account change instead of retaining an enabled draft", async () => {
    const h = harness(); await select(); review();
    h.panel.bootstrap(data({ account_id: "other-account", environment: "live", customers: { data: [], meta: page } }));
    expect($<HTMLTextAreaElement>("draft").disabled).toBe(true); expect($("notice").textContent).toContain("conta mudou");
    expect(h.reply).not.toHaveBeenCalled();
  });
});
