import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyBotoZapSignature } from "../src/signature.mjs";

describe("assinatura do Endpoint BotoZap", () => {
  it("aceita o HMAC-SHA256 hexadecimal calculado sobre os bytes crus", () => {
    const secret = "whsec_teste_local";
    const rawBody = Buffer.from('{\n  "event": "whatsapp.message.received"\n}\n');
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

    assert.equal(verifyBotoZapSignature(rawBody, signature, secret), true);
  });
});
