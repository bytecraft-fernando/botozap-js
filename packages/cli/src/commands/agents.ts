import type { Command } from "commander";
import type {
  AgentConfig,
  AgentAssistInput,
  AgentBehavior,
  AgentHours,
  AgentPreviewScenario,
} from "@botozap/sdk";
import { operation } from "./attendance.js";
export function registerAgents(program: Command) {
  const group = program
    .command("agents")
    .description(
      "Agentes comerciais; agents:read/write; ativação e prévia podem consumir créditos/enviar mensagens",
    );
  operation(group, "models", "Modelos e tarifas disponíveis", (c) =>
    c.agents.models(),
  );
  operation(
    group,
    "behavior <id>",
    "Rascunho, prévia e comportamento publicado",
    (c, id) => c.agents.behavior(id!),
  );
  operation(
    group,
    "list",
    "Lista por customer_id (page,per_page)",
    (c, _id, p) => c.agents.list(p as { customer_id: string }),
    ["customer_id"],
  );
  operation(group, "get <id>", "Lê agente e configuração publicada", (c, id) =>
    c.agents.get(id!),
  );
  operation(
    group,
    "create",
    "Cria configuração completa com offerings em snake_case",
    (c, _id, p) =>
      c.agents.create(p as unknown as AgentConfig & { customer_id: string }),
    ["customer_id", "name", "offerings"],
  );
  operation(
    group,
    "update <id>",
    "Substitui configuração com expected_updated_at preciso",
    (c, id, p) =>
      c.agents.update(
        id!,
        p as unknown as AgentConfig & { expected_updated_at: string },
      ),
    ["name", "offerings", "expected_updated_at"],
  );
  operation(
    group,
    "control <id>",
    "action: review/activate/archive/restore; channel_account_id quando aplicável",
    (c, id, p) =>
      c.agents.control(
        id!,
        p as {
          action: "review" | "activate" | "archive" | "restore";
          channel_account_id?: string;
        },
      ),
    ["action"],
  );
  operation(
    group,
    "runs <id>",
    "Histórico de execuções (page,per_page)",
    (c, id, p) => c.agents.runs(id!, p),
  );
  operation(
    group,
    "preview <id>",
    "Executa prévia com custo: scenario common/price/handoff, request_key UUID estável",
    (c, id, p) =>
      c.agents.preview(
        id!,
        p as { scenario: AgentPreviewScenario; request_key: string },
      ),
    ["scenario", "request_key"],
  );
  operation(
    group,
    "assist <id>",
    "Sugere texto com contexto da conversa; pode consumir crédito, sem enviar mensagem",
    (c, id, p) => c.agents.assist(id!, p as unknown as AgentAssistInput),
    ["conversation_id", "message", "request_key"],
  );
  operation(
    group,
    "gaps <id>",
    "Lacunas de conhecimento (page,per_page)",
    (c, id, p) => c.agents.gaps(id!, p),
  );
  operation(
    group,
    "resolve-gap <id>",
    "Corrige lacuna: gap_id e answer; não retoma pausa humana",
    (c, id, p) =>
      c.agents.resolveGap(id!, String(p.gap_id), { answer: String(p.answer) }),
    ["gap_id", "answer"],
  );
  operation(
    group,
    "control-conversation <id>",
    "ID da conversa; action pause/resume do agente",
    (c, id, p) =>
      c.agents.controlConversation(id!, p.action as "pause" | "resume"),
    ["action"],
  );
  operation(
    group,
    "save-behavior <id>",
    "Salva rascunho de model_id,rules,fallback_model_ids; requer prévia antes de publicar",
    (c, id, p) => c.agents.saveBehavior(id!, p as unknown as AgentBehavior),
    ["model_id", "rules", "fallback_model_ids"],
  );
  operation(
    group,
    "preview-behavior <id>",
    "Testa comportamento (scenario opcional); pode consumir créditos",
    (c, id, p) => c.agents.previewBehavior(id!, p),
  );
  operation(
    group,
    "publish-behavior <id>",
    "Publica comportamento previamente conferido",
    (c, id) => c.agents.publishBehavior(id!),
  );
  operation(
    group,
    "hours <id>",
    "time_zone,policy hold/continue,windows[{days,start,end}]",
    (c, id, p) => c.agents.saveHours(id!, p as unknown as AgentHours),
    ["time_zone", "policy", "windows"],
  );
}
