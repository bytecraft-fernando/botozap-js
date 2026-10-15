import { Command, Option } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import type { CreateCommentRuleParams, UpdateCommentRuleParams, UpdateMessengerProfileParams, CreateMessageRuleParams, UpdateMessageRuleParams } from "@botozap/sdk";
import { context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printOffsetFooter,
  printLine,
} from "../output.js";

const RULE_COLUMNS = [
  { header: "ID", key: "id", max: 36 },
  { header: "PALAVRA-CHAVE", key: "keyword" },
  { header: "POST", key: "media_id" },
  { header: "STATUS", key: "status" },
  { header: "DIRECT", key: "dm_text", max: 40 },
];

/** Texto opcional que pode ser limpo: `--x ""` ou `--clear-x` viram `null`. */
function nullable(value: string | undefined, clear: boolean | undefined, flag: string): string | null | undefined {
  if (value !== undefined && clear) throw new Error(`Use --${flag} OU --clear-${flag}, não os dois.`);
  if (clear) return null;
  return value;
}

function parseActive(raw: string | undefined, flag = "active"): boolean | undefined {
  if (raw === undefined) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`--${flag} deve ser true ou false.`);
}

function stringList(raw: string | undefined, flag: string): string[] | undefined {
  if (raw === undefined) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error(`--${flag} deve ser uma lista JSON de textos.`); }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`--${flag} deve ser uma lista JSON de textos.`);
  }
  return value;
}

function ruleExtensions(opts: { live?: string; requireFollow?: string; nonFollowerText?: string; clearNonFollowerText?: boolean; keywords?: string; excludedKeywords?: string; replyVariations?: string; nextPost?: string; dmButtonTitle?: string; deliveryText?: string; deliveryMedia?: string; clearDmButtonTitle?: boolean; clearDeliveryText?: boolean; clearDeliveryMedia?: boolean }): UpdateCommentRuleParams {
  const live = parseActive(opts.live, "live");
  const follow = followFields(opts);
  const keywords = stringList(opts.keywords, "keywords");
  const excludedKeywords = stringList(opts.excludedKeywords, "excluded-keywords");
  const replyVariations = stringList(opts.replyVariations, "reply-variations");
  const nextPost = parseActive(opts.nextPost, "next-post");
  const dmButtonTitle = nullable(opts.dmButtonTitle, opts.clearDmButtonTitle, "dm-button-title");
  const deliveryText = nullable(opts.deliveryText, opts.clearDeliveryText, "delivery-text");
  const deliveryMedia = nullable(opts.deliveryMedia, opts.clearDeliveryMedia, "delivery-media");
  return {
    ...follow,
    ...(live !== undefined ? { live } : {}),
    ...(dmButtonTitle !== undefined ? { dm_button_title: dmButtonTitle } : {}),
    ...(deliveryText !== undefined ? { delivery_text: deliveryText } : {}),
    ...(deliveryMedia !== undefined ? { delivery_media: deliveryMedia } : {}),
    ...(keywords !== undefined ? { keywords } : {}),
    ...(excludedKeywords !== undefined ? { excluded_keywords: excludedKeywords } : {}),
    ...(replyVariations !== undefined ? { reply_variations: replyVariations } : {}),
    ...(nextPost !== undefined ? { next_post: nextPost } : {}),
  };
}

function followFields(opts: { requireFollow?: string; nonFollowerText?: string; clearNonFollowerText?: boolean }) {
  const requireFollow = parseActive(opts.requireFollow, "require-follow");
  const nonFollowerText = nullable(opts.nonFollowerText, opts.clearNonFollowerText, "non-follower-text");
  return {
    ...(requireFollow !== undefined ? { require_follow: requireFollow } : {}),
    ...(nonFollowerText !== undefined ? { non_follower_text: nonFollowerText } : {}),
  };
}

/** JSON carrega os campos principais; flags explícitas complementam o objeto. */
function messagePayload(opts: { json?: string; input?: string; stdin?: boolean; requireFollow?: string; nonFollowerText?: string; clearNonFollowerText?: boolean }) {
  const fields = followFields(opts);
  const hasSource = opts.json !== undefined || opts.input !== undefined || opts.stdin;
  if (!hasSource && !Object.keys(fields).length) throw new Error("Informe uma fonte: --json, --input ou --stdin, ou flags de campos.");
  const body = hasSource ? jsonObject(opts) : {};
  for (const key of Object.keys(fields)) {
    if (key in body) throw new Error(`Campo ${key} informado no JSON e na flag.`);
  }
  return { ...body, ...fields };
}

function jsonObject(opts: { json?: string; input?: string; stdin?: boolean }): Record<string, unknown> {
  if ([opts.json !== undefined, opts.input !== undefined, Boolean(opts.stdin)].filter(Boolean).length !== 1) {
    throw new Error("Informe uma fonte: --json, --input ou --stdin.");
  }
  const raw = opts.json ?? readFileSync(opts.input ?? 0, "utf8");
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("O payload informado não é um JSON válido."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("O patch deve ser um objeto JSON.");
  }
  return value as Record<string, unknown>;
}

/** Fonte JSON exclusiva com flags; ausências/null são preservadas. */
function commentPayload(opts: Record<string, unknown>, flags: UpdateCommentRuleParams): UpdateCommentRuleParams {
  if (opts.json !== undefined || opts.input !== undefined || opts.stdin) {
    if (Object.keys(flags).length) throw new Error("Use uma fonte JSON OU flags de campos, não as duas.");
    return jsonObject(opts as { json?: string; input?: string; stdin?: boolean }) as UpdateCommentRuleParams;
  }
  return flags;
}

export function registerChannelAccounts(program: Command): void {
  const accounts = program
    .command("channel-accounts")
    .description("Contas de canal e configurações do Instagram");

  accounts
    .command("list")
    .description("Lista Contas de canal (paginação por offset)")
    .option("--channel <canal>", "whatsapp | instagram")
    .option("--customer-id <id>", "filtra por cliente")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.channelAccounts.list({
        channel: opts.channel,
        customer_id: opts.customerId,
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      // Token da conexão: bloco `instagram` ou `whatsapp`, conforme o canal.
      const rows = res.data.map((account) => ({
        ...account,
        token: account.instagram?.token_status ?? account.whatsapp?.token_status ?? null,
      }));
      printTable(rows, [
        { header: "ID", key: "id", max: 36 },
        { header: "CANAL", key: "channel" },
        { header: "NOME", key: "display" },
        { header: "ID NA META", key: "external_id" },
        { header: "STATUS", key: "status" },
        { header: "TOKEN", key: "token" },
        { header: "CLIENTE", key: "customer_id", max: 36 },
      ]);
      printOffsetFooter(res.meta);
    });

  accounts
    .command("get <id>")
    .description("Detalha uma Conta de canal (UUID interno ou id na Meta)")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.channelAccounts.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  const connection = accounts.command("connection").description("Estado e operações da conexão Instagram (sem sandbox)");
  for (const operation of ["get", "resubscribe", "disconnect"] as const) {
    connection.command(`${operation} <channel_account_id>`)
      .description({ get: "Lê estado e diagnóstico", resubscribe: "Refaz a assinatura com a autorização existente", disconnect: "Desconecta a conta (chave de API; OAuth somente painel)" }[operation])
      .action(async (id: string, _opts, cmd: Command) => {
        const { client, format } = context(cmd);
        const data = operation === "get" ? await client.channelAccounts.getConnection(id)
          : operation === "resubscribe" ? await client.channelAccounts.resubscribeConnection(id)
          : await client.channelAccounts.disconnect(id);
        if (format === "json") return printJson(data);
        printDetail({ ...data });
      });
  }

  const rules = accounts
    .command("comment-rules")
    .description("Regras de comentário de uma Conta do Instagram (direct automático para quem comenta)");

  rules
    .command("list <channel_account_id>")
    .description("Lista as Regras de comentário (paginação por offset)")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (channelAccountId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.channelAccounts.listCommentRules(channelAccountId, {
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, RULE_COLUMNS);
      printOffsetFooter(res.meta);
    });

  rules
    .command("get <channel_account_id> <rule_id>")
    .description("Detalha uma Regra de comentário")
    .action(async (channelAccountId: string, ruleId: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.channelAccounts.getCommentRule(channelAccountId, ruleId);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  rules
    .command("create <channel_account_id>")
    .description("Cria uma Regra de comentário (exige plano com Regras de comentário)")
    .option("--dm-text <texto>", "abertura (1000 bytes sem botão; 640 caracteres com botão)")
    .option("--keyword <palavra>", "palavra-chave (até 60 caracteres); omitida = qualquer comentário")
    .option("--reply-text <texto>", "resposta pública ao comentário (até 2200 caracteres)")
    .option("--media-id <id>", "id numérico do post (media.id); omitido = todos os posts")
    .option("--keywords <json>", "lista JSON de expressões; [] = qualquer comentário")
    .option("--excluded-keywords <json>", "lista JSON de expressões excluídas")
    .option("--reply-variations <json>", "lista JSON de respostas públicas")
    .option("--live <bool>", "true | false; durante lives (422 feature_unavailable sem suporte no servidor)")
    .option("--require-follow <bool>", "true | false; entrega só para seguidores")
    .option("--non-follower-text <texto>", "resposta para quem não segue")
    .option("--clear-non-follower-text", "remove o texto para quem não segue")
    .option("--next-post <bool>", "true | false; aguarda o próximo post")
    .option("--dm-button-title <texto>", "título do botão (20 caracteres)")
    .option("--delivery-text <texto>", "texto entregue após toque (1000 bytes)")
    .option("--delivery-media <url>", "imagem HTTPS pública entregue após toque")
    .option("--input <arquivo>", "objeto JSON da regra")
    .option("--json <objeto>", "objeto JSON inline")
    .option("--stdin", "lê objeto JSON do stdin")
    .option("--inactive", "cria a regra desligada")
    .action(async (channelAccountId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const params = commentPayload(opts, {
        ...ruleExtensions(opts),
        ...(opts.dmText !== undefined ? { dm_text: opts.dmText } : {}),
        ...(opts.keyword !== undefined ? { keyword: opts.keyword } : {}),
        ...(opts.replyText !== undefined ? { reply_text: opts.replyText } : {}),
        ...(opts.mediaId !== undefined ? { media_id: opts.mediaId } : {}),
        ...(opts.inactive ? { is_active: false } : {}),
      });
      if (typeof params.dm_text !== "string" || !params.dm_text) throw new Error("Informe --dm-text ou dm_text na fonte JSON.");
      const data = await client.channelAccounts.createCommentRule(channelAccountId, params as CreateCommentRuleParams);
      if (format === "json") return printJson(data);
      printLine("Regra de comentário criada.");
      if (data.notice) printLine(data.notice);
      printDetail(data as Record<string, unknown>);
    });

  rules
    .command("update <channel_account_id> <rule_id>")
    .description("Altera uma Regra de comentário (só os campos informados; desative com --active false)")
    .option("--dm-text <texto>", "direct enviado a quem comentou")
    .option("--keyword <palavra>", "palavra-chave")
    .option("--clear-keyword", "vale para qualquer comentário")
    .option("--reply-text <texto>", "resposta pública ao comentário")
    .option("--clear-reply-text", "remove a resposta pública")
    .option("--media-id <id>", "id numérico do post")
    .option("--clear-media-id", "vale para todos os posts")
    .option("--keywords <json>", "lista JSON de expressões; [] limpa")
    .option("--excluded-keywords <json>", "lista JSON de exclusões; [] limpa")
    .option("--reply-variations <json>", "lista JSON de respostas públicas; [] limpa")
    .option("--live <bool>", "true | false; durante lives (422 feature_unavailable sem suporte no servidor)")
    .option("--require-follow <bool>", "true | false; entrega só para seguidores")
    .option("--non-follower-text <texto>", "resposta para quem não segue")
    .option("--clear-non-follower-text", "remove o texto para quem não segue")
    .option("--next-post <bool>", "true | false")
    .option("--active <bool>", "true | false")
    .option("--dm-button-title <texto>", "título do botão (20 caracteres)")
    .option("--clear-dm-button-title", "remove o botão")
    .option("--delivery-text <texto>", "texto entregue após toque")
    .option("--clear-delivery-text", "remove o texto de entrega")
    .option("--delivery-media <url>", "imagem HTTPS pública")
    .option("--clear-delivery-media", "remove a imagem de entrega")
    .option("--input <arquivo>", "patch JSON da regra")
    .option("--json <objeto>", "patch JSON inline")
    .option("--stdin", "lê patch JSON do stdin")
    .action(async (channelAccountId: string, ruleId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const keyword = nullable(opts.keyword, opts.clearKeyword, "keyword");
      const replyText = nullable(opts.replyText, opts.clearReplyText, "reply-text");
      const mediaId = nullable(opts.mediaId, opts.clearMediaId, "media-id");
      const active = parseActive(opts.active);
      const params = commentPayload(opts, {
        ...ruleExtensions(opts),
        ...(opts.dmText !== undefined ? { dm_text: opts.dmText } : {}),
        ...(keyword !== undefined ? { keyword } : {}),
        ...(replyText !== undefined ? { reply_text: replyText } : {}),
        ...(mediaId !== undefined ? { media_id: mediaId } : {}),
        ...(active !== undefined ? { is_active: active } : {}),
      });
      if (Object.keys(params).length === 0) {
        throw new Error("Informe ao menos um campo para alterar.");
      }
      const data = await client.channelAccounts.updateCommentRule(channelAccountId, ruleId, params);
      if (format === "json") return printJson(data);
      printLine("Regra de comentário atualizada.");
      if (data.notice) printLine(data.notice);
      printDetail(data as Record<string, unknown>);
    });

  rules
    .command("delete <channel_account_id> <rule_id>")
    .description("Exclui uma Regra de comentário")
    .action(async (channelAccountId: string, ruleId: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.channelAccounts.deleteCommentRule(channelAccountId, ruleId);
      if (format === "json") return printJson(data);
      printLine("Regra de comentário excluída.");
      printDetail({ ...data });
    });

  rules.command("metrics <channel_account_id> <rule_id>")
    .description("Resultados por período e post (comment-rules:read)")
    .requiredOption("--from <iso>", "início ISO 8601 com fuso")
    .requiredOption("--to <iso>", "fim ISO 8601 com fuso; posterior ao início")
    .action(async (id: string, ruleId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.channelAccounts.getCommentRuleMetrics(id, ruleId, { from: opts.from, to: opts.to });
      if (format === "json") return printJson(data);
      printDetail(data as unknown as Record<string, unknown>);
    });

  const messageRules = accounts.command("message-rules").description("Regras de mensagem do Instagram (message-rules:read/write)");
  messageRules.command("list <channel_account_id>")
    .description("Lista Regras de mensagem (paginação offset)")
    .option("--page <n>", "página").option("--per-page <n>", "itens por página")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.channelAccounts.listMessageRules(id, { page: toInt(opts.page), per_page: toInt(opts.perPage) });
      if (format === "json") return printJson(res);
      printTable(res.data.map(rule => ({ ...rule })), [{ header: "ID", key: "id", max: 36 }, { header: "NOME", key: "name" },
        { header: "GATILHO", key: "trigger" }, { header: "PRIORIDADE", key: "priority" }, { header: "ATIVA", key: "is_active" }]);
      printOffsetFooter(res.meta);
    });
  messageRules.command("qr <channel_account_id> <rule_id>")
    .description("Baixa o QR do link ig.me da Regra (message-rules:read)")
    .requiredOption("--out <arquivo>", "arquivo de destino")
    .addOption(new Option("--format <formato>", "formato do QR").choices(["png", "svg"]).default("png"))
    .action(async (id: string, ruleId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const bytes = await client.channelAccounts.getMessageRuleQr(id, ruleId, { format: opts.format });
      writeFileSync(opts.out, Buffer.from(bytes));
      if (format === "json") return printJson({ out: opts.out, format: opts.format, bytes: bytes.byteLength });
      printLine(`QR salvo em ${opts.out}.`);
    });
  for (const operation of ["get", "create", "update", "delete"] as const) {
    const command = messageRules.command(`${operation} <channel_account_id>${operation === "create" ? "" : " <rule_id>"}`)
      .description({ get: "Detalha a Regra", create: "Cria a Regra por JSON", update: "Altera campos por patch JSON", delete: "Exclui a Regra" }[operation]);
    if (operation === "create" || operation === "update") command
      .option("--input <arquivo>", "objeto JSON")
      .option("--json <objeto>", "objeto JSON inline")
      .option("--stdin", "lê objeto JSON do stdin")
      .option("--require-follow <bool>", "true | false")
      .option("--non-follower-text <texto>", "resposta para quem não segue")
      .option("--clear-non-follower-text", "remove a resposta para quem não segue");
    command.action(async (...args: unknown[]) => {
      const id = args[0] as string;
      const ruleId = operation === "create" ? undefined : args[1] as string;
      const opts = args[args.length - 2] as Parameters<typeof messagePayload>[0];
      const { client, format } = context(args[args.length - 1] as Command);
      const data = operation === "get" ? await client.channelAccounts.getMessageRule(id, ruleId!)
        : operation === "delete" ? await client.channelAccounts.deleteMessageRule(id, ruleId!)
        : operation === "create" ? await client.channelAccounts.createMessageRule(id, messagePayload(opts) as unknown as CreateMessageRuleParams)
        : await client.channelAccounts.updateMessageRule(id, ruleId!, messagePayload(opts) as UpdateMessageRuleParams);
      if (format === "json") return printJson(data);
      printDetail(data as unknown as Record<string, unknown>);
    });
  }

  const profile = accounts.command("messenger-profile")
    .description("Perguntas e menu do Instagram (sem sandbox)");
  for (const operation of ["get", "update", "delete", "sync"] as const) {
    const command = profile.command(operation)
      .description({ get: "Lê o espelho salvo", update: "Salva/aplica o patch (ausente preserva; null remove)",
        delete: "Remove perguntas e menu", sync: "Verifica/reaplica a configuração salva" }[operation])
      .requiredOption("--channel-account-id <id>", "UUID da Conta do Instagram");
    if (operation === "update") command
      .option("--input <arquivo>", "arquivo JSON com o patch")
      .option("--stdin", "lê o patch JSON do stdin")
      .option("--json <patch>", "patch JSON inline");
    command.action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const id = opts.channelAccountId;
      const data = operation === "get" ? await client.channelAccounts.getMessengerProfile(id)
        : operation === "update" ? await client.channelAccounts.updateMessengerProfile(id, jsonObject(opts) as UpdateMessengerProfileParams)
        : operation === "delete" ? await client.channelAccounts.deleteMessengerProfile(id)
        : await client.channelAccounts.syncMessengerProfile(id);
      if (format === "json") return printJson(data);
      printDetail(data as unknown as Record<string, unknown>);
    });
  }

}
