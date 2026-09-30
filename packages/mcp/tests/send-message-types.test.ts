import { describe, expect, it } from "vitest";
import { sendMessageSchema } from "../src/tools/messages.js";

describe("MCP — send_message tipos novos", () => {
  it("aceita interactive, location e reaction com o payload do tipo", () => {
    expect(sendMessageSchema.safeParse({ to: "5511", type: "interactive", interactive: { type: "button" } }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ to: "5511", type: "location", location: { latitude: 1, longitude: 2 } }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ to: "5511", type: "reaction", reaction: { message_id: "wamid.x", emoji: "" } }).success).toBe(true);
  });

  it("recusa payload ausente ou misturado", () => {
    const missing = sendMessageSchema.safeParse({ to: "5511", type: "reaction" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toContain("reaction");
    const mixed = sendMessageSchema.safeParse({ to: "5511", type: "location", location: { latitude: 1, longitude: 2 }, text: { body: "x" } });
    expect(mixed.success).toBe(false);
    expect(sendMessageSchema.safeParse({ to: "5511", type: "location", location: { latitude: 91, longitude: 0 } }).success).toBe(false);
  });
});
