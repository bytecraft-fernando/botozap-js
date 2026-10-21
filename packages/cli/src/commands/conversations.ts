import { Command, Option } from "commander";
import { collect, confirmDestructive, context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
} from "../output.js";

export function registerConversations(program: Command): void {
  const conv = program
    .command("conversations")
    .description("Listar e gerenciar conversas");

  conv
    .command("list")
    .description("Lista conversas (paginação por cursor)")
    .addOption(new Option("--follows-business <bool>", "filtra seguidores do Instagram (valores conhecidos)").choices(["true", "false"]))
    .option("--phone-number-id <id>", "filtra por número")
    .option("--status <status>", "active | ended")
    .option("--phone-number <e164>", "filtra pelo número do contato")
    .option("--channel <canal>", "whatsapp | instagram")
    .option("--channel-account-id <uuid>", "filtra por Conta de canal (Número ou Conta do Instagram)")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.conversations.list({
        ig_follows_business: opts.followsBusiness === undefined ? undefined : opts.followsBusiness === "true",
        phone_number_id: opts.phoneNumberId,
        status: opts.status,
        phone_number: opts.phoneNumber,
        channel: opts.channel,
        channel_account_id: opts.channelAccountId,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "CANAL", key: "channel" },
        { header: "CONTATO", key: "contact.name" },
        { header: "TELEFONE", key: "contact.phone" },
        { header: "STATUS", key: "status" },
        { header: "ORIGEM", key: "entry_point" },
        { header: "ÚLTIMA MSG", key: "last_message_at" },
      ]);
      printCursorFooter(res.paging);
    });

  conv
    .command("get <id>")
    .description("Detalha uma conversa")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.conversations.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  conv
    .command("update <id>")
    .description("Atualiza o status de uma conversa (active | ended)")
    .requiredOption("--status <status>", "active | ended")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.conversations.update(id, {
        status: opts.status,
      });
      if (format === "json") return printJson(data);
      printLine("Conversa atualizada.");
      printDetail(data as Record<string, unknown>);
    });

  conv
    .command("request-consent <id>")
    .description(
      "Envia o pedido de consentimento na conversa (botões no WhatsApp, respostas rápidas no Instagram). " +
        "Só com a janela de 24h aberta (outside_window no WhatsApp, window_closed no Instagram). " +
        "Sai também para quem recusou marketing. Não repita um pedido de resultado incerto sem conferir a conversa",
    )
    .option(
      "--purpose <finalidade>",
      "marketing | utility (repetível; padrão: marketing)",
      collect,
    )
    .option("--body <texto>", "texto do pedido (até 1024 caracteres; padrão: texto do BotoZap)")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const purposes = opts.purpose as string[] | undefined;
      for (const purpose of purposes ?? []) {
        if (purpose !== "marketing" && purpose !== "utility") {
          throw new Error("--purpose deve ser marketing ou utility.");
        }
      }
      const data = await client.conversations.requestConsent(id, {
        ...(purposes ? { purposes: purposes as ("marketing" | "utility")[] } : {}),
        ...(opts.body !== undefined ? { body: opts.body } : {}),
      });
      if (format === "json") return printJson(data);
      printLine(`Pedido de consentimento enviado pelo ${data.channel === "instagram" ? "Instagram" : "WhatsApp"}.`);
      printDetail(data as unknown as Record<string, unknown>);
      for (const warning of data.warnings ?? []) {
        printLine(`Aviso [${warning.code}]: ${warning.message}`);
      }
    });

  conv
    .command("delete <id>")
    .description(
      "Exclui a conversa SEM VOLTA: mensagens, notas, atribuições, vínculos com CRM e o que a IA guardou dela, " +
        "e apaga a mídia. O contato fica, com a recusa e o consentimento. Só Administrador",
    )
    .option("--yes", "confirma sem perguntar (obrigatório fora de um terminal)")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await confirmDestructive(
        `Isto exclui a conversa ${id} e as mensagens dela para sempre.`,
        opts.yes as boolean | undefined,
      );
      await client.conversations.delete(id);
      if (format === "json") return printJson({ deleted: true });
      printLine("Conversa excluída.");
    });
}
