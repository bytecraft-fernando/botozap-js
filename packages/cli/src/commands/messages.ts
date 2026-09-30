import { Command } from "commander";
import { readFileSync } from "node:fs";
import type { InteractivePayload, Message, SendResult } from "@botozap/sdk";
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

function parseInline(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("--json não é um JSON válido.");
  }
}

function parseSort(raw?: string): "created_at" | "event_at" | undefined {
  if (raw === undefined) return undefined;
  if (raw === "created_at" || raw === "event_at") return raw;
  throw new Error("--sort deve ser created_at ou event_at.");
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

  const printSent = (result: SendResult, format: string, fields: string[] = ["id", "wamid", "to", "status"]) => {
    if (format === "json") return printJson(result);
    printLine("Mensagem enfileirada.");
    printDetail(result as unknown as Record<string, unknown>, fields);
  };

  messages
    .command("send-interactive")
    .description("Envia botões de resposta, lista ou botão de link (objeto `interactive` da Cloud API)")
    .requiredOption("--to <wa_id>", "destinatário")
    .option("--from <phone_number_id>", "número de origem (opcional)")
    .option("--input <arquivo>", "arquivo JSON com o objeto interactive")
    .option("--stdin", "lê o objeto interactive do stdin")
    .option("--json <interactive>", "objeto interactive inline")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const interactive = (opts.json
        ? parseInline(opts.json)
        : readRawBody(opts.input, opts.stdin)) as InteractivePayload;
      const result = await client.messages.sendInteractive({
        to: opts.to,
        interactive,
        ...(opts.from ? { from: opts.from } : {}),
      });
      printSent(result, format);
    });

  messages
    .command("send-location")
    .description("Envia uma localização")
    .requiredOption("--to <wa_id>", "destinatário")
    .requiredOption("--latitude <n>", "latitude (-90 a 90)")
    .requiredOption("--longitude <n>", "longitude (-180 a 180)")
    .option("--name <nome>", "nome do local")
    .option("--address <endereco>", "endereço")
    .option("--from <phone_number_id>", "número de origem (opcional)")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const latitude = Number(opts.latitude);
      const longitude = Number(opts.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("--latitude e --longitude devem ser números.");
      }
      const result = await client.messages.sendLocation({
        to: opts.to,
        latitude,
        longitude,
        ...(opts.name ? { name: opts.name } : {}),
        ...(opts.address ? { address: opts.address } : {}),
        ...(opts.from ? { from: opts.from } : {}),
      });
      printSent(result, format);
    });

  messages
    .command("react")
    .description("Reage a uma mensagem recebida (use --remove para retirar a reação)")
    .requiredOption("--to <wa_id>", "destinatário (o contato)")
    .requiredOption("--message-id <id>", "UUID interno ou wamid da mensagem recebida")
    .option("--emoji <emoji>", "emoji da reação")
    .option("--remove", "retira a reação (emoji vazio)")
    .option("--from <phone_number_id>", "número de origem (opcional)")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (!opts.remove && !opts.emoji) throw new Error("Informe --emoji ou --remove.");
      const result = await client.messages.sendReaction({
        to: opts.to,
        message_id: opts.messageId,
        emoji: opts.remove ? "" : opts.emoji,
        ...(opts.from ? { from: opts.from } : {}),
      });
      if (format === "json") return printJson(result);
      printLine(opts.remove ? "Reação retirada." : "Reação enviada.");
      printDetail({ ...result, ...(result.reaction ?? {}) } as unknown as Record<string, unknown>, [
        "wamid",
        "to",
        "status",
        "action",
        "emoji",
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
    .option("--sort <campo>", "created_at (padrão) | event_at; reuse o cursor com o mesmo sort")
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
        sort: parseSort(opts.sort),
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
        { header: "ORIGEM", key: "source" },
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
