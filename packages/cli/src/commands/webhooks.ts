import { Command } from "commander";
import type { Webhook } from "@botozap/sdk";
import { context, toInt, toBool } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
  dim,
} from "../output.js";

/** Acumula `--channel-account-id` repetido; cada valor aceita lista por vírgula. */
function collectIds(value: string, previous: string[] = []): string[] {
  return [
    ...previous,
    ...value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ];
}

/** Resumo legível do escopo de canais. `undefined` = API sem o campo. */
export function formatChannels(ids: unknown): string {
  if (ids === undefined) return "";
  if (ids === null) return "todos";
  if (!Array.isArray(ids)) return String(ids);
  if (ids.length === 0) return "nenhum (canais excluídos; não recebe eventos)";
  return ids.join(", ");
}

function channelsColumn(ids: unknown): string {
  if (Array.isArray(ids) && ids.length > 1) return `${ids.length} canais`;
  return formatChannels(ids);
}

/** Saúde resumida para a listagem: `degraded (2 canais com falha)`. */
function healthColumn(_value: unknown, row: Record<string, unknown>): string {
  const status = typeof row.health_status === "string" ? row.health_status : "";
  const failing = Array.isArray(row.channels_health) ? row.channels_health.length : 0;
  if (failing === 0) return status;
  return `${status} (${failing} ${failing === 1 ? "canal" : "canais"} com falha)`;
}

/** Detalhe do webhook com canais legíveis e tabela de saúde por canal. */
function printWebhook(data: Webhook): void {
  const { channels_health: channelsHealth, ...rest } = data;
  const detail: Record<string, unknown> = { ...rest };
  if ("channel_account_ids" in data) {
    detail.channel_account_ids = formatChannels(data.channel_account_ids);
  }
  printDetail(detail);
  if (!Array.isArray(channelsHealth)) return;
  if (channelsHealth.length === 0) {
    printLine(dim("Saúde por canal: todos os canais saudáveis."));
    return;
  }
  printLine("");
  printLine("Saúde por canal (só canais com falha):");
  printTable(channelsHealth as unknown as Record<string, unknown>[], [
    {
      header: "CANAL",
      key: "channel_account_id",
      max: 36,
      format: (v: unknown) => (v === null ? "(eventos sem canal)" : String(v ?? "")),
    },
    { header: "SAÚDE", key: "health_status" },
    { header: "FALHAS", key: "failure_streak" },
    { header: "PRÓXIMA TENTATIVA", key: "next_attempt_at" },
    { header: "PAUSADO EM", key: "paused_at" },
    { header: "ÚLTIMO SUCESSO", key: "last_success_at" },
    { header: "ÚLTIMO CÓDIGO", key: "last_response_code" },
  ]);
}

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
        { header: "CANAIS", key: "channel_account_ids", format: channelsColumn },
        { header: "SAÚDE", key: "health_status", format: healthColumn },
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
      printWebhook(data);
    });

  webhooks
    .command("create")
    .description("Cria um webhook")
    .requiredOption("--url <url>", "URL de entrega (obrigatório)")
    .requiredOption(
      "--events <lista>",
      "categorias separadas por vírgula: messages, statuses, crm, account, app_messages (opt-in; obrigatório)",
    )
    .option("--secret <segredo>", "segredo para assinar as entregas")
    .option("--active <bool>", "true | false")
    .option(
      "--customer-id <id>",
      "limita as entregas a um cliente (uuid) da conta; omitido = todos",
    )
    .option(
      "--channel-account-id <id>",
      "só eventos deste canal (id de channel-accounts list; repetível ou separado por vírgula, até 100); omitido = todos os canais",
      collectIds,
    )
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
        customer_id: opts.customerId,
        channel_account_ids: opts.channelAccountId,
      });
      if (format === "json") return printJson(data);
      printLine("Webhook criado.");
      printWebhook(data);
    });

  webhooks
    .command("update <id>")
    .description("Atualiza um webhook")
    .option("--url <url>", "nova URL")
    .option("--events <lista>", "novos eventos (separados por vírgula)")
    .option("--secret <segredo>", "novo segredo")
    .option("--active <bool>", "true | false")
    .option("--customer-id <id>", "limita as entregas a este cliente (uuid)")
    .option("--clear-customer", "remove o filtro de cliente (entregas de toda a conta)")
    .option(
      "--channel-account-id <id>",
      "passa a receber só eventos destes canais (repetível ou separado por vírgula, 1 a 100; substitui a lista atual)",
      collectIds,
    )
    .option("--all-channels", "volta a receber eventos de todos os canais")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.customerId !== undefined && opts.clearCustomer) {
        throw new Error("Use --customer-id OU --clear-customer, não os dois.");
      }
      if (opts.channelAccountId !== undefined && opts.allChannels) {
        throw new Error("Use --channel-account-id OU --all-channels, não os dois.");
      }
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
      if (opts.customerId !== undefined) body.customer_id = opts.customerId;
      if (opts.clearCustomer) body.customer_id = null;
      if (opts.channelAccountId !== undefined) body.channel_account_ids = opts.channelAccountId;
      if (opts.allChannels) body.channel_account_ids = null;
      if (Object.keys(body).length === 0) {
        throw new Error("Informe ao menos um campo para atualizar.");
      }
      const data = await client.webhooks.update(id, body);
      if (format === "json") return printJson(data);
      printLine("Webhook atualizado.");
      printWebhook(data);
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
