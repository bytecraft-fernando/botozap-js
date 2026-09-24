import { z, type ZodTypeAny } from "zod";
import { AI_OPERATIONS } from "@botozap/sdk";
import type { Register } from "../register.js";
import { emptyOperationResult } from "../register.js";
const uuid = z.string().uuid(),
  revision = z.string().regex(/^\d+$/),
  text = z.string(),
  provider = z.enum([
    "anthropic",
    "openai",
    "google",
    "openrouter",
    "deepseek",
    "xai",
  ]),
  purpose = z.enum([
    "default",
    "agent_turn",
    "agent_operator",
    "router",
    "followup",
    "proposal",
    "transcription",
    "embedding",
  ]),
  binding = z
    .object({ provider, model: text.min(1).max(200), credential_id: uuid })
    .strict(),
  window = z
    .object({
      start: text.regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      end: text.regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    })
    .strict();
const tool = z.enum([
  "contacts.read",
  "contacts.update",
  "conversations.read",
  "conversations.note",
  "crm.opportunities.read",
  "crm.opportunities.write",
  "crm.demands.read",
  "crm.demands.write",
  "crm.stages.read",
  "crm.stages.write",
  "agenda.availability",
  "agenda.propose",
  "agenda.appointments.read",
  "agenda.appointments.reschedule",
  "agenda.appointments.cancel",
  "knowledge.search",
  "memory.read",
  "memory.propose",
  "skills.read",
  "followups.enroll",
  "followups.pause",
  "followups.cancel",
  "cases.open",
  "cases.update",
  "handoff",
  "alerts.create",
]);
const agentConfig = z
  .object({
    system_prompt: text.max(20000).optional(),
    provider: provider.optional(),
    model: text.max(200).optional(),
    credential_id: uuid.nullable().optional(),
    channel_account_id: uuid.nullable().optional(),
    tool_ids: z.array(tool).max(26).optional(),
    operator: z
      .object({
        enabled: z.boolean().optional(),
        provider: provider.nullable().optional(),
        model: text.nullable().optional(),
        credential_id: uuid.nullable().optional(),
        tool_ids: z.array(tool).max(26).optional(),
      })
      .strict()
      .optional(),
    trigger: z
      .object({
        keywords: z.array(text).max(40).optional(),
        match: z.enum(["any", "all"]).optional(),
        ignore_groups: z.literal(true).optional(),
        ignore_self: z.literal(true).optional(),
      })
      .strict()
      .optional(),
    time_zone: text.optional(),
    business_hours: window.nullable().optional(),
    outside_hours: z.enum(["respond", "wait", "handoff"]).optional(),
    max_steps: z.number().int().min(1).max(25).optional(),
    token_budget: z.number().int().min(1000).max(500000).optional(),
    estimated_cost_limit_usd: z
      .number()
      .positive()
      .max(100)
      .nullable()
      .optional(),
    history_message_window: z.number().int().min(0).max(200).optional(),
    history_token_window: z.number().int().min(0).max(50000).optional(),
    handoff_keywords: z.array(text).max(30).optional(),
    handoff_enabled: z.boolean().optional(),
    cases_enabled: z.boolean().optional(),
    split_messages: z.boolean().optional(),
    split_max_chars: z.number().int().min(80).max(4000).optional(),
    crm_scopes: z
      .array(z.enum(["contacts", "opportunities", "demands"]))
      .max(3)
      .optional(),
    allowed_stage_ids: z.array(uuid).max(100).optional(),
    knowledge_source_ids: z.array(uuid).max(100).optional(),
    skill_ids: z.array(uuid).max(100).optional(),
    memory_enabled: z.boolean().optional(),
    media: z
      .object({
        images_enabled: z.boolean().optional(),
        documents_enabled: z.boolean().optional(),
        video_frames_enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    followup: z
      .object({
        enabled: z.boolean().optional(),
        flow_ids: z.array(uuid).max(100).optional(),
        send_window: window.nullable().optional(),
      })
      .strict()
      .optional(),
    safety: z
      .object({
        disclose_ai: z.boolean().optional(),
        prohibited_claims: z.array(text).max(50).optional(),
        escalation_instructions: text.max(4000).optional(),
      })
      .strict()
      .optional(),
    style: z
      .object({
        tone: z.enum(["professional", "friendly", "direct"]).optional(),
        verbosity: z.enum(["concise", "balanced", "detailed"]).optional(),
        use_emojis: z.boolean().optional(),
        instructions: text.max(4000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const routerConfig = z
  .object({
    name: text.min(1).max(80),
    channel_account_id: uuid,
    classifier: binding,
    sticky: z.boolean().optional(),
    min_confidence: z.number().min(0).max(1).optional(),
    fallback_agent_id: uuid.nullable().optional(),
    members: z
      .array(
        z
          .object({
            agent_id: uuid,
            intent_name: text.min(1).max(80),
            intent_description: text.min(1).max(2000),
            examples: z.array(text).max(20).optional(),
            position: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
const schemas: Record<string, ZodTypeAny> = {
  uuid,
  revision,
  provider,
  purpose,
  configurablePurpose: z.enum([
    "default",
    "followup",
    "proposal",
    "transcription",
    "embedding",
  ]),
  agentConfig,
  revisionZero: z.string().regex(/^(0|[1-9]\d{0,18})$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  caseBody: z.string().trim().min(1).max(4000),
  caseQuestion: z.string().trim().min(3).max(1000),
  catalogProducts: z
    .array(
      z
        .object({
          id: z.string().min(1).max(100),
          name: z.union([
            z.string().min(1).max(300),
            z.object({ pt: z.string().min(1).max(300) }).strict(),
          ]),
          description: z.string().max(10000).optional(),
          price: z
            .string()
            .regex(/^\d{1,12}(?:[.,]\d{1,2})?$/)
            .optional(),
          sku: z.string().max(150).optional(),
          permalink: z.string().url().max(2000).optional(),
          variants: z
            .array(
              z
                .object({
                  price: z.string().optional(),
                  sku: z.string().optional(),
                })
                .strict(),
            )
            .max(100)
            .optional(),
          categories: z
            .array(
              z
                .object({
                  name: z.union([
                    z.string(),
                    z.object({ pt: z.string() }).strict(),
                  ]),
                })
                .strict(),
            )
            .max(30)
            .optional(),
        })
        .strict(),
    )
    .min(1)
    .max(1000),
  routerConfig,
  string: text,
  number: z.number().finite(),
  boolean: z.boolean(),
  true: z.literal(true),
  nullableUuid: uuid.nullable(),
  nullableString: text.nullable(),
  nullableNumber: z.number().finite().nullable(),
  audioPricing: z
    .discriminatedUnion("unit", [
      z
        .object({
          unit: z.literal("tokens"),
          input_audio_usd_per_million: z.number().finite().min(0).max(100000),
          input_text_usd_per_million: z.number().finite().min(0).max(100000),
          output_text_usd_per_million: z.number().finite().min(0).max(100000),
          max_input_tokens: z.number().int().min(1).max(100000000),
          max_output_tokens: z.number().int().min(1).max(100000000),
        })
        .strict(),
      z
        .object({
          unit: z.literal("duration"),
          usd_per_minute: z.number().finite().min(0).max(100000),
        })
        .strict(),
    ])
    .nullable(),
  datetime: text.datetime({ offset: true }),
  secret: text.min(8).max(4096),
  evidence: text.trim().min(10).max(2000),
  uuids: z.array(uuid).min(1).max(100),
  binding: binding.nullable(),
  messages: z
    .array(
      z
        .object({
          role: z.enum(["user", "assistant"]),
          content: text.min(1).max(20000),
        })
        .strict(),
    )
    .min(1)
    .max(200),
  matcher: z
    .object({
      any_keywords: z.array(text.min(1).max(120)).min(1).max(50),
      probe_keywords: z.array(text.min(1).max(120)).max(50).optional(),
    })
    .strict(),
  noticeMap: z.record(
    text.regex(/^(body|header|button):\d+$/),
    z.enum([
      "case_title",
      "case_summary",
      "case_url",
      "contact_name",
      "agent_name",
    ]),
  ),
  graph: z
    .object({
      nodes: z.array(
        z
          .object({
            id: text,
            type: text,
            label: text,
            position: z.object({ x: z.number(), y: z.number() }),
            config: z.record(z.unknown()),
          })
          .strict(),
      ),
      edges: z.array(
        z
          .object({
            id: text,
            source: text,
            target: text,
            priority: z.number(),
            condition: z.record(z.unknown()),
          })
          .passthrough(),
      ),
    })
    .strict(),
  flowSettings: z
    .object({
      trigger: z
        .object({
          kind: z.enum([
            "manual",
            "webhook",
            "stage_change",
            "silence",
            "case_opened",
            "appointment_no_show",
          ]),
          params: z.record(z.unknown()).optional(),
          cancel_on_reply: z.boolean().optional(),
        })
        .strict(),
      handoff_policy: z.enum(["pause", "cancel", "allow"]),
      send_start_hour: z.number(),
      send_end_hour: z.number(),
      send_days: z.array(z.number()),
      timezone: text,
      purpose: z.enum(["utility", "marketing"]),
      environment: z.enum(["live", "sandbox"]),
    })
    .strict(),
};
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export function registerAiTools(register: Register) {
  register(
    "control_conversation_agent",
    "Pausa/retoma agente na conversa. agents:write; retomar pode gerar resposta automática e exige intenção do usuário.",
    { conversation_id: uuid, action: z.enum(["pause", "resume"]) },
    z.object({
      data: z.object({ conversation_id: uuid, paused: z.boolean() }),
    }),
    async (client, args) => ({
      data: await client.conversations.controlAgent(
        String(args.conversation_id),
        args.action as "pause" | "resume",
      ),
    }),
  );
  for (const op of AI_OPERATIONS) {
    const input: Record<string, ZodTypeAny> = {};
    for (const [name, f] of Object.entries(op.fields)) {
      if (name === "file") continue;
      let schema =
        schemas[f.type] ??
        (f.type.includes("|")
          ? z.enum(f.type.split("|") as [string, ...string[]])
          : undefined);
      if (!schema) throw new Error(`Tipo IA não registrado: ${f.type}`);
      if (name === "page") schema = z.number().int().positive();
      if (name === "per_page") schema = z.number().int().min(1).max(100);
      input[name] = f.optional ? schema.optional() : schema;
    }
    if (op.shape === "multipart")
      input.file_base64 = z
        .string()
        .min(1)
        .max(op.group === "skills" ? 7 * 1024 * 1024 : 14 * 1024 * 1024)
        .describe(
          "Conteúdo base64 do arquivo autorizado; nunca um caminho do servidor MCP.",
        );
    const scope =
      op.method === "GET" || (op.group === "knowledge" && op.name === "search")
        ? "agents:read"
        : "agents:write";
    const output =
      op.shape === "offset"
        ? z.object({
            data: z.array(z.unknown()),
            meta: z.object({
              page: z.number(),
              per_page: z.number(),
              total_count: z.number(),
              total_pages: z.number(),
            }),
          })
        : op.shape === "empty"
          ? z.object({ success: z.literal(true) })
          : z.object({ data: z.unknown() });
    register(
      `ai_${snake(op.group)}_${snake(op.name)}`,
      `${op.method} ${op.path}. ${scope}; chave live. ${op.description || "Operação sobre o Cliente informado."} Use customer_id do cliente autorizado; não confunda com account_id.`,
      input,
      output,
      async (client, args) => {
        const raw = { ...args };
        if (op.shape === "multipart") {
          const base64 = String(raw.file_base64);
          if (
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              base64,
            )
          )
            throw new Error("Base64 inválido.");
          const bytes = Buffer.from(base64, "base64");
          const limit =
            op.group === "skills" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
          if (!bytes.length || bytes.length > limit)
            throw new Error("Arquivo vazio ou excede o limite.");
          raw.file = new Blob([bytes], {
            type:
              op.group === "skills"
                ? "application/zip"
                : /\.pdf$/i.test(String(raw.file_name))
                  ? "application/pdf"
                  : "application/octet-stream",
          });
          delete raw.file_base64;
        }
        const value = await client.ai.invoke(op.group, op.name, raw);
        return op.shape === "empty"
          ? emptyOperationResult()
          : op.shape === "offset"
            ? value
            : { data: value };
      },
    );
  }
}
