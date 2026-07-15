import { Command } from "commander";
import { createClient, type GlobalOptions } from "../client.js";
import { resolveAuth } from "../config.js";
import { resolveFormat, printJson, printLine, dim } from "../output.js";
import pc from "picocolors";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Verifica a autenticação e a conectividade com a API")
    .action(async (_opts, cmd: Command) => {
      const g = cmd.optsWithGlobals();
      const format = resolveFormat(g.output);
      const auth = resolveAuth({ apiKey: g.apiKey, apiUrl: g.apiUrl });

      const global: GlobalOptions = { apiKey: g.apiKey, apiUrl: g.apiUrl };
      const client = createClient(global);

      // Sonda leve: 1 número apenas confirma que a chave alcança a conta.
      const res = await client.phoneNumbers.list({ per_page: 1 });
      const total = res.meta?.total_count ?? res.data.length;

      if (format === "json") {
        return printJson({
          ok: true,
          base_url: auth.baseUrl,
          api_key_source: auth.apiKeySource,
          phone_numbers_total: total,
        });
      }
      printLine(pc.green("Autenticado. Conta acessível."));
      printLine(`URL base       ${auth.baseUrl}`);
      printLine(`Origem da chave ${auth.apiKeySource}`);
      printLine(`Números        ${total}`);
      printLine(dim("Sonda: GET /phone_numbers?per_page=1"));
    });
}
