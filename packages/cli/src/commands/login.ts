import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { setConfigValue, configPath } from "../config.js";
import { printLine, dim } from "../output.js";
import pc from "picocolors";

/**
 * `botozap login` — STUB amigável.
 *
 * O BotoZap ainda não tem login OAuth por navegador.
 * Por isso este comando apenas (1) explica como criar uma API key no painel,
 * em /chaves, e (2) oferece colar a chave para gravá-la no config local.
 */
export function registerLogin(program: Command): void {
  program
    .command("login")
    .description("Instruções para autenticar e gravar sua API key (stub)")
    .option("--api-key <chave>", "grava a chave informada sem perguntar")
    .action(async (_opts, cmd: Command) => {
      printLine(pc.bold("Autenticação do BotoZap CLI"));
      printLine("");
      printLine(
        "Ainda não há login por navegador (OAuth). Use uma API key do painel:",
      );
      printLine(`  1. Acesse ${pc.cyan("https://botozap.com.br/chaves")}`);
      printLine("  2. Crie uma chave (formato bz_live_…)");
      printLine("  3. Cole a chave abaixo (ou rode com --api-key).");
      printLine("");

      // O programa também declara `--api-key` global, e o commander entrega o valor
      // a ela mesmo depois de `login`; por isso a chave vem de `optsWithGlobals`.
      let key = cmd.optsWithGlobals().apiKey as string | undefined;

      if (!key) {
        const interativo = Boolean(stdin.isTTY);
        // Mascara a digitação: num terminal o readline põe o stdin em modo raw
        // (o terminal para de ecoar) e ecoa cada tecla ele mesmo, pelo output.
        // O output é um stream que repassa ao stdout e fica mudo depois da
        // pergunta, então a chave não aparece na tela nem fica no scrollback.
        // Trocar `rl._writeToOutput` não funciona: o readline do Node escreve por
        // um método interno. Num pipe/redirect não há eco, então não mascaramos —
        // o `botozap login < chave.txt` / `echo … | botozap login` funciona.
        let mudo = false;
        const output = new Writable({
          write(chunk, _encoding, done) {
            if (!mudo) stdout.write(chunk);
            done();
          },
        });
        const rl = createInterface({ input: stdin, output, terminal: interativo });
        try {
          // A pergunta é escrita já na chamada; só o que vem depois fica mudo.
          const pergunta = rl.question("Cole sua API key: ");
          mudo = interativo;
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
