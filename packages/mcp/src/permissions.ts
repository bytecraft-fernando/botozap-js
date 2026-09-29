import { AI_OPERATIONS } from "@botozap/sdk";
import { getAiToolEffects } from "./ai-tool-effects.js";

export type ToolPolicy = {
  requiredScopes: readonly string[];
  sandbox: boolean;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
};

const policies: Record<string, ToolPolicy> = {};
function registerPolicy(name: string, policy: ToolPolicy): void {
  if (policies[name]) throw new Error(`Política MCP duplicada: ${name}`);
  policies[name] = policy;
}
function read(names: readonly string[], scope: string, sandbox: boolean): void {
  for (const name of names) registerPolicy(name, {
    requiredScopes: [scope], sandbox, readOnlyHint: true,
    destructiveHint: false, openWorldHint: false,
  });
}
function write(
  names: readonly string[], scope: string | readonly string[], sandbox: boolean,
  hints: { destructiveHint: boolean; openWorldHint: boolean },
): void {
  for (const name of names) registerPolicy(name, {
    requiredScopes: typeof scope === "string" ? [scope] : scope,
    sandbox, readOnlyHint: false, ...hints,
  });
}

// Scope + sandbox flag follow the concrete withV1 endpoint declarations.
write(["send_message", "send_media_message"], "messages:send", true,
  { destructiveHint: true, openWorldHint: true });
read(["list_messages", "get_message"], "messages:read", true);
read(["list_conversations", "get_conversation"], "conversations:read", true);
write(["reply_to_conversation"], ["conversations:read", "messages:send"], true,
  { destructiveHint: true, openWorldHint: true });
// SDK reply() first GETs the conversation, so this tool needs both route scopes.
write(["update_conversation"], "conversations:write", true,
  { destructiveHint: true, openWorldHint: false });
read(["list_contacts"], "contacts:read", true);
read(["get_contact"], "contacts:read", false);
write(["create_contact"], "contacts:write", false,
  { destructiveHint: false, openWorldHint: false });
write(["update_contact"], "contacts:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["delete_contact"], "contacts:write", false,
  { destructiveHint: true, openWorldHint: false });
read(["list_customers", "get_customer", "list_setup_links"], "customers:read", false);
write(["create_customer", "create_setup_link"], "customers:write", false,
  { destructiveHint: false, openWorldHint: false });
write(["update_customer", "update_setup_link"], "customers:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["delete_customer"], "customers:write", false,
  { destructiveHint: true, openWorldHint: false });
read(["list_phone_numbers"], "numbers:read", true);
read(["get_phone_number", "phone_number_health"], "numbers:read", false);
write(["update_phone_number"], "numbers:write", false,
  { destructiveHint: true, openWorldHint: false });
read(["list_templates", "get_template"], "templates:read", true);
write(["create_template"], "templates:write", true,
  { destructiveHint: true, openWorldHint: true });
read(["list_webhooks", "get_webhook", "list_webhook_deliveries"], "webhooks:read", false);
write(["create_webhook"], "webhooks:write", false,
  { destructiveHint: false, openWorldHint: true });
write(["update_webhook"], "webhooks:write", false,
  { destructiveHint: true, openWorldHint: true });
write(["delete_webhook"], "webhooks:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["test_webhook"], "webhooks:write", false,
  { destructiveHint: true, openWorldHint: true });
read(["list_api_logs"], "logs:read", false);
read(["list_users"], "team:read", false);
read(["get_meta_costs"], "customers:read", false);
write(["ingest_media"], "media:write", false,
  { destructiveHint: false, openWorldHint: true });
read(["list_contact_stages", "list_contact_fields"], "contacts:read", false);
write(["create_contact_stage", "create_contact_field"], "contacts:write", false,
  { destructiveHint: false, openWorldHint: false });
write(["update_contact_stage", "reorder_contact_stages", "update_contact_field"], "contacts:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["delete_contact_stage", "delete_contact_field"], "contacts:write", false,
  { destructiveHint: true, openWorldHint: false });

read(["list_appointments", "get_appointment", "list_appointment_history", "get_appointment_availability"], "appointments:read", false);
write(["create_appointment"], "appointments:write", false,
  { destructiveHint: false, openWorldHint: true });
write(["update_appointment"], "appointments:write", false,
  { destructiveHint: true, openWorldHint: true });
write(["delete_appointment"], "appointments:write", false,
  { destructiveHint: true, openWorldHint: true });
read(["list_appointment_services", "list_appointment_schedules", "list_appointment_exceptions"], "appointments:read", false);
write(["create_appointment_service", "create_appointment_schedule", "create_appointment_exception"], "appointments:write", false,
  { destructiveHint: false, openWorldHint: false });
write(["update_appointment_service", "update_appointment_schedule", "update_appointment_exception"], "appointments:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["delete_appointment_exception"], "appointments:write", false,
  { destructiveHint: true, openWorldHint: false });
read(["list_calendar_connections", "list_connection_calendars", "list_calendar_jobs"], "calendar:read", false);
write(["disconnect_calendar"], "calendar:write", false,
  { destructiveHint: true, openWorldHint: true });
write(["refresh_connection_calendars"], "calendar:write", false,
  { destructiveHint: false, openWorldHint: true });
write(["select_calendar"], "calendar:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["retry_calendar_job", "resolve_calendar_conflict"], "calendar:write", false,
  { destructiveHint: true, openWorldHint: true });

read(["list_saved_replies", "get_saved_reply"], "saved_replies:read", false);
write(["create_saved_reply"], "saved_replies:write", false,
  { destructiveHint: false, openWorldHint: false });
write(["update_saved_reply"], "saved_replies:write", false,
  { destructiveHint: true, openWorldHint: false });
write(["delete_saved_reply"], "saved_replies:write", false,
  { destructiveHint: true, openWorldHint: false });
read(["get_inbox_tools"], "inbox:read", true);
write(["mutate_inbox_tools"], "inbox:write", true,
  { destructiveHint: true, openWorldHint: false });
read(["list_opportunities", "get_opportunity", "list_opportunity_activities", "list_opportunity_conversations", "list_demands", "get_demand", "list_demand_activities", "list_demand_conversations", "list_radar", "list_radar_stage_rules"], "crm:read", true);
write(["create_opportunity", "create_demand"], "crm:write", true,
  { destructiveHint: false, openWorldHint: false });
write(["update_opportunity", "update_demand", "unlink_opportunity_conversation", "unlink_demand_conversation", "configure_radar_stage_rule"], "crm:write", true,
  { destructiveHint: true, openWorldHint: false });
write(["link_opportunity_conversation", "link_demand_conversation"], "crm:write", true,
  { destructiveHint: false, openWorldHint: false });
read(["list_journeys", "get_journey", "list_journey_runs", "get_journey_run"], "journeys:read", false);
write(["create_journey"], "journeys:write", false,
  { destructiveHint: false, openWorldHint: true });
write(["update_journey"], "journeys:write", false,
  { destructiveHint: true, openWorldHint: true });
write(["archive_journey", "control_journey", "control_journey_run"], "journeys:write", false,
  { destructiveHint: true, openWorldHint: true });
write(["enroll_journey"], "journeys:write", false,
  { destructiveHint: true, openWorldHint: true });
read(["list_conversation_assignments", "get_conversation_assignment"], "conversations:read", true);
write(["create_conversation_assignment"], "conversations:write", true,
  { destructiveHint: false, openWorldHint: false });
write(["update_conversation_assignment"], "conversations:write", true,
  { destructiveHint: true, openWorldHint: false });
write(["control_conversation_agent"], "agents:write", false,
  { destructiveHint: true, openWorldHint: true });

// AI endpoint effects are maintained as an explicit catalog. A new operation
// without an entry fails startup rather than inheriting defaults.
for (const op of AI_OPERATIONS) {
  const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  const name = `ai_${snake(op.group)}_${snake(op.name)}`;
  const scope = op.scope ?? (op.method === "GET" ? "agents:read" : "agents:write");
  const effect = getAiToolEffects(`${op.group}.${op.name}`);
  registerPolicy(name, {
    requiredScopes: [scope], sandbox: false,
    readOnlyHint: effect.readOnlyHint,
    destructiveHint: effect.destructiveHint,
    openWorldHint: effect.openWorldHint,
  });
}

export function getToolPolicy(name: string): ToolPolicy {
  const policy = policies[name];
  if (!policy) throw new Error(`Ferramenta MCP sem política de permissões: ${name}`);
  return policy;
}

export function isToolAllowed(
  policy: Pick<ToolPolicy, "requiredScopes" | "sandbox">,
  identity: { scopes: readonly string[]; environment: "live" | "sandbox" },
): boolean {
  return policy.requiredScopes.every((scope) => identity.scopes.includes(scope)) &&
    (identity.environment !== "sandbox" || policy.sandbox);
}

export const MCP_TOOL_POLICIES: Readonly<Record<string, ToolPolicy>> = policies;

/** /v1/events declares events:read and sandbox:true. */
export const EVENT_RESOURCE_POLICY = {
  requiredScopes: ["events:read"],
  sandbox: true,
} as const;
