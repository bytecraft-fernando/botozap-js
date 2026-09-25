import { Command } from "commander";
import { context, toInt, toBool } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
} from "../output.js";

function collect(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

export function registerContacts(program: Command): void {
  const contacts = program
    .command("contacts")
    .description("Gerenciar contatos");

  contacts
    .command("list")
    .description("Lista contatos (paginação por cursor)")
    .option("--customer-id <id>", "filtra por cliente")
    .option("--profile-name-contains <texto>", "filtra por nome do perfil")
    .option("--wa-id-contains <texto>", "filtra por wa_id")
    .option("--has-customer <bool>", "true | false")
    .option("--created-after <data>", "ISO 8601")
    .option("--created-before <data>", "ISO 8601")
    .option("--limit <n>", "quantidade por página")
    .option("--after <cursor>", "cursor da próxima página")
    .option("--before <cursor>", "cursor da página anterior")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const res = await client.contacts.list({
        customer_id: opts.customerId,
        profile_name_contains: opts.profileNameContains,
        wa_id_contains: opts.waIdContains,
        has_customer: toBool(opts.hasCustomer),
        created_after: opts.createdAfter,
        created_before: opts.createdBefore,
        limit: toInt(opts.limit),
        after: opts.after,
        before: opts.before,
      });
      if (format === "json") return printJson(res);
      printTable(res.data, [
        { header: "ID", key: "id", max: 36 },
        { header: "WA_ID", key: "wa_id" },
        { header: "NOME", key: "profile_name" },
        { header: "NOME DA EMPRESA", key: "display_name" },
        { header: "USERNAME", key: "username" },
        { header: "CLIENTE", key: "customer_id", max: 36 },
      ]);
      printCursorFooter(res.paging);
    });

  contacts
    .command("get <id>")
    .description("Detalha um contato")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.contacts.get(id);
      if (format === "json") return printJson(data);
      printDetail(data as Record<string, unknown>);
    });

  contacts
    .command("create")
    .description("Cria um contato")
    .requiredOption("--wa-id <wa_id>", "WhatsApp ID (obrigatório)")
    .option("--profile-name <nome>", "nome do perfil")
    .option("--display-name <nome>", "nome dado pela empresa (1–200 caracteres)")
    .option("--phone <telefone>", "telefone")
    .option("--user-id <id>", "id externo do usuário")
    .option("--username <username>", "username")
    .option("--customer-id <id>", "cliente vinculado")
    .option("--phone-number-id <id>", "número vinculado")
    .option("--tag <tag>", "tag do contato (repetível; até 20 × 40 caracteres)", collect)
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.contacts.create({
        wa_id: opts.waId,
        profile_name: opts.profileName,
        display_name: opts.displayName,
        phone: opts.phone,
        user_id: opts.userId,
        username: opts.username,
        customer_id: opts.customerId,
        phone_number_id: opts.phoneNumberId,
        ...(opts.tag ? { tags: opts.tag as string[] } : {}),
      });
      if (format === "json") return printJson(data);
      printLine("Contato criado.");
      printDetail(data as Record<string, unknown>);
    });

  contacts
    .command("update <id>")
    .description("Atualiza um contato")
    .option("--profile-name <nome>", "novo nome do perfil")
    .option("--display-name <nome>", "nome dado pela empresa (1–200 caracteres)")
    .option("--clear-display-name", "remove o nome dado pela empresa")
    .option("--username <username>", "novo username")
    .option("--tag <tag>", "substitui todas as tags (repetível)", collect)
    .option("--add-tag <tag>", "acrescenta tag (repetível)", collect)
    .option("--remove-tag <tag>", "remove tag (repetível)", collect)
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      if (opts.displayName !== undefined && opts.clearDisplayName) {
        throw new Error("Use --display-name OU --clear-display-name, não os dois.");
      }
      const body: Record<string, unknown> = {};
      if (opts.profileName !== undefined) body.profile_name = opts.profileName;
      if (opts.displayName !== undefined) body.display_name = opts.displayName;
      if (opts.clearDisplayName) body.display_name = null;
      if (opts.username !== undefined) body.username = opts.username;
      if (opts.tag) body.tags = opts.tag;
      if (opts.addTag) body.add_tags = opts.addTag;
      if (opts.removeTag) body.remove_tags = opts.removeTag;
      if (opts.tag && (opts.addTag || opts.removeTag)) {
        throw new Error(
          "Use --tag para substituir a lista ou --add-tag/--remove-tag para alterá-la, não os dois.",
        );
      }
      if (Object.keys(body).length === 0) {
        throw new Error(
          "Informe ao menos --profile-name, --display-name, --clear-display-name, --username, --tag, --add-tag ou --remove-tag.",
        );
      }
      const data = await client.contacts.update(id, body);
      if (format === "json") return printJson(data);
      printLine("Contato atualizado.");
      printDetail(data as Record<string, unknown>);
    });

  contacts
    .command("delete <id>")
    .description("Remove um contato")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await client.contacts.delete(id);
      if (format === "json") return printJson({ deleted: true });
      printLine("Contato removido.");
    });
}
