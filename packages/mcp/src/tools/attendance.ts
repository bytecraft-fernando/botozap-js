import { z } from "zod";
import type {
  CreateOpportunity,
  CreateDemand,
  CrmQuery,
  RadarQuery,
  JourneyConfig,
  JourneyEnrollment,
  InboxMutation,
  SavedReplyInput,
  SavedReplyQuery,
  StageRuleInput,
} from "@botozap/sdk";
import type { Register } from "../register.js";
import { emptyOperationResult } from "../register.js";

const uuid = z.string().uuid(),
  instant = z.string().datetime({ offset: true }),
  version = z.number().int().positive();
const nullableUuid = uuid.nullable().optional(),
  optionalText = (max: number) => z.string().max(max).nullable().optional();
const offset = {
  page: z.number().int().positive().optional(),
  per_page: z.number().int().min(1).max(100).optional(),
};
const row = z.object({ id: z.string() }).passthrough();
const item = z.object({ data: row });
const page = z.object({
  data: z.array(row),
  meta: z
    .object({
      page: z.number(),
      per_page: z.number(),
      total_count: z.number(),
      total_pages: z.number(),
    })
    .passthrough(),
});
const cursor = z.object({
  data: z.array(row),
  paging: z.object({
    cursors: z.object({
      before: z.string().nullable(),
      after: z.string().nullable(),
    }),
    next: z.string().nullable(),
    previous: z.string().nullable(),
  }),
});
const saved = {
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(4096),
  shortcut: z.string().max(40).nullable().optional(),
  customer_id: nullableUuid,
};
const common = {
  title: z.string().min(1).max(200),
  owner_user_id: nullableUuid,
  next_step: optionalText(1000),
  next_step_at: instant.nullable().optional(),
  notes: optionalText(10000),
  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
};
const opportunity = {
  ...common,
  stage_id: nullableUuid,
  status: z.enum(["open", "won", "lost"]).optional(),
  value_cents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  outcome_reason: optionalText(2000),
};
const demand = {
  ...common,
  opportunity_id: nullableUuid,
  status: z
    .enum(["open", "in_progress", "waiting_customer", "resolved", "closed"])
    .optional(),
  due_at: instant.nullable().optional(),
  outcome: z
    .enum([
      "resolved",
      "converted",
      "not_applicable",
      "customer_cancelled",
      "lost",
      "no_response",
    ])
    .nullable()
    .optional(),
};
const note = z.string().trim().min(1).max(10000);
export const inboxMutationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.enum(["archive", "unarchive", "unsnooze"]),
      expected_version: version,
    })
    .strict(),
  z
    .object({
      operation: z.literal("snooze"),
      expected_version: version,
      until: instant,
    })
    .strict(),
  z.object({ operation: z.literal("note_create"), body: note }).strict(),
  z
    .object({
      operation: z.literal("note_update"),
      id: uuid,
      expected_version: version,
      body: note,
    })
    .strict(),
  z
    .object({
      operation: z.literal("note_delete"),
      id: uuid,
      expected_version: version,
    })
    .strict(),
  z
    .object({
      operation: z.literal("reminder_create"),
      body: z.string().min(1).max(1000),
      due_at: instant,
      assigned_user_id: nullableUuid,
    })
    .strict(),
  z
    .object({
      operation: z.literal("reminder_update"),
      id: uuid,
      expected_version: version,
      body: z.string().min(1).max(1000).optional(),
      due_at: instant.optional(),
      assigned_user_id: nullableUuid,
      status: z.enum(["pending", "done", "cancelled"]).optional(),
    })
    .strict(),
]);
const journey = {
  customer_id: uuid,
  name: z.string().min(1).max(160),
  status: z.enum(["active", "paused"]).optional(),
  target_kind: z.enum(["contact", "opportunity", "demand"]).optional(),
  trigger_kind: z
    .enum(["contact_date", "stage_entered", "appointment", "demand_status"])
    .optional(),
  date_field_key: optionalText(200),
  stage_id: nullableUuid,
  demand_status: z
    .enum(["open", "in_progress", "waiting_customer"])
    .nullable()
    .optional(),
  offset_days: z.number().int().min(-3660).max(3660).optional(),
  offset_hours: z.number().int().min(-87840).max(87840).optional(),
  yearly: z.boolean().optional(),
  stop_on_reply: z.boolean().optional(),
  stop_on_exit: z.boolean().optional(),
  send_start_hour: z.number().int().min(0).max(23).optional(),
  send_end_hour: z.number().int().min(1).max(24).optional(),
  steps: z
    .array(
      z
        .object({
          template_id: uuid,
          delay_minutes: z.number().int().min(0).max(525600),
          variable_map: z.record(z.string().max(200)).optional(),
        })
        .strict(),
    )
    .min(1)
    .max(50),
};
const journeyQuery = {
  customer_id: uuid.optional(),
  limit: z.number().int().min(1).max(100).optional(),
  after: z.string().optional(),
};

export function registerAttendanceTools(register: Register): void {
  register(
    "list_saved_replies",
    "Lista respostas compartilhadas. Exige saved_replies:read. Respostas pessoais só existem na sessão do Painel.",
    {
      ...offset,
      query: z.string().max(200).optional(),
      customer_id: z.union([uuid, z.literal("account")]).optional(),
      include_account: z.boolean().optional(),
    },
    page,
    (c, a) => c.savedReplies.list(a as SavedReplyQuery),
  );
  register(
    "get_saved_reply",
    "Lê resposta compartilhada e updated_at exato para CAS. saved_replies:read.",
    { id: uuid },
    item,
    async (c, a) => ({ data: await c.savedReplies.get(String(a.id)) }),
  );
  register(
    "create_saved_reply",
    "Cria resposta compartilhada. Variáveis permitidas: {{nome}}, {{primeiro_nome}}. saved_replies:write.",
    saved,
    item,
    async (c, a) => ({
      data: await c.savedReplies.create(a as unknown as SavedReplyInput),
    }),
  );
  register(
    "update_saved_reply",
    "Edita resposta com CAS; copie expected_updated_at integral da última leitura. saved_replies:write.",
    {
      id: uuid,
      ...z.object(saved).partial().shape,
      expected_updated_at: instant,
    },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.savedReplies.update(
          String(id),
          p as { expected_updated_at: string },
        ),
      };
    },
  );
  register(
    "delete_saved_reply",
    "Exclui resposta compartilhada com CAS. saved_replies:write.",
    { id: uuid, expected_updated_at: instant },
    z.object({ success: z.literal(true) }),
    async (c, a) => {
      await c.savedReplies.delete(String(a.id), {
        expected_updated_at: String(a.expected_updated_at),
      });
      return emptyOperationResult();
    },
  );
  register(
    "get_inbox_tools",
    "Lê notas internas, retornos e estado operacional da conversa. inbox:read. Não contém rascunhos pessoais.",
    { conversation_id: uuid, ...offset },
    z.object({
      data: z.object({
        state: z.object({
          id: uuid,
          operator_version: version,
          archived_at: instant.nullable(),
          snoozed_until: instant.nullable(),
        }),
        notes: z.array(row),
        reminders: z.array(row),
        page: z.number(),
        per_page: z.number(),
        notes_total: z.number(),
        reminders_total: z.number(),
      }),
    }),
    async (c, a) => ({
      data: await c.inbox.get(String(a.conversation_id), {
        page: a.page as number | undefined,
        per_page: a.per_page as number | undefined,
      }),
    }),
  );
  register(
    "mutate_inbox_tools",
    "Arquivo, adiamento, nota interna ou retorno. inbox:write. Notas nunca são enviadas ao contato. expected_version evita sobrescrita; leia antes de editar.",
    { conversation_id: uuid, input: inboxMutationSchema },
    z.object({
      data: z.union([
        row,
        z.object({
          operator_version: version,
          archived_at: instant.nullable(),
          snoozed_until: instant.nullable(),
        }),
      ]),
    }),
    async (c, a) => ({
      data: await c.inbox.mutate(
        String(a.conversation_id),
        a.input as InboxMutation,
      ),
    }),
  );
  for (const [plural, singular, fields] of [
    ["opportunities", "opportunity", opportunity],
    ["demands", "demand", demand],
  ] as const) {
    register(
      `list_${plural}`,
      `Lista ${plural} por Cliente; crm:read.`,
      {
        ...offset,
        customer_id: uuid,
        contact_id: uuid.optional(),
        owner_user_id: z.union([uuid, z.literal("unassigned")]).optional(),
        stage_id: z.union([uuid, z.literal("none")]).optional(),
        status: z.string().optional(),
        q: z.string().max(200).optional(),
      },
      page,
      (c, a) => c[plural].list(a as unknown as CrmQuery),
    );
    register(
      `get_${singular}`,
      `Detalha ${singular}, incluindo versão; crm:read.`,
      { id: uuid },
      item,
      async (c, a) => ({ data: await c[plural].get(String(a.id)) }),
    );
    register(
      `create_${singular}`,
      `Cria ${singular} vinculado ao Cliente e Contato; crm:write.`,
      { ...fields, customer_id: uuid, contact_id: uuid },
      item,
      async (c, a) => ({
        data:
          plural === "opportunities"
            ? await c.opportunities.create(a as unknown as CreateOpportunity)
            : await c.demands.create(a as unknown as CreateDemand),
      }),
    );
    register(
      `update_${singular}`,
      `Atualiza ${singular} com CAS, incluindo responsável, resultado e próximo passo; crm:write.`,
      {
        id: uuid,
        ...z.object(fields).partial().shape,
        expected_version: version,
      },
      item,
      async (c, a) => {
        const { id, ...p } = a;
        return {
          data: await c[plural].update(
            String(id),
            p as { expected_version: number },
          ),
        };
      },
    );
    register(
      `list_${singular}_activities`,
      `Histórico paginado de ${singular}, 20 por página; crm:read.`,
      { id: uuid, page: offset.page },
      page,
      (c, a) =>
        c[plural].activities(String(a.id), {
          page: a.page as number | undefined,
        }),
    );
    register(
      `list_${singular}_conversations`,
      `Conversas vinculadas a ${singular}, 20 por página; crm:read.`,
      { id: uuid, page: offset.page },
      z.object({
        data: z.array(z.object({ conversation_id: uuid, created_at: instant })),
        meta: page.shape.meta,
      }),
      (c, a) =>
        c[plural].conversations(String(a.id), {
          page: a.page as number | undefined,
        }),
    );
    for (const link of [true, false])
      register(
        `${link ? "link" : "unlink"}_${singular}_conversation`,
        `${link ? "Vincula" : "Desvincula"} conversa do mesmo contato; crm:write.`,
        { id: uuid, conversation_id: uuid },
        z.object({
          data: z.object({ conversation_id: uuid, linked: z.boolean() }),
        }),
        async (c, a) => ({
          data: await c[plural][
            link ? "linkConversation" : "unlinkConversation"
          ](String(a.id), String(a.conversation_id)),
        }),
      );
  }
  register(
    "list_radar",
    "Lista pendências e contagens críticas/atenção/programadas; crm:read.",
    {
      ...offset,
      customer_id: uuid,
      bucket: z.enum(["critical", "at_risk", "scheduled"]).optional(),
      entity_type: z.enum(["opportunity", "demand", "return"]).optional(),
      owner_user_id: z.union([uuid, z.literal("unassigned")]).optional(),
      reason: z
        .enum([
          "unassigned",
          "missing_next_step",
          "overdue",
          "stalled_stage",
          "inactive",
          "automation_failed",
          "automation_overdue",
          "automation_paused",
          "automation_stopped",
        ])
        .optional(),
    },
    page.extend({
      meta: page.shape.meta.extend({
        counts: z.object({
          critical: z.number(),
          at_risk: z.number(),
          scheduled: z.number(),
        }),
      }),
    }),
    (c, a) => c.radar.list(a as unknown as RadarQuery),
  );
  register(
    "list_radar_stage_rules",
    "Critérios por etapa do Cliente; crm:read.",
    { customer_id: uuid },
    z.object({
      data: z.array(
        z.object({ stage_id: uuid, version: version }).passthrough(),
      ),
    }),
    async (c, a) => ({ data: await c.radar.stageRules(String(a.customer_id)) }),
  );
  register(
    "configure_radar_stage_rule",
    "Configura critério; expected_version=0 para novo, versão lida para alteração. crm:write.",
    {
      stage_id: uuid,
      customer_id: uuid,
      expected_version: z.number().int().nonnegative(),
      cold_hours: z.number().int().min(1).max(8760),
      critical_hours: z.number().int().min(1).max(26280),
      require_owner: z.boolean(),
      require_next_step: z.boolean(),
    },
    z.object({
      data: z.object({ stage_id: uuid, version: version }).passthrough(),
    }),
    async (c, a) => {
      const { stage_id, ...p } = a;
      return {
        data: await c.radar.configureStageRule(
          String(stage_id),
          p as unknown as StageRuleInput,
        ),
      };
    },
  );
  register(
    "list_journeys",
    "Lista réguas live, paginação cursor; journeys:read.",
    journeyQuery,
    cursor,
    (c, a) => c.journeys.list(a),
  );
  register(
    "get_journey",
    "Lê configuração completa, passos e version; journeys:read.",
    { id: uuid, customer_id: uuid.optional() },
    item,
    async (c, a) => ({
      data: await c.journeys.get(String(a.id), {
        customer_id: a.customer_id as string | undefined,
      }),
    }),
  );
  register(
    "create_journey",
    "Cria régua; status active permite disparos automáticos. Configure somente quando solicitado. journeys:write.",
    journey,
    item,
    async (c, a) => ({
      data: await c.journeys.create(a as unknown as JourneyConfig),
    }),
  );
  register(
    "update_journey",
    "Substitui configuração completa com version atual; journeys:write.",
    { id: uuid, ...journey, version },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.journeys.update(
          String(id),
          p as unknown as JourneyConfig & { version: number },
        ),
      };
    },
  );
  register(
    "archive_journey",
    "Arquiva régua preservando histórico, com CAS; journeys:write.",
    { id: uuid, version },
    item,
    async (c, a) => ({
      data: await c.journeys.delete(String(a.id), Number(a.version)),
    }),
  );
  register(
    "control_journey",
    "Pausa, retoma ou arquiva régua com CAS; resume pode gerar envios. journeys:write.",
    { id: uuid, action: z.enum(["pause", "resume", "archive"]), version },
    item,
    async (c, a) => ({
      data: await c.journeys.control(String(a.id), {
        action: a.action as "pause" | "resume" | "archive",
        version: Number(a.version),
      }),
    }),
  );
  register(
    "list_journey_runs",
    "Execuções da régua, cursor; journeys:read.",
    { id: uuid, ...journeyQuery },
    cursor,
    (c, a) => {
      const { id, ...p } = a;
      return c.journeys.runs(String(id), p);
    },
  );
  register(
    "enroll_journey",
    "Programa ocorrência única; pode disparar mensagens ao contato. Exige solicitação do usuário. journeys:write.",
    {
      id: uuid,
      contact_id: uuid,
      occurrence_key: z.string().min(1).max(200),
      due_at: instant.optional(),
      opportunity_id: nullableUuid,
      demand_id: nullableUuid,
      appointment_id: nullableUuid,
    },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.journeys.enroll(
          String(id),
          p as unknown as JourneyEnrollment,
        ),
      };
    },
  );
  register(
    "get_journey_run",
    "Detalha execução, etapas, falhas e recibos; journeys:read.",
    { id: uuid },
    item,
    async (c, a) => ({ data: await c.journeys.getRun(String(a.id)) }),
  );
  register(
    "control_journey_run",
    "Interrompe execução ou reconhece falha com nota. Não repete envios ambíguos. journeys:write.",
    {
      id: uuid,
      input: z.discriminatedUnion("action", [
        z.object({ action: z.literal("stop") }).strict(),
        z
          .object({
            action: z.literal("acknowledge"),
            note: z.string().min(1).max(2000),
          })
          .strict(),
      ]),
    },
    item,
    async (c, a) => ({
      data: await c.journeys.controlRun(
        String(a.id),
        a.input as { action: "acknowledge"; note: string },
      ),
    }),
  );
  register(
    "list_conversation_assignments",
    "Lista atribuições da conversa; conversations:read.",
    { conversation_id: uuid, ...offset },
    page,
    (c, a) =>
      c.conversations.listAssignments(String(a.conversation_id), {
        page: a.page as number | undefined,
        per_page: a.per_page as number | undefined,
      }),
  );
  register(
    "create_conversation_assignment",
    "Atribui conversa a membro existente da Conta. Obtenha user_id em list_users; conversations:write.",
    {
      conversation_id: uuid,
      user_id: uuid,
      notes: z.string().max(16000).optional(),
    },
    item,
    async (c, a) => ({
      data: await c.conversations.createAssignment(String(a.conversation_id), {
        user_id: String(a.user_id),
        notes: a.notes as string | undefined,
      }),
    }),
  );
  register(
    "get_conversation_assignment",
    "Lê uma atribuição da conversa; conversations:read.",
    { conversation_id: uuid, assignment_id: uuid },
    item,
    async (c, a) => ({
      data: await c.conversations.getAssignment(
        String(a.conversation_id),
        String(a.assignment_id),
      ),
    }),
  );
  register(
    "update_conversation_assignment",
    "Altera membro, observação ou active=false para desatribuir; conversations:write.",
    {
      conversation_id: uuid,
      assignment_id: uuid,
      user_id: uuid.optional(),
      notes: optionalText(16000),
      active: z.boolean().optional(),
    },
    item,
    async (c, a) => {
      const { conversation_id, assignment_id, ...p } = a;
      return {
        data: await c.conversations.updateAssignment(
          String(conversation_id),
          String(assignment_id),
          p,
        ),
      };
    },
  );
}
