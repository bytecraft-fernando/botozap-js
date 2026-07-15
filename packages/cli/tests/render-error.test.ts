/**
 * Renderização central de erros da CLI (`src/render-error.ts`).
 *
 * Trava o fix do 429 (Retry-After / X-RateLimit-* exibidos) e o contrato dos
 * demais erros: base `Erro [code]: message` intacta, envelope json `{error}`,
 * e a garantia de que os renderizadores nunca fabricam/vazam segredo (só usam
 * code/message/status/headers-de-resposta).
 */
import { describe, expect, it } from "vitest";
import { BotoZapError, ConfigError } from "../src/client.js";
import {
  renderErrorText,
  renderErrorJson,
  rateLimitInfo,
} from "../src/render-error.js";

describe("renderErrorText", () => {
  it("BotoZapError estruturado → base `Erro [code]: message`", () => {
    const err = new BotoZapError("validation_error", "campo inválido", 422);
    expect(renderErrorText(err)).toBe("Erro [validation_error]: campo inválido");
  });

  it("network_error (status 0) mantém a base", () => {
    const err = new BotoZapError(
      "network_error",
      "falha de rede ao chamar a API: fetch failed",
      0,
    );
    expect(renderErrorText(err)).toBe(
      "Erro [network_error]: falha de rede ao chamar a API: fetch failed",
    );
  });

  it("malformed_response (status 0) mantém a base", () => {
    const err = new BotoZapError(
      "malformed_response",
      "resposta sem data[]/paging — contrato de cursor violado",
      0,
    );
    expect(renderErrorText(err)).toBe(
      "Erro [malformed_response]: resposta sem data[]/paging — contrato de cursor violado",
    );
  });

  it("ConfigError → `Erro: message` (sem colchetes de code)", () => {
    expect(renderErrorText(new ConfigError("Nenhuma API key."))).toBe(
      "Erro: Nenhuma API key.",
    );
  });

  it("Error genérico → `Erro: message`", () => {
    expect(renderErrorText(new Error("boom"))).toBe("Erro: boom");
  });

  it("valor não-Error → `Erro: <string>`", () => {
    expect(renderErrorText("x")).toBe("Erro: x");
  });

  // --- FIX do 429 -----------------------------------------------------------
  it("429 acrescenta Retry-After e X-RateLimit-* à base, sem reformatar", () => {
    const err = new BotoZapError(
      "rate_limit_exceeded",
      "muitas requisições",
      429,
      {
        "retry-after": "30",
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1720000000",
      },
    );
    const text = renderErrorText(err);
    // A base preservada como prefixo:
    expect(text.startsWith("Erro [rate_limit_exceeded]: muitas requisições")).toBe(
      true,
    );
    expect(text).toContain("Retry-After: 30");
    expect(text).toContain("restantes: 0");
    expect(text).toContain("limite: 100");
    expect(text).toContain("reset: 1720000000");
  });

  it("429 com header em maiúsculas é lido case-insensitive", () => {
    const err = new BotoZapError("rate_limit_exceeded", "slow down", 429, {
      "Retry-After": "12",
    });
    expect(renderErrorText(err)).toContain("Retry-After: 12");
  });

  it("429 sem headers de rate-limit → só a base, sem sufixo", () => {
    const err = new BotoZapError("rate_limit_exceeded", "slow down", 429, {
      "content-type": "application/json",
    });
    expect(renderErrorText(err)).toBe("Erro [rate_limit_exceeded]: slow down");
  });

  it("status != 429 nunca ganha sufixo, mesmo com headers presentes", () => {
    const err = new BotoZapError("server_error", "erro", 500, {
      "retry-after": "5",
    });
    expect(renderErrorText(err)).toBe("Erro [server_error]: erro");
  });
});

describe("renderErrorJson", () => {
  it("BotoZapError → envelope { error: { code, message, status } }", () => {
    const err = new BotoZapError("validation_error", "campo inválido", 422);
    expect(renderErrorJson(err)).toEqual({
      error: { code: "validation_error", message: "campo inválido", status: 422 },
    });
  });

  it("429 inclui rate_limit apenas com os campos presentes", () => {
    const err = new BotoZapError("rate_limit_exceeded", "muitas", 429, {
      "retry-after": "30",
      "x-ratelimit-remaining": "0",
    });
    expect(renderErrorJson(err)).toEqual({
      error: {
        code: "rate_limit_exceeded",
        message: "muitas",
        status: 429,
        rate_limit: { retry_after: "30", remaining: "0" },
      },
    });
  });

  it("429 sem headers de rate-limit → sem chave rate_limit", () => {
    const err = new BotoZapError("rate_limit_exceeded", "muitas", 429, {
      "content-type": "application/json",
    });
    const json = renderErrorJson(err) as { error: Record<string, unknown> };
    expect("rate_limit" in json.error).toBe(false);
  });

  it("ConfigError → code config_error", () => {
    expect(renderErrorJson(new ConfigError("sem chave"))).toEqual({
      error: { code: "config_error", message: "sem chave" },
    });
  });

  it("Error genérico → code error", () => {
    expect(renderErrorJson(new Error("boom"))).toEqual({
      error: { code: "error", message: "boom" },
    });
  });

  it("é serializável e re-parseável como JSON", () => {
    const err = new BotoZapError("x", "y", 400);
    const round = JSON.parse(JSON.stringify(renderErrorJson(err)));
    expect(round.error.code).toBe("x");
  });
});

describe("segredo nunca entra pelos renderizadores", () => {
  const secret = "bz_live_SECRETdoNotLeak";

  it("um 401 do servidor (code/message) não contém a apiKey", () => {
    // O SDK monta a message a partir do envelope do servidor; a apiKey (header
    // de request) nunca chega ao BotoZapError. Confirma que os renderizadores
    // não a introduzem por outra via.
    const err = new BotoZapError(
      "authentication_error",
      "Chave de API inválida ou expirada.",
      401,
    );
    expect(renderErrorText(err)).not.toContain(secret);
    expect(JSON.stringify(renderErrorJson(err))).not.toContain(secret);
  });

  it("headers de resposta num 429 não carregam segredo (só rate-limit)", () => {
    const err = new BotoZapError("rate_limit_exceeded", "muitas", 429, {
      "retry-after": "1",
    });
    expect(renderErrorText(err)).not.toContain(secret);
    expect(JSON.stringify(renderErrorJson(err))).not.toContain(secret);
  });
});

describe("rateLimitInfo", () => {
  it("vazio quando status != 429", () => {
    expect(
      rateLimitInfo(new BotoZapError("x", "y", 500, { "retry-after": "5" })),
    ).toEqual({});
  });

  it("vazio quando não há headers", () => {
    expect(rateLimitInfo(new BotoZapError("x", "y", 429))).toEqual({});
  });
});
