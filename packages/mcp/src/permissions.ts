import { AI_OPERATIONS } from "@botozap/sdk";
import { TOOL_ROUTES } from "./tool-routes.js";
import { routeAllowed } from "./auth-context.js";
import type { ApiIdentity } from "./server.js";
import { getAiToolEffects } from "./ai-tool-effects.js";

/**
 * The four MCP behavior hints, always explicit booleans (never omitted/null).
 * Reviewed against the real handler and API endpoint, not the tool name:
 * - readOnlyHint: strictly reads/lists/searches; no state change anywhere.
 * - destructiveHint: can cause an irreversible outcome (delete, overwrite,
 *   message sent to a person, revoked access), even only in some modes or
 *   indirectly (e.g. activating automation that messages contacts).
 * - idempotentHint: repeating the same call has no additional effect.
 * - openWorldHint: reaches parties outside the BotoZap account (Meta review,
 *   WhatsApp/Instagram contacts, Google Calendar, arbitrary URLs).
 */
export type ToolAnnotationHints = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

export type ToolPolicy = ToolAnnotationHints & {
  requiredScopes: readonly string[];
  requiredRoutes?: readonly string[];
  sandbox: boolean;
};

const HINT_KEYS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const;

/** Fails fast on a missing/non-boolean hint or an incoherent combination. */
export function assertToolHints(name: string, hints: ToolAnnotationHints): void {
  for (const key of HINT_KEYS) {
    if (typeof hints[key] !== "boolean") throw new Error(`Ferramenta MCP ${name} sem ${key} booleano.`);
  }
  if (hints.readOnlyHint && hints.destructiveHint) throw new Error(`Ferramenta MCP ${name}: readOnlyHint e destructiveHint juntos.`);
  if (hints.readOnlyHint && !hints.idempotentHint) throw new Error(`Ferramenta MCP ${name}: leitura deve ser idempotente.`);
}

/** Annotations published to MCP clients: exactly the four reviewed hints. */
export function toolAnnotations(hints: ToolAnnotationHints): ToolAnnotationHints {
  return {
    readOnlyHint: hints.readOnlyHint,
    destructiveHint: hints.destructiveHint,
    idempotentHint: hints.idempotentHint,
    openWorldHint: hints.openWorldHint,
  };
}

/** get_profile is registered directly by the server and only reads `/me`. */
export const GET_PROFILE_ANNOTATIONS: ToolAnnotationHints = {
  readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
};

const policies: Record<string, ToolPolicy> = {};
function registerPolicy(name: string, policy: ToolPolicy): void {
  if (policies[name]) throw new Error(`Política MCP duplicada: ${name}`);
  assertToolHints(name, policy);
  policies[name] = { ...policy, requiredRoutes: policy.requiredRoutes ?? TOOL_ROUTES[name] ?? [] };
}
function read(names: readonly string[], scope: string, sandbox: boolean): void {
  for (const name of names) registerPolicy(name, {
    requiredScopes: [scope], sandbox, readOnlyHint: true,
    destructiveHint: false, idempotentHint: true, openWorldHint: false,
  });
}
function write(
  names: readonly string[], scope: string | readonly string[], sandbox: boolean,
  hints: { destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean },
): void {
  for (const name of names) registerPolicy(name, {
    requiredScopes: typeof scope === "string" ? [scope] : scope,
    sandbox, readOnlyHint: false, ...hints,
  });
}

// Scope + sandbox flag follow the concrete withV1 endpoint declarations.
write(["send_message", "send_media_message"], "messages:send", true,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
// prepare_send_intent only generates a local UUID; it never calls the API.
read(["prepare_send_intent"], "messages:send", true);
read(["list_messages", "get_message"], "messages:read", true);
read(["list_conversations", "get_conversation"], "conversations:read", true);
write(["reply_to_conversation"], ["conversations:read", "messages:send"], true,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
registerPolicy("stage_review_template", { requiredScopes: ["conversations:read", "numbers:read"], sandbox: false, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
read(["review_template_variables"], "templates:read", false);
registerPolicy("open_agent_cases", { requiredScopes: ["agents:read", "conversations:read", "customers:read"], sandbox: false, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
registerPolicy("stage_appointment_booking", { requiredScopes: ["conversations:read", "numbers:read", "appointments:read"], sandbox: false, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
// SDK reply() first GETs the conversation, so this tool needs both route scopes.
write(["update_conversation"], "conversations:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
registerPolicy("stage_review_reply", { requiredScopes: ["conversations:read", "numbers:read"], sandbox: false, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
// Mensagem real a uma pessoa (botões no WhatsApp, respostas rápidas no Instagram); sem idempotência.
write(["request_consent"], "messages:send", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
// Exclusão sem volta de mensagens, notas e mídia; o contato fica. Só Administrador.
write(["delete_conversation"], "conversations:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
// "Digitando…" e leitura: sinal visível ao contato pela Meta, sem conteúdo novo; repetir não duplica.
write(["conversation_typing"], "messages:send", false,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
write(["mark_conversation_read"], "conversations:write", true,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
read(["list_contacts"], "contacts:read", true);
read(["get_contact"], "contacts:read", false);
read(["list_contact_consents"], "contacts:read", false);
// Registrar a recusa não se desfaz pela API: só o próprio contato volta a aceitar.
write(["record_contact_consent"], "contacts:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: false });
write(["create_contact"], "contacts:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_contact"], "contacts:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["delete_contact"], "contacts:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
read(["open_review_panel", "list_customers", "get_customer", "list_setup_links"], "customers:read", false);
write(["create_customer", "create_setup_link"], "customers:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_customer", "update_setup_link"], "customers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["delete_customer"], "customers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
read(["get_channel_account"], "numbers:read", false);
read(["get_instagram_comment_ai", "list_instagram_comment_ai_runs"], "agents:read", false);
write(["update_instagram_comment_ai"], "agents:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
read(["get_instagram_connection"], "numbers:read", false);
write(["resubscribe_instagram_connection"], "numbers:write", false,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
write(["disconnect_instagram_connection"], "numbers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
read(["get_message_rule_qr"], "message-rules:read", true);
read(["list_channel_accounts"], "numbers:read", true);
read(["list_comment_rules", "get_comment_rule", "get_comment_rule_metrics"], "comment-rules:read", true);
// Uma regra ativa dispara directs automáticos para quem comenta: criar uma
// regra (ou régua) ativa é destrutivo condicional, pois envia mensagens.
write(["create_comment_rule"], "comment-rules:write", true,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
write(["update_comment_rule"], "comment-rules:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
write(["delete_comment_rule"], "comment-rules:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
read(["list_message_rules", "get_message_rule"], "message-rules:read", true);
write(["create_message_rule"], "message-rules:write", true,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
write(["update_message_rule"], "message-rules:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
write(["delete_message_rule"], "message-rules:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
read(["get_instagram_messenger_profile"], "messenger-profile:read", false);
write(["update_instagram_messenger_profile", "delete_instagram_messenger_profile", "sync_instagram_messenger_profile"], "messenger-profile:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
read(["list_phone_numbers"], "numbers:read", true);
read(["get_phone_number"], "numbers:read", false);
// Health probes Graph and persists token_status/token_checked_at.
write(["phone_number_health"], "numbers:read", false,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
write(["update_phone_number"], "numbers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
// Configurações do número no WhatsApp: tudo direto na Meta (fora da conta) e sem sandbox.
read(["get_phone_number_profile", "get_conversational_automation", "list_qr_codes", "get_qr_code", "list_blocked_users"], "numbers:read", false);
// Sobrescrevem o que todos os contatos veem (perfil público, perguntas e comandos, mensagem do QR).
write(["update_phone_number_profile", "update_conversational_automation", "clear_conversational_automation", "update_qr_code"], "numbers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
// Cada chamada cria um QR novo na Meta.
write(["create_qr_code"], "numbers:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: true });
// Apagar o QR é sem volta (o impresso dá "expirado"); bloquear/desbloquear só se refaz com nova mensagem do contato.
write(["delete_qr_code", "block_contact", "unblock_contact"], "numbers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
// Reinscreve o app na WABA (Meta): repetir não muda nada.
write(["resubscribe_phone_number_webhooks"], "numbers:write", false,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
// Conversas antigas do app WhatsApp Business (coexistência): estado no BotoZap.
read(["get_phone_number_history_import"], "numbers:read", false);
// Escolha única por conexão (0 não traz nada e não volta atrás); repetir a mesma escolha não muda nada; dispara o pedido à Meta.
write(["set_phone_number_history_import"], "numbers:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
read(["list_templates", "get_template"], "templates:read", true);
// Só anota no BotoZap quais botões são de saída; não toca na Meta.
write(["update_template"], "templates:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
// Traz o estado da Meta e tira daqui o que foi excluído lá; repetir não muda nada.
write(["sync_templates"], "templates:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
// Nunca sobrescreve (nome+idioma repetido = 409 antes da Meta), por isso é
// aditivo e idempotente; submete à análise da Meta (fora da conta).
write(["create_template"], "templates:write", true,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
read(["list_webhooks", "get_webhook", "list_webhook_deliveries"], "webhooks:read", false);
write(["create_webhook"], "webhooks:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: true });
write(["update_webhook"], "webhooks:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
write(["delete_webhook"], "webhooks:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["test_webhook"], "webhooks:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
// Reenvio de entrega esgotada: o evento sai de novo ao endpoint externo do cliente,
// com a mesma X-Idempotency-Key; repetir com a entrega na fila dá 409, sem duplicar.
write(["replay_webhook_delivery"], "webhooks:write", false,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
read(["list_api_logs"], "logs:read", false);
read(["list_users"], "team:read", false);
read(["get_meta_costs"], "customers:read", false);
// Plano e slots: só chave de API (para OAuth estas rotas são exclusivas do painel).
read(["get_billing"], "billing:read", false);
// Comprar gera cobrança (R$ 47/mês), mas é reversível: o slot vazio se cancela.
write(["create_business_slot"], "billing:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
// Cancela a assinatura do slot no Asaas, sem reembolso; repetir não muda nada.
write(["cancel_business_slot"], "billing:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
// Exportação e registro de atividades: só chave de API (para OAuth são do painel).
read(["list_exports", "get_export"], "exports:read", false);
// Cria um pedido (fila); repetir enquanto a fila não termina devolve o mesmo.
write(["create_export"], "exports:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
read(["list_team_events"], "team:read", false);
write(["ingest_media"], "media:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: true });
read(["list_contact_stages", "list_contact_fields"], "contacts:read", false);
write(["create_contact_stage", "create_contact_field"], "contacts:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_contact_stage", "reorder_contact_stages", "update_contact_field"], "contacts:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["delete_contact_stage", "delete_contact_field"], "contacts:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });

read(["list_appointments", "get_appointment", "list_appointment_history", "get_appointment_availability"], "appointments:read", false);
// Pode iniciar régua de agendamento que envia WhatsApp ao contato e
// sincroniza Google Calendar/Meet; idempotency_key é opcional.
write(["create_appointment"], "appointments:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
write(["update_appointment"], "appointments:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
write(["delete_appointment"], "appointments:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
read(["list_appointment_services", "list_appointment_schedules", "list_appointment_exceptions"], "appointments:read", false);
write(["create_appointment_service", "create_appointment_schedule", "create_appointment_exception"], "appointments:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_appointment_service", "update_appointment_schedule", "update_appointment_exception"], "appointments:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["delete_appointment_exception"], "appointments:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
read(["list_calendar_connections", "list_connection_calendars", "list_calendar_jobs"], "calendar:read", false);
write(["disconnect_calendar"], "calendar:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
write(["refresh_connection_calendars"], "calendar:write", false,
  { destructiveHint: false, idempotentHint: true, openWorldHint: true });
write(["select_calendar"], "calendar:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["retry_calendar_job", "resolve_calendar_conflict"], "calendar:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });

read(["list_saved_replies", "get_saved_reply"], "saved_replies:read", false);
write(["create_saved_reply"], "saved_replies:write", false,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_saved_reply"], "saved_replies:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["delete_saved_reply"], "saved_replies:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
read(["get_inbox_tools"], "inbox:read", true);
write(["mutate_inbox_tools"], "inbox:write", true,
  { destructiveHint: true, idempotentHint: false, openWorldHint: false });
read(["list_opportunities", "get_opportunity", "list_opportunity_activities", "list_opportunity_conversations", "list_demands", "get_demand", "list_demand_activities", "list_demand_conversations", "list_radar", "list_radar_stage_rules"], "crm:read", true);
write(["create_opportunity", "create_demand"], "crm:write", true,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_opportunity", "update_demand", "unlink_opportunity_conversation", "unlink_demand_conversation", "configure_radar_stage_rule"], "crm:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["link_opportunity_conversation", "link_demand_conversation"], "crm:write", true,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
read(["list_journeys", "get_journey", "list_journey_runs", "get_journey_run"], "journeys:read", false);
write(["create_journey"], "journeys:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
write(["update_journey"], "journeys:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
write(["archive_journey", "control_journey", "control_journey_run"], "journeys:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
read(["list_journey_models"], "journeys:read", false);
// Submete template à Meta e cria Régua que pode já nascer ativa (envios automáticos); repetir não cria outra.
write(["enable_journey_model"], "journeys:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });
write(["enroll_journey"], "journeys:write", false,
  { destructiveHint: true, idempotentHint: false, openWorldHint: true });
read(["list_conversation_assignments", "get_conversation_assignment"], "conversations:read", true);
write(["create_conversation_assignment"], "conversations:write", true,
  { destructiveHint: false, idempotentHint: false, openWorldHint: false });
write(["update_conversation_assignment"], "conversations:write", true,
  { destructiveHint: true, idempotentHint: true, openWorldHint: false });
write(["control_conversation_agent"], "agents:write", false,
  { destructiveHint: true, idempotentHint: true, openWorldHint: true });

// AI endpoint effects are maintained as an explicit catalog. A new operation
// without an entry fails startup rather than inheriting defaults.
for (const op of AI_OPERATIONS) {
  const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  const name = `ai_${snake(op.group)}_${snake(op.name)}`;
  const scope = op.scope ?? (op.method === "GET" ? "agents:read" : "agents:write");
  const effect = getAiToolEffects(`${op.group}.${op.name}`);
  registerPolicy(name, {
    requiredScopes: [scope], requiredRoutes: [`${op.method} /v1${op.path}`], sandbox: false,
    ...toolAnnotations(effect),
  });
}

export function getToolPolicy(name: string): ToolPolicy {
  const policy = policies[name];
  if (!policy) throw new Error(`Ferramenta MCP sem política de permissões: ${name}`);
  return policy;
}

export function isToolAllowed(
  policy: Pick<ToolPolicy, "requiredScopes" | "sandbox" | "requiredRoutes">,
  identity: Pick<ApiIdentity, "scopes" | "environment" | "auth_type" | "allowed_routes">,
): boolean {
  return policy.requiredScopes.every((scope) => identity.scopes.includes(scope)) &&
    (identity.environment !== "sandbox" || policy.sandbox) &&
    (identity.auth_type !== "oauth" || Boolean(policy.requiredRoutes?.length) &&
      policy.requiredRoutes!.every((route) => {
        const [method, path] = route.split(" ");
        return Boolean(method && path && routeAllowed(identity as ApiIdentity, method, path));
      }));
}

export const MCP_TOOL_POLICIES: Readonly<Record<string, ToolPolicy>> = policies;

/** /v1/events declares events:read and sandbox:true. */
export const EVENT_RESOURCE_POLICY = {
  requiredScopes: ["events:read"],
  requiredRoutes: ["GET /v1/events"],
  sandbox: true,
} as const;

registerPolicy("open_live_conversation", { requiredScopes:["conversations:read","messages:read","events:read"], sandbox:true, readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false });
read(["open_botozap"], "customers:read", false);
