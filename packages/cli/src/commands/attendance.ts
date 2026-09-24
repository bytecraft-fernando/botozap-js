import { readFile } from "node:fs/promises";
import { Command } from "commander";
import type {
  BotoZap,
  SavedReplyInput,
  InboxMutation,
  CreateOpportunity,
  CreateDemand,
  JourneyConfig,
  JourneyEnrollment,
  CrmQuery,
  RadarQuery,
  StageRuleInput,
} from "@botozap/sdk";
import { context } from "./shared.js";
import { printJson, printDetail, printTable, printLine } from "../output.js";

type Input = Record<string, unknown>;
type Operation = (
  client: BotoZap,
  id: string | undefined,
  input: Input,
) => Promise<unknown>;
/** JSON files preserve nested fields, null, Unicode and microsecond CAS timestamps. */
export async function readInput(
  path?: string,
  maxBytes = 256 * 1024,
): Promise<Input> {
  if (!path) return {};
  const raw = await readFile(path, "utf8");
  if (Buffer.byteLength(raw) > maxBytes)
    throw new Error(`JSON excede ${maxBytes} bytes.`);
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("O arquivo deve conter um objeto JSON.");
  return value as Input;
}
function display(value: unknown, format: string) {
  if (format === "json") return printJson(value ?? { success: true });
  if (value === undefined) return printLine("Operação concluída.");
  if (Array.isArray(value))
    return printTable(value, [
      { header: "ID", key: "id" },
      { header: "NOME", key: "name" },
      { header: "TÍTULO", key: "title" },
    ]);
  if (value && typeof value === "object") {
    const row = value as Input;
    if (Array.isArray(row.data)) {
      printTable(row.data, [
        { header: "ID", key: "id" },
        { header: "NOME", key: "name" },
        { header: "TÍTULO", key: "title" },
        { header: "ESTADO", key: "status" },
      ]);
      if (row.meta) printDetail(row.meta as Input);
      if (row.paging) printDetail(row.paging as Input);
      return;
    }
    return printDetail(row);
  }
  printJson(value);
}
export function operation(
  parent: Command,
  signature: string,
  description: string,
  run: Operation,
  required: string[] = [],
  inputOptions?: { validate: (input: Input) => void; maxBytes?: number },
) {
  const cmd = parent
    .command(signature)
    .description(description)
    .option(
      "--input-file <path>",
      "arquivo JSON com campos/filtros da operação; consulte --help",
    );
  if (required.length)
    cmd.addHelpText(
      "after",
      `\nCampos obrigatórios no JSON: ${required.join(", ")}.`,
    );
  cmd.action(async (...args: unknown[]) => {
    const command = args.at(-1) as Command;
    const opts = command.opts();
    const data = await readInput(
      opts.inputFile as string | undefined,
      inputOptions?.maxBytes,
    );
    for (const key of required)
      if (data[key] === undefined)
        throw new Error(`Campo obrigatório no JSON: ${key}.`);
    if (inputOptions) inputOptions.validate(data);
    else
      for (const key of ["expected_version", "version", "expected_revision"])
        if (
          data[key] !== undefined &&
          (!Number.isInteger(data[key]) ||
            Number(data[key]) < (signature.startsWith("stage-rule") ? 0 : 1))
        )
          throw new Error(`${key} deve ser inteiro positivo.`);
    const { client, format } = context(command);
    const id = signature.includes("<id>") ? String(args[0]) : undefined;
    display(await run(client, id, data), format);
  });
  return cmd;
}
export function registerAttendance(program: Command) {
  const saved = program
    .command("saved-replies")
    .description(
      "Respostas compartilhadas (scope saved_replies:read/write); pessoais pertencem à sessão",
    );
  operation(
    saved,
    "list",
    "Filtros: query, customer_id (UUID ou account), include_account, page, per_page",
    (c, _id, p) => c.savedReplies.list(p),
  );
  operation(
    saved,
    "get <id>",
    "Lê resposta e updated_at para edição",
    (c, id) => c.savedReplies.get(id!),
  );
  operation(
    saved,
    "create",
    "Cria resposta: title, body, shortcut, customer_id",
    (c, _id, p) => c.savedReplies.create(p as unknown as SavedReplyInput),
    ["title", "body"],
  );
  operation(
    saved,
    "update <id>",
    "Atualiza campos com CAS (expected_updated_at exato, sem arredondar)",
    (c, id, p) =>
      c.savedReplies.update(id!, p as { expected_updated_at: string }),
    ["expected_updated_at"],
  );
  operation(
    saved,
    "delete <id>",
    "Exclui resposta com CAS",
    (c, id, p) =>
      c.savedReplies.delete(id!, p as { expected_updated_at: string }),
    ["expected_updated_at"],
  );
  const inbox = program
    .command("inbox-tools")
    .description(
      "Notas, retornos, arquivo e adiamento; scopes inbox:read/write",
    );
  operation(
    inbox,
    "get <id>",
    "Ferramentas da conversa; page/per_page para notas e retornos",
    (c, id, p) => c.inbox.get(id!, p),
  );
  operation(
    inbox,
    "mutate <id>",
    "operation: archive, unarchive, snooze, unsnooze, note_create/update/delete, reminder_create/update; CAS expected_version nas alterações",
    (c, id, p) => c.inbox.mutate(id!, p as InboxMutation),
    ["operation"],
  );
  for (const resource of ["opportunities", "demands"] as const) {
    const group = program
      .command(resource)
      .description(
        `${resource === "opportunities" ? "Oportunidades" : "Demandas"} do CRM; scopes crm:read/write`,
      );
    operation(
      group,
      "list",
      "customer_id obrigatório; q,status,contact_id,owner_user_id,stage_id,page,per_page",
      (c, _id, p) => c[resource].list(p as unknown as CrmQuery),
      ["customer_id"],
    );
    operation(group, "get <id>", "Lê registro e versão", (c, id) =>
      c[resource].get(id!),
    );
    operation(
      group,
      "create",
      "Cria registro completo; campos conforme SDK",
      (c, _id, p) =>
        resource === "opportunities"
          ? c.opportunities.create(p as unknown as CreateOpportunity)
          : c.demands.create(p as unknown as CreateDemand),
      ["customer_id", "contact_id", "title"],
    );
    operation(
      group,
      "update <id>",
      "Altera campos, responsável, estado e próximo passo com CAS",
      (c, id, p) => c[resource].update(id!, p as { expected_version: number }),
      ["expected_version"],
    );
    operation(
      group,
      "activities <id>",
      "Histórico paginado (page)",
      (c, id, p) => c[resource].activities(id!, p),
    );
    operation(
      group,
      "conversations <id>",
      "Conversas vinculadas (page)",
      (c, id, p) => c[resource].conversations(id!, p),
    );
    operation(
      group,
      "link-conversation <id>",
      "Vincula conversa do mesmo contato",
      (c, id, p) =>
        c[resource].linkConversation(id!, String(p.conversation_id)),
      ["conversation_id"],
    );
    operation(
      group,
      "unlink-conversation <id>",
      "Remove vínculo com conversa",
      (c, id, p) =>
        c[resource].unlinkConversation(id!, String(p.conversation_id)),
      ["conversation_id"],
    );
  }
  const radar = program
    .command("radar")
    .description("Pendências do CRM; scopes crm:read/write");
  operation(
    radar,
    "list",
    "customer_id; filtros bucket,entity_type,owner_user_id,reason,page,per_page",
    (c, _id, p) => c.radar.list(p as unknown as RadarQuery),
    ["customer_id"],
  );
  operation(
    radar,
    "stage-rules",
    "Critérios das etapas do Cliente",
    (c, _id, p) => c.radar.stageRules(String(p.customer_id)),
    ["customer_id"],
  );
  operation(
    radar,
    "stage-rule <id>",
    "Configura critério: expected_version=0 cria; cold_hours,critical_hours,require_owner,require_next_step",
    (c, id, p) =>
      c.radar.configureStageRule(id!, p as unknown as StageRuleInput),
    [
      "customer_id",
      "expected_version",
      "cold_hours",
      "critical_hours",
      "require_owner",
      "require_next_step",
    ],
  );
  const journey = program
    .command("journeys")
    .description(
      "Réguas e execuções; scopes journeys:read/write; ambiente live",
    );
  operation(journey, "list", "Filtros customer_id,limit,after", (c, _id, p) =>
    c.journeys.list(p),
  );
  operation(journey, "get <id>", "Definição e passos da régua", (c, id, p) =>
    c.journeys.get(id!, p),
  );
  operation(
    journey,
    "create",
    "Configuração completa da régua; steps é lista de template_id,delay_minutes,variable_map",
    (c, _id, p) => c.journeys.create(p as unknown as JourneyConfig),
    ["customer_id", "name", "steps"],
  );
  operation(
    journey,
    "update <id>",
    "Substitui configuração completa com CAS version",
    (c, id, p) =>
      c.journeys.update(
        id!,
        p as unknown as JourneyConfig & { version: number },
      ),
    ["customer_id", "name", "steps", "version"],
  );
  operation(
    journey,
    "delete <id>",
    "Arquiva régua com CAS version (preserva histórico)",
    (c, id, p) => c.journeys.delete(id!, Number(p.version)),
    ["version"],
  );
  operation(
    journey,
    "control <id>",
    "action: pause/resume/archive e version",
    (c, id, p) =>
      c.journeys.control(
        id!,
        p as { action: "pause" | "resume" | "archive"; version: number },
      ),
    ["action", "version"],
  );
  operation(
    journey,
    "runs <id>",
    "Lista execuções da régua; customer_id,limit,after",
    (c, id, p) => c.journeys.runs(id!, p),
  );
  operation(
    journey,
    "enroll <id>",
    "Programa ocorrência única para contato (pode gerar envio automático)",
    (c, id, p) => c.journeys.enroll(id!, p as unknown as JourneyEnrollment),
    ["contact_id", "occurrence_key"],
  );
  operation(
    journey,
    "get-run <id>",
    "Execução com passos, falhas e comprovantes",
    (c, id) => c.journeys.getRun(id!),
  );
  operation(
    journey,
    "control-run <id>",
    "action: stop ou acknowledge (com note)",
    (c, id, p) =>
      c.journeys.controlRun(id!, p as { action: "acknowledge"; note: string }),
    ["action"],
  );
  const assignments = program
    .command("assignments")
    .description("Atribuições de conversas a membros da Conta");
  operation(
    assignments,
    "list <id>",
    "Atribuições da conversa; page,per_page",
    (c, id, p) => c.conversations.listAssignments(id!, p),
  );
  operation(
    assignments,
    "create <id>",
    "Atribui conversa a user_id; notes opcional",
    (c, id, p) =>
      c.conversations.createAssignment(id!, p as { user_id: string }),
    ["user_id"],
  );
  operation(
    assignments,
    "get <id>",
    "Lê assignment_id da conversa",
    (c, id, p) => c.conversations.getAssignment(id!, String(p.assignment_id)),
    ["assignment_id"],
  );
  operation(
    assignments,
    "update <id>",
    "Atualiza atribuição: assignment_id + campos permitidos pela API",
    (c, id, p) => {
      const { assignment_id, ...patch } = p;
      return c.conversations.updateAssignment(
        id!,
        String(assignment_id),
        patch,
      );
    },
    ["assignment_id"],
  );
}
