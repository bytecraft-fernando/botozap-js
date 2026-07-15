/**
 * Exemplo TypeScript: envio sandbox tipado, leitura paginada por cursor e
 * tratamento de erro estruturado. Gere uma chave SANDBOX (bz_sandbox_…) em
 * /chaves no painel.
 *
 *   BOTOZAP_API_KEY=bz_sandbox_xxx pnpm start
 */
import { BotoZap, BotoZapError, type Message, type SendResult } from "@botozap/sdk";

const apiKey = process.env.BOTOZAP_API_KEY;
if (!apiKey) {
  console.error("Defina BOTOZAP_API_KEY (chave sandbox bz_sandbox_…).");
  process.exit(1);
}

const boto = new BotoZap({ apiKey });

async function main(): Promise<void> {
  // 1. Envio sandbox tipado — a resposta do POST /messages vem direta.
  const sent: SendResult = await boto.messages.send({
    to: "+5500000000001",
    text: "Olá do sandbox (TypeScript)!",
  });
  console.log("Enviada:", sent.wamid, sent.status, sent.sandbox ? "(sandbox)" : "");

  // 2. Leitura paginada por CURSOR — listas devolvem o envelope inteiro
  //    ({ data, paging }); pague a próxima página com paging.next.
  const primeiras: Message[] = [];
  let after: string | undefined;
  do {
    const page = await boto.messages.list({ limit: 10, after });
    primeiras.push(...page.data);
    after = page.paging.next ?? undefined;
  } while (after && primeiras.length < 30);
  console.log(`Lidas ${primeiras.length} mensagens (até 3 páginas de 10).`);
}

main().catch((err: unknown) => {
  if (err instanceof BotoZapError) {
    // Erro estruturado da API: code + message do envelope + status HTTP.
    // status 0 = erro de rede/contrato (sem resposta HTTP).
    console.error(`Erro da API [${err.code}] (HTTP ${err.status}): ${err.message}`);
    if (err.status === 429) {
      console.error("Rate limit — Retry-After:", err.headers?.["retry-after"]);
    }
    process.exit(1);
  }
  throw err;
});
