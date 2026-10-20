import { Command, Option } from "commander";
import { collect, context, toInt, toBool } from "./shared.js";
import {
  printJson,
  printTable,
  printDetail,
  printCursorFooter,
  printLine,
} from "../output.js";

export function registerContacts(program: Command): void {
  const contacts = program
    .command("contacts")
    .description("Gerenciar contatos");

  contacts
    .command("list")
    .description("Lista contatos (paginação por cursor)")
    .addOption(new Option("--follows-business <bool>", "filtra seguidores do Instagram (valores conhecidos)").choices(["true", "false"]))
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
        ig_follows_business: opts.followsBusiness === undefined ? undefined : opts.followsBusiness === "true",
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
      for (const warning of data.warnings ?? []) {
        printLine(`Aviso [${warning.code}] (${warning.channel}, ${warning.purpose}): ${warning.message}`);
      }
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
    .command("consents <id>")
    .description("Consentimentos do contato: o vigente por canal e finalidade e o histórico")
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.contacts.listConsents(id);
      if (format === "json") return printJson(data);
      const columns = [
        { header: "CANAL", key: "channel" },
        { header: "FINALIDADE", key: "purpose" },
        { header: "ESTADO", key: "state" },
        { header: "ORIGEM", key: "origin" },
        { header: "EVIDÊNCIA", key: "evidence", max: 40 },
        { header: "QUANDO", key: "created_at" },
      ];
      printLine("Vigente:");
      printTable(data.current as unknown as Record<string, unknown>[], columns);
      printLine("");
      printLine("Histórico:");
      printTable(data.history as unknown as Record<string, unknown>[], columns);
    });

  contacts
    .command("record-consent <id>")
    .description(
      "Registra um consentimento do contato (origem api). Sobre uma recusa do próprio contato " +
        "responde consent_opted_out (409) e nada é gravado: só ele volta a aceitar",
    )
    .addOption(new Option("--channel <canal>", "whatsapp | instagram").choices(["whatsapp", "instagram"]).makeOptionMandatory())
    .addOption(new Option("--purpose <finalidade>", "marketing | utility").choices(["marketing", "utility"]).makeOptionMandatory())
    .addOption(new Option("--state <estado>", "granted (aceitou) | revoked (recusou)").choices(["granted", "revoked"]).makeOptionMandatory())
    .option("--evidence <texto>", "evidência do consentimento (até 500 caracteres)")
    .action(async (id: string, opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.contacts.recordConsent(id, {
        channel: opts.channel,
        purpose: opts.purpose,
        state: opts.state,
        ...(opts.evidence !== undefined ? { evidence: opts.evidence } : {}),
      });
      if (format === "json") return printJson(data);
      printLine("Consentimento registrado.");
      printDetail(data as unknown as Record<string, unknown>);
    });

  contacts
    .command("delete <id>")
    .description(
      "Remove um contato e o que é dele (conversas, mensagens, CRM, consentimentos), e apaga a mídia. " +
        "A recusa fica guardada como código cifrado (hash) e vale se o contato voltar",
    )
    .action(async (id: string, _opts, cmd: Command) => {
      const { client, format } = context(cmd);
      await client.contacts.delete(id);
      if (format === "json") return printJson({ deleted: true });
      printLine("Contato removido.");
    });
}
