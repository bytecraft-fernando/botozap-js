import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { setConfigValue, configPath } from "../config.js";
import { printLine, dim } from "../output.js";
import pc from "picocolors";

/**
 * `botozap login` — STUB amigável.
 *
 * O BotoZap ainda não tem login OAuth por navegador (como o `kapso login`).
 * Por isso este comando apenas (1) explica como criar uma API key no painel,
 * em /chaves, e (2) oferece colar a chave para gravá-la no config local.
 */
export function registerLogin(program: Command): void {
  program
    .command("login")
    .description("Instruções para autenticar e gravar sua API key (stub)")
    .option("--api-key <chave>", "grava a chave informada sem perguntar")
    .action(async (opts, _cmd: Command) => {
      printLine(pc.bold("Autenticação do BotoZap CLI"));
      printLine("");
      printLine(
        "Ainda não há login por navegador (OAuth). Use uma API key do painel:",
      );
      printLine(`  1. Acesse ${pc.cyan("https://botozap.com.br/chaves")}`);
      printLine("  2. Crie uma chave (formato bz_live_…)");
      printLine("  3. Cole a chave abaixo (ou rode com --api-key).");
      printLine("");

      let key = opts.apiKey as string | undefined;

      if (!key) {
        const interativo = Boolean(stdin.isTTY);
        const rl = createInterface({ input: stdin, output: stdout });
        try {
          const pergunta = rl.question("Cole sua API key: ");
          if (interativo) {
            // Mascara a digitação: o prompt acima já foi impresso, então a
            // partir daqui suprimimos o eco de cada caractere da chave. Assim
            // ela não aparece na tela nem fica no scrollback do terminal.
            // (Num pipe/redirect não há eco de terminal, então não mascaramos —
            // o `botozap login < chave.txt` / `echo … | botozap login` funciona.)
            (
              rl as unknown as { _writeToOutput: (s: string) => void }
            )._writeToOutput = () => {};
          }
          key = (await pergunta).trim();
          // O Enter final também foi suprimido pela máscara: reponha a quebra.
          if (interativo) stdout.write("\n");
        } finally {
          rl.close();
        }
      }

      if (!key) {
        printLine(dim("Nenhuma chave informada. Nada foi gravado."));
        return;
      }
      if (!key.startsWith("bz_")) {
        printLine(
          pc.yellow(
            "Aviso: a chave não começa com `bz_`. Gravando mesmo assim.",
          ),
        );
      }

      setConfigValue("apiKey", key);
      printLine(pc.green("Chave gravada com sucesso."));
      printLine(dim(`Arquivo: ${configPath()}`));
      printLine(dim("Verifique com `botozap status`."));
    });
}
