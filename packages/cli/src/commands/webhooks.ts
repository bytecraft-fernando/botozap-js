import { Command } from "commander";
import { context, toInt, toBool } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
} from "../output.js";

export function registerWebhooks(program: Command): void {
  const webhooks = program
    .command("webhooks")
    .description("Gerenciar endpoints de webhook");

  webhooks
    .command("list")
    .description("Lista webhooks (paginação por cursor)")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.webhooks.list({
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "URL", key: "url", max: 50 },
        { header: "ATIVO", key: "active" },
        { header: "EVENTOS", key: "events" },
      ]);
      printCursorFooter(res.paging);
    });

  webhooks
    .command("get <id>")
    .description("Detalha um webhook")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.webhooks.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  webhooks
    .command("create")
    .description("Cria um webhook")
    .requiredOption("--url <url>", "URL de entrega (obrigatório)")
    .requiredOption(
      "--events <lista>",
      "eventos separados por vírgula (obrigatório)",
    )
    .option("--secret <segredo>", "segredo para assinar as entregas")
    .option("--active <bool>", "true | false")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const events = String(opts.events)
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const data = await client.webhooks.create({
        url: opts.url,
        events,
        secret: opts.secret,
        active: toBool(opts.active),
      });
      if (format === "json") return printJson(data);
      printLine("Webhook criado.");
      printDetail(data as Record<string, unknown>);
    });

  webhooks
    .command("update <id>")
    .description("Atualiza um webhook")
    .option("--url <url>", "nova URL")
    .option("--events <lista>", "novos eventos (separados por vírgula)")
    .option("--secret <segredo>", "novo segredo")
    .option("--active <bool>", "true | false")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const body: Record<string, unknown> = {};
      if (opts.url !== undefined) body.url = opts.url;
      if (opts.events !== undefined) {
        body.events = String(opts.events)
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
      }
      if (opts.secret !== undefined) body.secret = opts.secret;
      if (opts.active !== undefined) body.active = toBool(opts.active);
      if (Object.keys(body).length === 0) {
        throw new Error("Informe ao menos um campo para atualizar.");
      }
      const data = await client.webhooks.update(id, body);
      if (format === "json") return printJson(data);
      printLine("Webhook atualizado.");
      printDetail(data as Record<string, unknown>);
    });

  webhooks
    .command("delete <id>")
    .description("Remove um webhook")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await client.webhooks.delete(id);
      if (format === "json") return printJson({ deleted: true });
      printLine("Webhook removido.");
    });

  webhooks
    .command("test <id>")
    .description("Dispara uma entrega de teste para o webhook")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const result = await client.webhooks.test(id);
      if (format === "json") return printJson(result);
      printLine("Entrega de teste disparada.");
      printDetail(result as unknown as Record<string, unknown>);
    });
}
