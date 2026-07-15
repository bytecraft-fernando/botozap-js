#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { resolveFormat, type OutputFormat } from "./output.js";
import { renderErrorText, renderErrorJson } from "./render-error.js";
import { registerMessages } from "./commands/messages.js";
import { registerConversations } from "./commands/conversations.js";
import { registerContacts } from "./commands/contacts.js";
import { registerMedia } from "./commands/media.js";
import { registerCustomers } from "./commands/customers.js";
import { registerSetupLinks } from "./commands/setup-links.js";
import { registerNumbers } from "./commands/numbers.js";
import { registerTemplates } from "./commands/templates.js";
import { registerWebhooks } from "./commands/webhooks.js";
import { registerDeliveries } from "./commands/deliveries.js";
import { registerLogs } from "./commands/logs.js";
import { registerUsers } from "./commands/users.js";
import { registerConfig } from "./commands/config.js";
import { registerStatus } from "./commands/status.js";
import { registerLogin } from "./commands/login.js";

const VERSION = "0.1.0";

const program = new Command();

program
  .name("botozap")
  .description(
    "CLI dev-first do BotoZap — WhatsApp Cloud API multi-tenant (a Kapso brasileira).",
  )
  .version(VERSION, "-v, --version", "mostra a versão")
  .option(
    "--api-key <chave>",
    "API key (sobrepõe env e config; prefira BOTOZAP_API_KEY ou `botozap login` — argv fica no histórico do shell)",
  )
  .option("--api-url <url>", "URL base da API (sobrepõe env e config)")
  .option(
    "-o, --output <formato>",
    "formato de saída: human | json",
    "human",
  )
  .showHelpAfterError("(use --help para ver as opções)");

// Captura o formato de saída resolvido (flag global -o/--output) antes de cada
// ação, para o handler central de erro renderizar human vs. json de forma
// consistente com o que o comando usaria. `preAction` só roda para comandos com
// ação (não para --help/--version), então não altera esses caminhos.
let selectedFormat: OutputFormat = "human";
program.hook("preAction", (_thisCommand, actionCommand) => {
  selectedFormat = resolveFormat(
    actionCommand.optsWithGlobals().output as string | undefined,
  );
});

// Recursos
registerMessages(program);
registerConversations(program);
registerContacts(program);
registerMedia(program);
registerCustomers(program);
registerSetupLinks(program);
registerNumbers(program);
registerTemplates(program);
registerWebhooks(program);
registerDeliveries(program);
registerLogs(program);
registerUsers(program);

// Sessão / utilidades
registerLogin(program);
registerConfig(program);
registerStatus(program);

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // Erros (incl. o objeto json estruturado) vão para stderr — stdout fica
    // reservado à saída de sucesso, para não poluir um `-o json` consumido por
    // script. Exit code uniforme = 1 é decisão de design.
    if (selectedFormat === "json") {
      process.stderr.write(JSON.stringify(renderErrorJson(err), null, 2) + "\n");
    } else {
      process.stderr.write(pc.red(renderErrorText(err)) + "\n");
    }
    process.exit(1);
  }
}

void main();
