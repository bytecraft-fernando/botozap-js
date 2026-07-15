/**
 * Smoke EXTERNO do sandbox: monta o servidor MCP (artefato compilado em dist/)
 * com o fetch global REAL e envia uma mensagem de texto pelo sandbox de verdade,
 * pela tool `send_message`, para o número mágico +5500000000001 (happy path).
 *
 * Diferente do smoke hermético (`tests/sandbox-smoke.test.ts`, que roda em CI com
 * fetch stub), este bate na API real e por isso EXIGE credencial — nunca entra no
 * `test`. Roda manualmente:
 *
 *   pnpm --filter @botozap/mcp build   # exige dist/ atualizado (Node não roda a lib .ts crua)
 *   BOTOZAP_API_KEY=bz_sandbox_... BOTOZAP_API_URL=https://.../api/v1 \
 *     pnpm --filter @botozap/mcp smoke:sandbox
 *
 * Regras de segurança deste script:
 *  - NÃO há default para a chave; ausência → mensagem clara em stderr + exit 1
 *    ANTES de montar qualquer client.
 *  - Recusa qualquer chave que não comece com `bz_sandbox_` (nunca roda contra
 *    chave live/produção).
 *  - A chave NUNCA é impressa: todo texto que sai (inclusive erro) passa por uma
 *    redação defensiva que troca a chave por "***".
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../dist/server.js";

/** Número mágico de happy path do sandbox (janela sempre aberta). */
const MAGIC_TO = "+5500000000001";
const UNICODE_BODY = "Olá, tudo bem? 😀";

async function main(): Promise<void> {
  const apiKey = process.env.BOTOZAP_API_KEY?.trim();
  const baseUrl = process.env.BOTOZAP_API_URL?.trim();

  // Sem chave: falha ANTES de montar qualquer client (sem default, sem segredo).
  if (!apiKey) {
    console.error(
      "BOTOZAP_API_KEY não definida. Exporte uma chave de SANDBOX (bz_sandbox_...) " +
        "antes de rodar o smoke externo. Este script nunca usa um default.",
    );
    process.exit(1);
  }

  // Nunca rodar smoke contra chave live: só ambiente sandbox é permitido.
  if (!apiKey.startsWith("bz_sandbox_")) {
    console.error(
      "Chave recusada: o smoke externo só roda com chave de SANDBOX (prefixo " +
        "bz_sandbox_). Nunca aponte este script para uma chave live/produção.",
    );
    process.exit(1);
  }

  // Redação defensiva: qualquer texto que saia (resultado, erro, stack) tem a
  // chave trocada por "***" antes de tocar o console.
  const redact = (s: string): string => s.split(apiKey).join("***");

  const server = buildServer({ apiKey, baseUrl }); // fetch global real
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "sandbox-smoke", version: "0.0.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  try {
    const result = (await client.callTool({
      name: "send_message",
      arguments: { to: MAGIC_TO, type: "text", text: { body: UNICODE_BODY } },
    })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

    const text = result.content?.[0]?.text ?? "";

    if (result.isError) {
      console.error("FALHOU — a tool retornou erro:");
      console.error(redact(text));
      process.exitCode = 1;
      return;
    }

    let payload: { sandbox?: unknown; wamid?: unknown; status?: unknown };
    try {
      payload = JSON.parse(text);
    } catch {
      console.error("FALHOU — resposta da tool não é JSON:");
      console.error(redact(text));
      process.exitCode = 1;
      return;
    }

    const wamid = typeof payload.wamid === "string" ? payload.wamid : "";
    const ok = payload.sandbox === true && wamid.startsWith("wamid.sandbox.");
    if (!ok) {
      console.error(
        "FALHOU — resposta não parece do sandbox (esperado sandbox:true + " +
          "wamid.sandbox.<...>):",
      );
      console.error(redact(text));
      process.exitCode = 1;
      return;
    }

    console.log("OK — envio pelo sandbox aceito.");
    console.log(`  status: ${String(payload.status)}`);
    console.log(`  wamid:  ${wamid}`);
    console.log(`  sandbox: ${String(payload.sandbox)}`);
  } finally {
    await client.close();
    await server.close();
  }
}

main().catch((err: unknown) => {
  // Redação também no catch: um erro de rede pode ecoar a URL, nunca a chave.
  const apiKey = process.env.BOTOZAP_API_KEY?.trim() ?? "";
  const raw = err instanceof Error ? err.stack ?? err.message : String(err);
  const safe = apiKey ? raw.split(apiKey).join("***") : raw;
  console.error("FALHOU:", safe);
  process.exit(1);
});
