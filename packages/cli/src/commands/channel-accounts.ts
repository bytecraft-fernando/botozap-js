import { Command } from "commander";
import type { CreateCommentRuleParams, UpdateCommentRuleParams } from "@botozap/sdk";
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

function parseActive(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error("--active deve ser true ou false.");
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
    .option("--inactive", "cria a regra desligada")
    .action(async (channelAccountId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const params: CreateCommentRuleParams = {
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
    .option("--active <bool>", "true | false")
    .action(async (channelAccountId: string, ruleId: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const keyword = nullable(opts.keyword, opts.clearKeyword, "keyword");
      const replyText = nullable(opts.replyText, opts.clearReplyText, "reply-text");
      const mediaId = nullable(opts.mediaId, opts.clearMediaId, "media-id");
      const active = parseActive(opts.active);
      const params: UpdateCommentRuleParams = {
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
}
