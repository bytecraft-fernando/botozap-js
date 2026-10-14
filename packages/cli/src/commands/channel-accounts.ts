import { Command } from "commander";
import { readFileSync } from "node:fs";
import type { CreateCommentRuleParams, UpdateCommentRuleParams, UpdateMessengerProfileParams } from "@botozap/sdk";
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

function ruleExtensions(opts: Record<string, string | undefined>): UpdateCommentRuleParams {
  const keywords = stringList(opts.keywords, "keywords");
  const excludedKeywords = stringList(opts.excludedKeywords, "excluded-keywords");
  const replyVariations = stringList(opts.replyVariations, "reply-variations");
  const nextPost = parseActive(opts.nextPost, "next-post");
  return {
    ...(keywords !== undefined ? { keywords } : {}),
    ...(excludedKeywords !== undefined ? { excluded_keywords: excludedKeywords } : {}),
    ...(replyVariations !== undefined ? { reply_variations: replyVariations } : {}),
    ...(nextPost !== undefined ? { next_post: nextPost } : {}),
  };
}

function profilePatch(opts: { json?: string; input?: string; stdin?: boolean }): UpdateMessengerProfileParams {
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
  return value as UpdateMessengerProfileParams;
}

export function registerChannelAccounts(program: Command): void {
  const accounts = program
    .command("channel-accounts")
    .description("Contas de canal (Números do WhatsApp e Contas do Instagram) e Regras de comentário");

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
    .requiredOption("--dm-text <texto>", "direct enviado a quem comentou (até 1000 bytes)")
    .option("--keyword <palavra>", "palavra-chave (até 60 caracteres); omitida = qualquer comentário")
    .option("--reply-text <texto>", "resposta pública ao comentário (até 2200 caracteres)")
    .option("--media-id <id>", "id numérico do post (media.id); omitido = todos os posts")
    .option("--keywords <json>", "lista JSON de expressões; [] = qualquer comentário")
    .option("--excluded-keywords <json>", "lista JSON de expressões excluídas")
    .option("--reply-variations <json>", "lista JSON de respostas públicas")
    .option("--next-post <bool>", "true | false; aguarda o próximo post")
    .option("--inactive", "cria a regra desligada")
    .action(async (channelAccountId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const params: CreateCommentRuleParams = {
        ...ruleExtensions(opts),
        dm_text: opts.dmText,
        ...(opts.keyword !== undefined ? { keyword: opts.keyword } : {}),
        ...(opts.replyText !== undefined ? { reply_text: opts.replyText } : {}),
        ...(opts.mediaId !== undefined ? { media_id: opts.mediaId } : {}),
        ...(opts.inactive ? { is_active: false } : {}),
      };
      const data = await client.channelAccounts.createCommentRule(channelAccountId, params);
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
    .option("--next-post <bool>", "true | false")
    .option("--active <bool>", "true | false")
    .action(async (channelAccountId: string, ruleId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const keyword = nullable(opts.keyword, opts.clearKeyword, "keyword");
      const replyText = nullable(opts.replyText, opts.clearReplyText, "reply-text");
      const mediaId = nullable(opts.mediaId, opts.clearMediaId, "media-id");
      const active = parseActive(opts.active);
      const params: UpdateCommentRuleParams = {
        ...ruleExtensions(opts),
        ...(opts.dmText !== undefined ? { dm_text: opts.dmText } : {}),
        ...(keyword !== undefined ? { keyword } : {}),
        ...(replyText !== undefined ? { reply_text: replyText } : {}),
        ...(mediaId !== undefined ? { media_id: mediaId } : {}),
        ...(active !== undefined ? { is_active: active } : {}),
      };
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
        : operation === "update" ? await client.channelAccounts.updateMessengerProfile(id, profilePatch(opts))
        : operation === "delete" ? await client.channelAccounts.deleteMessengerProfile(id)
        : await client.channelAccounts.syncMessengerProfile(id);
      if (format === "json") return printJson(data);
      printDetail(data as unknown as Record<string, unknown>);
    });
  }

}
