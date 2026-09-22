import { z } from "zod";
import type {
  AgentConfig,
  AgentBehavior,
  AgentHours,
  AgentPreviewScenario,
} from "@botozap/sdk";
import type { Register } from "../register.js";
const uuid = z.string().uuid(),
  instant = z.string().datetime({ offset: true }),
  scenario = z.enum(["common", "price", "handoff"]),
  offset = {
    page: z.number().int().positive().optional(),
    per_page: z.number().int().min(1).max(100).optional(),
  },
  row = z.object({ id: uuid }).passthrough(),
  item = z.object({ data: row }),
  page = z.object({
    data: z.array(row),
    meta: z.object({
      page: z.number(),
      per_page: z.number(),
      total_count: z.number(),
      total_pages: z.number(),
    }),
  });
const offering = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(4096).optional(),
    pricing_kind: z.enum(["fixed", "quote"]),
    price_cents: z.number().int().nonnegative().nullable().optional(),
    conditions: z.string().max(4096).optional(),
    contract_url: z
      .string()
      .url()
      .max(500)
      .refine((v) => v.startsWith("http://") || v.startsWith("https://"))
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (o) =>
      o.pricing_kind === "fixed"
        ? o.price_cents != null
        : o.price_cents == null,
    "Preço fixo exige price_cents; orçamento não leva preço.",
  );
const config = {
    name: z.string().min(1).max(80),
    pitch: z.string().max(4096).optional(),
    offerings: z.array(offering).max(50),
  },
  behavior = {
    model_id: z.string().min(1).max(200),
    rules: z.string().max(4096),
    fallback_model_ids: z.array(z.string().min(1).max(200)).max(10),
  },
  hours = {
    time_zone: z.string(),
    policy: z.enum(["hold", "continue"]),
    windows: z
      .array(
        z
          .object({
            days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
            start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          })
          .strict(),
      )
      .min(1)
      .max(14),
  };
export function registerAgentTools(register: Register) {
  register(
    "list_agent_models",
    "Descobre modelos e tarifas gerenciadas; agents:read.",
    {},
    z.object({
      data: z.array(
        z.object({
          model_id: z.string(),
          display_name: z.string(),
          recommended: z.boolean(),
          input_managed_micros: z.string(),
          output_managed_micros: z.string(),
        }),
      ),
    }),
    async (c) => ({ data: await c.agents.models() }),
  );
  register(
    "get_agent_behavior",
    "Lê rascunho e versão publicada antes de editar; agents:read.",
    { id: uuid },
    z.object({
      data: z.object({
        ...behavior,
        previewed_at: instant.nullable(),
        published_version: z.number(),
        published_model_id: z.string(),
        published_rules: z.string(),
        published_fallback_model_ids: z.array(z.string()),
      }),
    }),
    async (c, a) => ({ data: await c.agents.behavior(String(a.id)) }),
  );
  register(
    "list_agents",
    "Lista agentes comerciais por Cliente. Chave live, agents:read.",
    { customer_id: uuid, ...offset },
    page,
    (c, a) => c.agents.list(a as { customer_id: string }),
  );
  register(
    "get_agent",
    "Configuração publicada do agente e timestamp para CAS. agents:read.",
    { id: uuid },
    item,
    async (c, a) => ({ data: await c.agents.get(String(a.id)) }),
  );
  register(
    "create_agent",
    "Cria agente e ofertas completas. Não ativa atendimento. agents:write.",
    { customer_id: uuid, ...config },
    item,
    async (c, a) => ({
      data: await c.agents.create(
        a as unknown as AgentConfig & { customer_id: string },
      ),
    }),
  );
  register(
    "update_agent",
    "Substitui configuração do agente com CAS expected_updated_at exato. agents:write.",
    { id: uuid, ...config, expected_updated_at: instant },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.agents.update(
          String(id),
          p as unknown as AgentConfig & { expected_updated_at: string },
        ),
      };
    },
  );
  register(
    "control_agent",
    "Confere, ativa, arquiva ou restaura agente. Ativar pode gerar respostas automáticas; requer solicitação do usuário. agents:write.",
    {
      id: uuid,
      action: z.enum(["review", "activate", "archive", "restore"]),
      channel_account_id: uuid.optional(),
    },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.agents.control(String(id), p as { action: "activate" }),
      };
    },
  );
  register(
    "list_agent_runs",
    "Histórico paginado de execuções. agents:read.",
    { id: uuid, ...offset },
    page,
    (c, a) => {
      const { id, ...p } = a;
      return c.agents.runs(String(id), p);
    },
  );
  register(
    "preview_agent",
    "Executa prévia que pode consumir créditos. request_key UUID estável evita duplicação de cobrança; agents:write.",
    { id: uuid, scenario, request_key: uuid },
    z.object({
      data: z.object({
        scenario,
        question: z.string(),
        reply: z.string(),
        cost_micros: z.string(),
        remaining_micros: z.string(),
      }),
    }),
    async (c, a) => ({
      data: await c.agents.preview(String(a.id), {
        scenario: a.scenario as AgentPreviewScenario,
        request_key: String(a.request_key),
      }),
    }),
  );
  register(
    "assist_agent_writing",
    "Sugere texto no contexto de uma conversa. Pode consumir créditos; requer solicitação do usuário. Não envia ao WhatsApp. agents:write.",
    {
      id: uuid,
      conversation_id: uuid,
      message: z.string().trim().min(1).max(6000),
      request_key: uuid,
    },
    z.object({
      data: z.object({
        scenario: z.literal("assist"),
        question: z.string(),
        reply: z.string(),
        cost_micros: z.string(),
        remaining_micros: z.string(),
      }),
    }),
    async (c, a) => ({
      data: await c.agents.assist(String(a.id), {
        conversation_id: String(a.conversation_id),
        message: String(a.message),
        request_key: String(a.request_key),
      }),
    }),
  );
  register(
    "list_agent_gaps",
    "Lacunas de conhecimento e avisos pendentes. agents:read.",
    { id: uuid, ...offset },
    page,
    (c, a) => {
      const { id, ...p } = a;
      return c.agents.gaps(String(id), p);
    },
  );
  register(
    "resolve_agent_gap",
    "Corrige base do agente com informação verificada. Não retoma pausa humana. agents:write.",
    { id: uuid, gap_id: uuid, answer: z.string().min(1).max(2000) },
    z.object({ data: z.object({ id: uuid, status: z.literal("resolved") }) }),
    async (c, a) => ({
      data: await c.agents.resolveGap(String(a.id), String(a.gap_id), {
        answer: String(a.answer),
      }),
    }),
  );
  register(
    "control_conversation_agent",
    "Pausa/retoma agente nesta conversa; retomar pode gerar resposta automática. agents:write.",
    { conversation_id: uuid, action: z.enum(["pause", "resume"]) },
    z.object({
      data: z.object({ conversation_id: uuid, paused: z.boolean() }),
    }),
    async (c, a) => ({
      data: await c.agents.controlConversation(
        String(a.conversation_id),
        a.action as "pause" | "resume",
      ),
    }),
  );
  register(
    "save_agent_behavior",
    "Salva rascunho do modelo e regras, sem publicar. agents:write.",
    { id: uuid, ...behavior },
    z.object({ data: z.object(behavior) }),
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.agents.saveBehavior(
          String(id),
          p as unknown as AgentBehavior,
        ),
      };
    },
  );
  register(
    "preview_agent_behavior",
    "Testa rascunho do comportamento antes de publicar; pode consumir créditos. agents:write.",
    { id: uuid, scenario: scenario.optional() },
    z.object({
      data: z.object({
        question: z.string(),
        reply: z.string(),
        model_id: z.string(),
      }),
    }),
    async (c, a) => ({
      data: await c.agents.previewBehavior(String(a.id), {
        scenario: a.scenario as AgentPreviewScenario | undefined,
      }),
    }),
  );
  register(
    "publish_agent_behavior",
    "Publica rascunho conferido por prévia; altera respostas futuras. agents:write.",
    { id: uuid },
    z.object({
      data: z.object({
        version: z.number().int().positive(),
        model_id: z.string(),
      }),
    }),
    async (c, a) => ({ data: await c.agents.publishBehavior(String(a.id)) }),
  );
  register(
    "set_agent_hours",
    "Define horários semanais e política fora do horário; agents:write.",
    { id: uuid, ...hours },
    z.object({ data: z.object(hours) }),
    async (c, a) => {
      const { id, ...p } = a;
      return {
        data: await c.agents.saveHours(String(id), p as unknown as AgentHours),
      };
    },
  );
}
