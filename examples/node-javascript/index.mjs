/**
 * Envio sandbox com @botozap/sdk — sem credenciais Meta, sem número real,
 * sem custo. Gere uma chave SANDBOX (bz_sandbox_…) em /chaves no painel.
 *
 *   BOTOZAP_API_KEY=bz_sandbox_xxx node index.mjs
 *
 * Números mágicos do sandbox:
 *   +5500000000001 → sent → delivered → read (janela de 24h sempre aberta)
 *   +5500000000002 → falha simulada (erro Meta 131026)
 *   +5500000000003 → delivered + resposta inbound (~2s) que abre a janela real
 */
import { BotoZap, BotoZapError } from "@botozap/sdk";

const boto = new BotoZap({ apiKey: process.env.BOTOZAP_API_KEY });

try {
  const result = await boto.messages.send({
    to: "+5500000000001",
    text: "Olá do sandbox da BotoZap!",
  });

  // POST /messages responde o objeto direto (sem envelope { data }).
  console.log("Enviada:", result.id);
  console.log("wamid:  ", result.wamid);
  console.log("status: ", result.status);
  console.log("sandbox:", result.sandbox === true);
} catch (err) {
  if (err instanceof BotoZapError) {
    // Erro estruturado da API: { error: { code, message } } + status HTTP.
    console.error(`Erro da API [${err.code}] (HTTP ${err.status}): ${err.message}`);
    if (err.status === 429) {
      // err.headers traz X-RateLimit-* / Retry-After para backoff.
      console.error("Rate limit — tente depois:", err.headers?.["retry-after"]);
    }
    process.exit(1);
  }
  throw err;
}
