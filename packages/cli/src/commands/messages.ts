import { Command } from "commander";
import { readFileSync } from "node:fs";
import type { Message, SendResult } from "@botozap/sdk";
import { context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
} from "../output.js";

/** Lê JSON cru de um arquivo (--input) ou do stdin (--stdin). */
function readRawBody(file?: string, fromStdin?: boolean): unknown {
  let raw: string;
  if (file) {
    raw = readFileSync(file, "utf8");
  } else if (fromStdin) {
    raw = readFileSync(0, "utf8");
  } else {
    throw new Error("Nenhuma fonte de payload informada.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("O payload informado não é um JSON válido.");
  }
}

export function registerMessages(program: Command): void {
  const messages = program
    .command("messages")
    .description("Enviar e consultar mensagens de WhatsApp");

  messages
    .command("send")
    .description("Envia uma mensagem (texto simples ou payload completo)")
    .option("--to <wa_id>", "destinatário (número E.164 sem +, ex.: 5511999999999)")
    .option("--text <body>", "corpo de uma mensagem de texto")
    .option("--from <phone_number_id>", "número de origem (opcional)")
    .option("--input <arquivo>", "arquivo JSON com o corpo bruto da mensagem")
    .option("--stdin", "lê o corpo bruto da mensagem do stdin")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);

      // POST /messages responde o objeto DIRETO (sem envelope `data`); ambos os
      // caminhos devolvem o mesmo shape { id, wamid, to, status }.
      let result: SendResult;
      if (opts.input || opts.stdin) {
        // Payload cru: contrato de baixo nível do SDK (`request`), sem montar o corpo.
        const body = readRawBody(opts.input, opts.stdin);
        result = await client.request<SendResult>("POST", "/messages", { body });
      } else {
        if (!opts.to || !opts.text) {
          throw new Error(
            "Informe --to e --text, ou use --input <arquivo.json> / --stdin para payload completo.",
          );
        }
        result = await client.messages.send({
          to: opts.to,
          text: opts.text,
          ...(opts.from ? { from: opts.from } : {}),
        });
      }

      if (format === "json") return printJson(result);
      printLine("Mensagem enfileirada.");
      printDetail(result as unknown as Record<string, unknown>, [
        "id",
        "wamid",
        "to",
        "status",
      ]);
    });

  messages
    .command("list")
    .description("Lista mensagens (paginação por cursor)")
    .option("--phone-number-id <id>", "filtra por número")
    .option("--conversation-id <id>", "filtra por conversa")
    .option("--direction <dir>", "inbound | outbound")
    .option("--status <status>", "status da mensagem")
    .option("--message-type <tipo>", "tipo (text, image, template, …)")
    .option("--has-media", "apenas mensagens com mídia")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.messages.list({
        phone_number_id: opts.phoneNumberId,
        conversation_id: opts.conversationId,
        direction: opts.direction,
        status: opts.status,
        message_type: opts.messageType,
        has_media: opts.hasMedia ? true : undefined,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "DIREÇÃO", key: "direction" },
        { header: "TIPO", key: "kind" },
        { header: "STATUS", key: "status" },
        { header: "DE", key: "from" },
        { header: "PARA", key: "to" },
        { header: "CRIADA", key: "created_at" },
      ]);
      printCursorFooter(res.paging);
    });

  messages
    .command("get <id>")
    .description("Detalha uma mensagem por UUID interno ou wamid")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data: Message = await client.messages.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });
}
