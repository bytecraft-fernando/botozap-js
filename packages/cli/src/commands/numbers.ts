import { Command } from "commander";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type {
  ConversationalCommand,
  QrImageFormat,
  UpdateConversationalAutomationParams,
  UpdateWhatsAppProfileParams,
  WhatsAppBusinessProfile,
  WhatsAppBusinessVertical,
} from "@botozap/sdk";
import { collect, confirmDestructive, context, toInt } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printOffsetFooter,
  printCursorFooter,
  printLine,
} from "../output.js";

export function registerNumbers(program: Command): void {
  const numbers = program
    .command("numbers")
    .description("Números de telefone (WhatsApp) conectados");

  numbers
    .command("list")
    .description("Lista números (paginação por offset)")
    .option("--customer-id <id>", "filtra por cliente")
    .option("--page <n>", "página")
    .option("--per-page <n>", "itens por página")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.phoneNumbers.list({
        customer_id: opts.customerId,
        page: toInt(opts.page),
        per_page: toInt(opts.perPage),
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "NÚMERO", key: "display_phone_number" },
        { header: "NOME", key: "verified_name" },
        { header: "RÓTULO", key: "label" },
        { header: "STATUS", key: "connection_status" },
        { header: "QUALIDADE", key: "quality_rating" },
        {
          header: "SUSPENSO",
          key: "plan_suspended",
          format: (v) => (v === true ? "sim (Free)" : v === false ? "não" : ""),
        },
      ]);
      printOffsetFooter(res.meta);
    });

  numbers
    .command("get <id>")
    .description("Detalha um número")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  numbers
    .command("update <id>")
    .description("Atualiza o rótulo (nome local) de um número")
    .option("--label <nome>", "nome local (até 100 caracteres, sem quebras de linha)")
    .option("--clear-label", "remove o nome local")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.label !== undefined && opts.clearLabel) {
        throw new Error("Use --label OU --clear-label, não os dois.");
      }
      if (opts.label === undefined && !opts.clearLabel) {
        throw new Error("Informe --label <nome> ou --clear-label.");
      }
      const data = await client.phoneNumbers.update(id, {
        label: opts.clearLabel ? null : (opts.label as string),
      });
      if (format === "json") return printJson(data);
      printLine("Número atualizado.");
      printDetail(data as Record<string, unknown>);
    });

  registerNumberSettings(numbers);

  numbers
    .command("health <id>")
    .description("Verifica a saúde de um número")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.health(id);
      if (format === "json") return printJson(data);
      printDetail(data);
    });
}

const PHOTO_MAX = 4 * 1024 * 1024;
const QR_FORMATS = ["PNG", "SVG"] as const;

function qrFormat(value: unknown): QrImageFormat | undefined {
  if (value === undefined) return undefined;
  const format = String(value).toUpperCase();
  if (!(QR_FORMATS as readonly string[]).includes(format)) throw new Error("--format deve ser PNG ou SVG.");
  return format as QrImageFormat;
}

/** `nome=descrição` → comando (a `/` inicial é opcional). */
function parseCommand(value: string): ConversationalCommand {
  const index = value.indexOf("=");
  if (index <= 0) throw new Error("--command usa o formato nome=descrição (ex.: cardapio=Receber o cardápio do dia).");
  return { command_name: value.slice(0, index).trim(), command_description: value.slice(index + 1).trim() };
}

function printProfile(profile: WhatsAppBusinessProfile, format: string, message?: string) {
  if (format === "json") return printJson(profile);
  if (message) printLine(message);
  printDetail(profile as unknown as Record<string, unknown>);
  if (!profile.editable) {
    printLine("Número em coexistência (também no app WhatsApp Business): a Meta não aceita mudar o perfil pela API; edite pelo app.");
  }
}

/**
 * Configurações do número do WhatsApp (perfil, perguntas prontas e comandos,
 * QR codes e bloqueados), lidas e gravadas direto na Meta. `<id>` aceita o
 * UUID interno ou o phone_number_id da Meta.
 */
function registerNumberSettings(numbers: Command): void {
  const profile = numbers
    .command("profile")
    .description("Perfil do WhatsApp do número (Sobre, descrição, endereço, e-mail, sites, categoria e foto)");

  profile
    .command("get <id>")
    .description("Lê o perfil na Meta; editable=false em coexistência. Scope numbers:read")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      printProfile(await client.phoneNumbers.getProfile(id), format);
    });

  profile
    .command("update <id>")
    .description(
      "Muda campos do perfil na Meta (omitido mantém; vazio limpa, menos --about). É o contato público do negócio. " +
        "Coexistência: 409 coexistence_not_supported. Por OAuth a API responde 403 (só painel e chave de API). Scope numbers:write",
    )
    .option("--about <texto>", "Sobre (1 a 139 caracteres)")
    .option("--description <texto>", "descrição (até 512; \"\" limpa)")
    .option("--address <texto>", "endereço (até 256; \"\" limpa)")
    .option("--email <email>", "e-mail (até 128; \"\" limpa)")
    .option("--website <url>", "site com http(s):// (repita até 2 vezes)", collect)
    .option("--clear-websites", "remove os sites")
    .option("--vertical <categoria>", "categoria da Meta (RETAIL, RESTAURANT, BEAUTY, HEALTH, PROF_SERVICES, OTHER…)")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.website && opts.clearWebsites) throw new Error("Use --website OU --clear-websites, não os dois.");
      const params: UpdateWhatsAppProfileParams = {
        ...(opts.about !== undefined ? { about: opts.about as string } : {}),
        ...(opts.description !== undefined ? { description: opts.description as string } : {}),
        ...(opts.address !== undefined ? { address: opts.address as string } : {}),
        ...(opts.email !== undefined ? { email: opts.email as string } : {}),
        ...(opts.website ? { websites: opts.website as string[] } : opts.clearWebsites ? { websites: [] } : {}),
        ...(opts.vertical !== undefined ? { vertical: String(opts.vertical).toUpperCase() as WhatsAppBusinessVertical } : {}),
      };
      if (Object.keys(params).length === 0) {
        throw new Error("Informe ao menos um campo: --about, --description, --address, --email, --website ou --vertical.");
      }
      printProfile(await client.phoneNumbers.updateProfile(id, params), format, "Perfil atualizado na Meta.");
    });

  profile
    .command("photo <id> <arquivo>")
    .description("Troca a foto do perfil (JPG ou PNG, até 4 MB). Mesmas regras do update (coexistência 409, OAuth 403). Scope numbers:write")
    .action(async (id: string, path: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const ext = extname(path).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : null;
      if (!mime) throw new Error("A foto deve ser .jpg, .jpeg ou .png.");
      const size = (await stat(path)).size;
      if (!size || size > PHOTO_MAX) throw new Error("A foto deve ter de 1 byte a 4 MB.");
      const bytes = await readFile(path);
      const result = await client.phoneNumbers.uploadProfilePhoto(id, {
        file: new Blob([bytes], { type: mime }),
        file_name: basename(path),
        mime_type: mime,
      });
      printProfile(result, format, "Foto do perfil atualizada na Meta.");
    });

  const prompts = numbers
    .command("prompts")
    .description("Perguntas prontas (ice breakers) e comandos (/comando) do número");

  prompts
    .command("get <id>")
    .description("Lê as perguntas prontas e os comandos na Meta. Scope numbers:read")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.getConversationalAutomation(id);
      if (format === "json") return printJson(data);
      printLine(`Perguntas prontas (${data.prompts.length}/4):`);
      for (const prompt of data.prompts) printLine(`  - ${prompt}`);
      printLine(`Comandos (${data.commands.length}/30):`);
      for (const command of data.commands) printLine(`  /${command.command_name}  ${command.command_description}`);
    });

  prompts
    .command("update <id>")
    .description(
      "Grava perguntas e/ou comandos (omitido mantém; --clear-* remove). Até 4 perguntas de 80 caracteres e 30 comandos, sem emoji. " +
        "Gravar conteúdo exige plano com automações (403 plan_restricted). Scope numbers:write",
    )
    .option("--prompt <texto>", "pergunta pronta (repita até 4 vezes; substitui a lista)", collect)
    .option("--clear-prompts", "remove as perguntas prontas")
    .option("--command <nome=descrição>", "comando (repita até 30 vezes; substitui a lista)", collect)
    .option("--clear-commands", "remove os comandos")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.prompt && opts.clearPrompts) throw new Error("Use --prompt OU --clear-prompts, não os dois.");
      if (opts.command && opts.clearCommands) throw new Error("Use --command OU --clear-commands, não os dois.");
      const params: UpdateConversationalAutomationParams = {
        ...(opts.prompt ? { prompts: opts.prompt as string[] } : opts.clearPrompts ? { prompts: [] } : {}),
        ...(opts.command
          ? { commands: (opts.command as string[]).map(parseCommand) }
          : opts.clearCommands ? { commands: [] } : {}),
      };
      if (Object.keys(params).length === 0) {
        throw new Error("Informe --prompt, --command, --clear-prompts ou --clear-commands.");
      }
      const data = await client.phoneNumbers.updateConversationalAutomation(id, params);
      if (format === "json") return printJson(data);
      printLine(`Gravado na Meta: ${data.prompts.length} pergunta(s) pronta(s) e ${data.commands.length} comando(s).`);
    });

  prompts
    .command("clear <id>")
    .description("Remove todas as perguntas prontas e comandos do número (livre em qualquer plano). Scope numbers:write")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.clearConversationalAutomation(id);
      if (format === "json") return printJson(data);
      printLine("Perguntas prontas e comandos removidos.");
    });

  const qr = numbers
    .command("qr")
    .description("QR codes com mensagem pronta e link curto wa.me/message do número");

  qr
    .command("list <id>")
    .description("Lista os QR codes do número. Scope numbers:read")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.qrCodes.list(id);
      if (format === "json") return printJson(data);
      printTable(data as unknown as Record<string, unknown>[], [
        { header: "CÓDIGO", key: "code" },
        { header: "MENSAGEM", key: "prefilled_message", max: 60 },
        { header: "LINK", key: "deep_link_url" },
      ]);
    });

  qr
    .command("create <id>")
    .description(
      "Cria um QR code com mensagem pronta (até 140 caracteres). NÃO é idempotente: em 504 meta_unconfirmed, " +
        "rode qr list antes de criar de novo. Scope numbers:write",
    )
    .requiredOption("--message <texto>", "mensagem que já vem escrita (até 140 caracteres)")
    .option("--format <formato>", "PNG (padrão) | SVG")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const imageFormat = qrFormat(opts.format);
      const data = await client.phoneNumbers.qrCodes.create(id, {
        prefilled_message: opts.message as string,
        ...(imageFormat ? { image_format: imageFormat } : {}),
      });
      if (format === "json") return printJson(data);
      printLine("QR code criado. A imagem é um link temporário da Meta: baixe na hora.");
      printDetail(data as unknown as Record<string, unknown>);
    });

  qr
    .command("get <id> <code>")
    .description("Um QR code com qr_image_url temporária (baixe na hora). Scope numbers:read")
    .option("--format <formato>", "PNG (padrão) | SVG")
    .action(async (id: string, code: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const imageFormat = qrFormat(opts.format);
      const data = await client.phoneNumbers.qrCodes.get(id, code, imageFormat ? { image_format: imageFormat } : {});
      if (format === "json") return printJson(data);
      printDetail(data as unknown as Record<string, unknown>);
    });

  qr
    .command("update <id> <code>")
    .description("Troca a mensagem pronta; código, link e imagem continuam os mesmos. Scope numbers:write")
    .requiredOption("--message <texto>", "nova mensagem pronta (até 140 caracteres)")
    .action(async (id: string, code: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.qrCodes.update(id, code, { prefilled_message: opts.message as string });
      if (format === "json") return printJson(data);
      printLine("Mensagem do QR code atualizada.");
      printDetail(data as unknown as Record<string, unknown>);
    });

  qr
    .command("delete <id> <code>")
    .description("Apaga o QR code na Meta SEM VOLTA: quem escanear passa a ver \"expirado\". Scope numbers:write")
    .option("--yes", "confirma sem perguntar (obrigatório fora de um terminal)")
    .action(async (id: string, code: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await confirmDestructive(
        `Isto apaga o QR code ${code}: o código impresso e o link passam a dar "expirado".`,
        opts.yes as boolean | undefined,
      );
      await client.phoneNumbers.qrCodes.delete(id, code);
      if (format === "json") return printJson({ deleted: true });
      printLine("QR code apagado.");
    });

  const blocked = numbers
    .command("blocked")
    .description("Contatos bloqueados no número");

  blocked
    .command("list <id>")
    .description("Lista os bloqueados (100 por página). Scope numbers:read")
    .option("--after <cursor>", "cursor da próxima página")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.phoneNumbers.blockedUsers.list(id, opts.after ? { after: opts.after as string } : {});
      if (format === "json") return printJson(res);
      printTable(res.data as unknown as Record<string, unknown>[], [
        { header: "WA_ID", key: "wa_id" },
        { header: "CONTATO", key: "contact_id", max: 36 },
        { header: "NOME", key: "name" },
      ]);
      printCursorFooter(res.paging);
    });

  blocked
    .command("block <id>")
    .description(
      "Bloqueia um contato no número: ele não manda mensagem nem liga, e o número não envia nada para ele. " +
        "Só quem escreveu nas últimas 24 h (senão 422 block_window_closed). Scope numbers:write",
    )
    .option("--contact-id <uuid>", "contato da Conta neste número")
    .option("--user <telefone>", "telefone com DDI (ex.: +5511999999999)")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (Boolean(opts.contactId) === Boolean(opts.user)) throw new Error("Informe --contact-id OU --user.");
      const data = await client.phoneNumbers.blockedUsers.block(
        id,
        opts.contactId ? { contact_id: opts.contactId as string } : { user: opts.user as string },
      );
      if (format === "json") return printJson(data);
      printLine("Contato bloqueado.");
      printDetail(data as unknown as Record<string, unknown>);
    });

  blocked
    .command("unblock <id> <user>")
    .description(
      "Desbloqueia pelo wa_id da lista (ou telefone com DDI). Para bloquear de novo, o contato precisa ter escrito nas últimas 24 h. Scope numbers:write",
    )
    .action(async (id: string, user: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.phoneNumbers.blockedUsers.unblock(id, user);
      if (format === "json") return printJson(data);
      printLine("Contato desbloqueado.");
      printDetail(data as unknown as Record<string, unknown>);
    });
}
