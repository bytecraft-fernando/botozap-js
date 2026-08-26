import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBotoZapMessenger } from "../src/messenger.mjs";

describe("política de envio do worker", () => {
  it("usa Template aprovado quando a janela de 24h já fechou", async () => {
    const calls = [];
    const messenger = createBotoZapMessenger({
      boto: {
        messages: {
          async send(input) {
            calls.push({ method: "text", input });
            return { wamid: "unexpected" };
          },
          async sendTemplate(input) {
            calls.push({ method: "template", input });
            return { wamid: "wamid.template-1" };
          },
        },
      },
      fallbackTemplate: {
        name: "retomar_atendimento",
        language: { code: "pt_BR" },
      },
    });

    const result = await messenger.sendResponse({
      to: "5511988887777",
      from: "123456789",
      text: "Seu pedido está a caminho.",
      freeformAllowed: false,
    });

    assert.deepEqual(calls, [
      {
        method: "template",
        input: {
          to: "5511988887777",
          from: "123456789",
          template: {
            name: "retomar_atendimento",
            language: { code: "pt_BR" },
          },
        },
      },
    ]);
    assert.deepEqual(result, { mode: "template", wamid: "wamid.template-1" });
  });

  it("faz fallback para Template quando o servidor fecha a janela concorrentemente", async () => {
    const calls = [];
    const messenger = createBotoZapMessenger({
      boto: {
        messages: {
          async send() {
            calls.push("text");
            throw Object.assign(new Error("janela fechada"), {
              code: "outside_window",
              status: 422,
            });
          },
          async sendTemplate() {
            calls.push("template");
            return { wamid: "wamid.template-fallback" };
          },
        },
      },
      fallbackTemplate: {
        name: "retomar_atendimento",
        language: { code: "pt_BR" },
      },
    });

    const result = await messenger.sendResponse({
      to: "5511988887777",
      from: "123456789",
      text: "Resposta gerada",
      freeformAllowed: true,
    });

    assert.deepEqual(calls, ["text", "template"]);
    assert.deepEqual(result, {
      mode: "template",
      wamid: "wamid.template-fallback",
    });
  });
});
