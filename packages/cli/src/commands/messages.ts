import { Command } from "commander";
import { readFileSync } from "node:fs";
import type { InteractivePayload, Message, QuickReply, SendMediaParams, SendResult } from "@botozap/sdk";
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

/** Acumula `--quick-reply` repetido: "título" ou "título=payload". */
function collectQuickReply(value: string, previous: QuickReply[] = []): QuickReply[] {
  const index = value.indexOf("=");
  const title = (index === -1 ? value : value.slice(0, index)).trim();
  const payload = index === -1 ? undefined : value.slice(index + 1);
  if (!title) throw new Error("--quick-reply exige um título (\"título\" ou \"título=payload\").");
  return [...previous, payload ? { title, payload } : { title }];
}

/** `--quick-replies-json`: lista completa no formato da API (inclui content_type). */
function parseQuickRepliesJson(raw: string): QuickReply[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("--quick-replies-json não é um JSON válido.");
  }
  if (!Array.isArray(value)) throw new Error("--quick-replies-json deve ser uma lista JSON.");
  return value as QuickReply[];
}

/** Campos do recibo: `wamid` no WhatsApp, `channel` + `external_id` fora dele. */
function receiptFields(result: SendResult, extra: string[] = []): string[] {
  const identity = result.wamid === null || result.channel
    ? ["channel", "external_id", "type"]
    : ["wamid"];
  return ["id", ...identity, "to", "status", ...(result.reply_to ? ["reply_to"] : []), ...extra];
}

const MEDIA_TYPES = ["image", "video", "audio", "document"] as const;

const IDEMPOTENCY_FLAG = "--idempotency-key <chave>";
const IDEMPOTENCY_HELP =
  "8 a 200 caracteres sem espaço, derivada do evento (ex.: entrega-123-2026-10-20); repetir com a mesma chave e o mesmo corpo devolve a resposta original sem enviar de novo";

const REPLY_TO_FLAG = "--reply-to <message_id>";
const REPLY_TO_HELP =
  "responde citando uma mensagem da mesma conversa: UUID interno ou wamid/mid da citada";

function replyTo(value: unknown): { reply_to?: { message_id: string } } {
  if (value === undefined) return {};
  const id = String(value).trim();
  if (!id) throw new Error("--reply-to exige o id da mensagem citada.");
  return { reply_to: { message_id: id } };
}

function parseSort(raw?: string): "created_at" | "event_at" | undefined {
  if (raw === undefined) return undefined;
  if (raw === "created_at" || raw === "event_at") return raw;
  throw new Error("--sort deve ser created_at ou event_at.");
}

export function registerMessages(program: Command): void {
  const messages = program
    .command("messages")
    .description("Enviar e consultar mensagens de WhatsApp e Instagram");

  messages
    .command("send")
    .description("Envia uma mensagem (texto simples ou payload completo) pelo WhatsApp ou Instagram")
    .option(
      "--to <destinatario>",
      "destinatário: telefone E.164 (ex.: 5511999999999) ou BSUID no WhatsApp; IGSID no Instagram",
    )
    .option("--text <body>", "corpo de uma mensagem de texto")
    .option(
      "--from <origem>",
      "origem (opcional): phone_number_id ou UUID do Número; no Instagram, id da conta na Meta ou UUID da Conta de canal",
    )
    .option(
      "--quick-reply <titulo[=payload]>",
      "opção de resposta (só Instagram, com --text; repita até 13 vezes; título até 20 caracteres)",
      collectQuickReply,
    )
    .option(
      "--quick-replies-json <json>",
      "lista completa de opções de resposta no formato da API (aceita content_type user_phone_number/user_email)",
    )
    .option("--input <arquivo>", "arquivo JSON com o corpo bruto da mensagem")
    .option("--stdin", "lê o corpo bruto da mensagem do stdin")
    .option(REPLY_TO_FLAG, REPLY_TO_HELP)
    .option(IDEMPOTENCY_FLAG, IDEMPOTENCY_HELP)
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const idempotencyKey: string | undefined = opts.idempotencyKey;
      if (opts.quickReply && opts.quickRepliesJson) {
        throw new Error("Use --quick-reply OU --quick-replies-json, não os dois.");
      }
      const quickReplies: QuickReply[] | undefined = opts.quickRepliesJson
        ? parseQuickRepliesJson(opts.quickRepliesJson)
        : opts.quickReply;

      // POST /messages responde o objeto DIRETO (sem envelope `data`); ambos os
      // caminhos devolvem o mesmo shape { id, wamid|external_id, to, status }.
      let result: SendResult;
      if (opts.input || opts.stdin) {
        if (quickReplies) {
          throw new Error("Com --input/--stdin, inclua quick_replies no próprio JSON.");
        }
        if (opts.replyTo !== undefined) {
          throw new Error("Com --input/--stdin, inclua reply_to no próprio JSON.");
        }
        // Payload cru: contrato de baixo nível do SDK (`request`), sem montar o corpo.
        const body = readRawBody(opts.input, opts.stdin);
        result = await client.request<SendResult>("POST", "/messages", { body, idempotencyKey });
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
          ...(quickReplies ? { quick_replies: quickReplies } : {}),
          ...replyTo(opts.replyTo),
        }, { idempotencyKey });
      }

      if (format === "json") return printJson(result);
      printLine("Mensagem enfileirada.");
      printDetail(result as unknown as Record<string, unknown>, receiptFields(result));
    });

  const printSent = (result: SendResult, format: string) => {
    if (format === "json") return printJson(result);
    printLine("Mensagem enfileirada.");
    printDetail(result as unknown as Record<string, unknown>, receiptFields(result));
  };

  messages
    .command("send-media")
    .description("Envia image, video, audio ou document por URL https pública (WhatsApp ou Instagram)")
    .requiredOption(
      "--to <destinatario>",
      "destinatário: telefone E.164 ou BSUID no WhatsApp; IGSID no Instagram",
    )
    .requiredOption("--type <tipo>", "image | video | audio | document")
    .requiredOption("--link <url>", "URL https pública do arquivo")
    .option("--caption <texto>", "legenda (image, video ou document; o Instagram não aceita legenda)")
    .option("--filename <nome>", "nome do arquivo (só document)")
    .option(
      "--voice",
      "mensagem de voz do WhatsApp (só --type audio; arquivo .ogg com Opus mono, senão 422 invalid_voice)",
    )
    .option(REPLY_TO_FLAG, REPLY_TO_HELP)
    .option(
      "--from <origem>",
      "origem (opcional): phone_number_id ou UUID do Número; no Instagram, id da conta na Meta ou UUID da Conta de canal",
    )
    .option(IDEMPOTENCY_FLAG, IDEMPOTENCY_HELP)
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const type = opts.type as (typeof MEDIA_TYPES)[number];
      if (!MEDIA_TYPES.includes(type)) {
        throw new Error("--type deve ser image, video, audio ou document.");
      }
      if (opts.caption !== undefined && type === "audio") {
        throw new Error("--caption não é aceito em audio.");
      }
      if (opts.filename !== undefined && type !== "document") {
        throw new Error("--filename só é aceito com --type document.");
      }
      if (opts.voice && type !== "audio") {
        throw new Error("--voice só é aceito com --type audio.");
      }
      const params = {
        to: opts.to,
        type,
        link: opts.link,
        ...(opts.from ? { from: opts.from } : {}),
        ...(opts.caption !== undefined ? { caption: opts.caption } : {}),
        ...(opts.filename !== undefined ? { filename: opts.filename } : {}),
        ...(opts.voice ? { voice: true } : {}),
        ...replyTo(opts.replyTo),
      } as SendMediaParams;
      printSent(await client.messages.sendMedia(params, { idempotencyKey: opts.idempotencyKey }), format);
    });

  messages
    .command("send-interactive")
    .description(
      "Envia interactive: WhatsApp button/list/cta_url/location_request_message (pede a localização do contato: " +
        "só body.text e action {name: send_location}, sem header/footer); Instagram button (web_url/postback) ou generic (1–10 cards)",
    )
    .requiredOption("--to <destinatario>", "telefone/BSUID (WhatsApp) ou IGSID (Instagram)")
    .option("--from <origem>", "ID Meta/UUID do Número ou da Conta de canal")
    .option("--input <arquivo>", "arquivo JSON com o objeto interactive")
    .option("--tag <tag>", "human_agent (Instagram; sujeito à flag e janela da API)")
    .option("--stdin", "lê o objeto interactive do stdin")
    .option("--json <interactive>", "objeto interactive inline")
    .option(REPLY_TO_FLAG, REPLY_TO_HELP)
    .option(IDEMPOTENCY_FLAG, IDEMPOTENCY_HELP)
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.tag !== undefined && opts.tag !== "human_agent") throw new Error("--tag deve ser human_agent.");
      const interactive = (opts.json
        ? parseInline(opts.json)
        : readRawBody(opts.input, opts.stdin)) as InteractivePayload;
      const result = await client.messages.sendInteractive({
        to: opts.to,
        interactive,
        ...(opts.tag !== undefined ? { tag: opts.tag as "human_agent" } : {}),
        ...(opts.from ? { from: opts.from } : {}),
        ...replyTo(opts.replyTo),
      }, { idempotencyKey: opts.idempotencyKey });
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
    .option(REPLY_TO_FLAG, REPLY_TO_HELP)
    .option(IDEMPOTENCY_FLAG, IDEMPOTENCY_HELP)
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
        ...replyTo(opts.replyTo),
      }, { idempotencyKey: opts.idempotencyKey });
      printSent(result, format);
    });

  messages
    .command("react")
    .description("Reage a uma mensagem recebida no WhatsApp ou Instagram (use --remove para retirar a reação)")
    .requiredOption("--to <destinatario>", "destinatário (o contato): telefone/BSUID no WhatsApp, IGSID no Instagram")
    .requiredOption(
      "--message-id <id>",
      "mensagem recebida: UUID interno ou wamid no WhatsApp; mid (external_id) no Instagram",
    )
    .option("--emoji <emoji>", "emoji da reação")
    .option("--remove", "retira a reação (emoji vazio)")
    .option("--from <origem>", "origem (opcional): Número no WhatsApp; id da conta na Meta ou UUID da Conta de canal no Instagram")
    .option(IDEMPOTENCY_FLAG, IDEMPOTENCY_HELP)
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (!opts.remove && !opts.emoji) throw new Error("Informe --emoji ou --remove.");
      const result = await client.messages.sendReaction({
        to: opts.to,
        message_id: opts.messageId,
        emoji: opts.remove ? "" : opts.emoji,
        ...(opts.from ? { from: opts.from } : {}),
      }, { idempotencyKey: opts.idempotencyKey });
      if (format === "json") return printJson(result);
      printLine(opts.remove ? "Reação retirada." : "Reação enviada.");
      printDetail(
        { ...result, ...(result.reaction ?? {}), wamid: result.wamid } as unknown as Record<string, unknown>,
        [...receiptFields(result).filter((f) => f !== "id"), "action", "emoji"],
      );
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
