/**
 * Schema da tool MCP `send_message`: o `type` precisa casar com o payload.
 *
 * O contrato da rota (src/app/api/v1/messages/route.ts) rejeita:
 *  - type='text' sem `text.body` (422 missing_text)
 *  - type='template' sem `template.name` (422 missing_template)
 * ...mas devolve o erro só DEPOIS do round-trip HTTP. Como o MCP é consumido por
 * AGENTES, validamos a combinação ANTES de chamar a API, com mensagem PT-BR clara
 * (o agente lê o erro). Este schema é o `superRefine` exportado por messages.ts.
 *
 * Regra: type='text' exige `text` e proíbe `template`; type='template' exige
 * `template` (name + language.code, já validados pelo shape base) e proíbe `text`.
 */
import { describe, it, expect } from "vitest";
import { sendMessageSchema } from "../src/tools/messages.js";

const textoValido = {
  to: "5511999999999",
  type: "text" as const,
  text: { body: "olá" },
};

const templateValido = {
  to: "5511999999999",
  type: "template" as const,
  template: { name: "hello_world", language: { code: "pt_BR" } },
};

describe("send_message schema — type ↔ payload", () => {
  it("aceita type='text' com text", () => {
    expect(sendMessageSchema.safeParse(textoValido).success).toBe(true);
  });

  it("aceita type='template' com template", () => {
    expect(sendMessageSchema.safeParse(templateValido).success).toBe(true);
  });

  it("rejeita type='text' sem text", () => {
    const r = sendMessageSchema.safeParse({ to: "5511999999999", type: "text" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("text"))).toBe(true);
    }
  });

  it("rejeita type='template' sem template", () => {
    const r = sendMessageSchema.safeParse({ to: "5511999999999", type: "template" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("template"))).toBe(true);
    }
  });

  it("rejeita type='text' com template junto", () => {
    const r = sendMessageSchema.safeParse({
      ...textoValido,
      template: { name: "hello_world", language: { code: "pt_BR" } },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("template"))).toBe(true);
    }
  });

  it("rejeita type='template' com text junto", () => {
    const r = sendMessageSchema.safeParse({
      ...templateValido,
      text: { body: "olá" },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("text"))).toBe(true);
    }
  });

  it("rejeita template com language sem code", () => {
    const r = sendMessageSchema.safeParse({
      to: "5511999999999",
      type: "template",
      template: { name: "hello_world", language: {} },
    });
    expect(r.success).toBe(false);
  });
});
