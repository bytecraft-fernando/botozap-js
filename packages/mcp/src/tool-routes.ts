/** Concrete API contracts used by each non-AI tool. OAuth discovery fails
 * closed for a new tool until its routes are reviewed. AI has its own catalog. */
export const TOOL_ROUTES: Record<string, readonly string[]> = {};
function routes(names: string[], ...required: string[]) {
  for (const name of names) TOOL_ROUTES[name] = required;
}
routes(["prepare_send_intent"], "POST /v1/messages");
routes(["send_message", "send_media_message"], "POST /v1/messages");
routes(["list_messages"], "GET /v1/messages");
routes(["get_message"], "GET /v1/messages/:id");
routes(["list_conversations"], "GET /v1/conversations");
routes(["stage_review_reply"], "GET /v1/conversations/:id", "GET /v1/phone_numbers/:id");
routes(["get_conversation"], "GET /v1/conversations/:id");
routes(["reply_to_conversation"], "GET /v1/conversations/:id", "POST /v1/messages");
routes(["update_conversation"], "PATCH /v1/conversations/:id");
routes(["control_conversation_agent"], "POST /v1/conversations/:id/agent-control");
routes(["list_contacts"], "GET /v1/contacts");
routes(["get_contact"], "GET /v1/contacts/:id");
routes(["create_contact"], "POST /v1/contacts");
routes(["update_contact"], "PATCH /v1/contacts/:id");
routes(["delete_contact"], "DELETE /v1/contacts/:id");
routes(["open_review_panel", "list_customers"], "GET /v1/customers");
routes(["get_customer"], "GET /v1/customers/:id");
routes(["create_customer"], "POST /v1/customers");
routes(["update_customer"], "PATCH /v1/customers/:id");
routes(["delete_customer"], "DELETE /v1/customers/:id");
routes(["list_setup_links"], "GET /v1/customers/:id/setup_links");
routes(["create_setup_link"], "POST /v1/customers/:id/setup_links");
routes(["update_setup_link"], "PATCH /v1/customers/:id/setup_links/:linkId");
routes(["list_phone_numbers"], "GET /v1/phone_numbers");
routes(["get_phone_number"], "GET /v1/phone_numbers/:id");
routes(["update_phone_number"], "PATCH /v1/phone_numbers/:id");
routes(["phone_number_health"], "GET /v1/phone_numbers/:id/health");
routes(["list_templates"], "GET /v1/templates");
routes(["get_template"], "GET /v1/templates/:id");
routes(["create_template"], "POST /v1/templates");
routes(["list_webhooks"], "GET /v1/webhooks");
routes(["get_webhook"], "GET /v1/webhooks/:id");
routes(["create_webhook"], "POST /v1/webhooks");
routes(["update_webhook"], "PATCH /v1/webhooks/:id");
routes(["delete_webhook"], "DELETE /v1/webhooks/:id");
routes(["test_webhook"], "POST /v1/webhooks/:id/test");
routes(["list_webhook_deliveries"], "GET /v1/webhook_deliveries");
routes(["list_api_logs"], "GET /v1/api_logs");
routes(["list_users"], "GET /v1/users");
routes(["get_meta_costs"], "GET /v1/usage/meta-costs");
routes(["ingest_media"], "POST /v1/media");
for (const [plural, singular] of [["contact-stages", "contact_stage"], ["contact-fields", "contact_field"], ["saved-replies", "saved_reply"]] as const) {
  const list = plural === "saved-replies" ? "saved_replies" : plural.replaceAll("-", "_");
  routes([`list_${list}`], `GET /v1/${plural}`);
  routes([`get_${singular}`], `GET /v1/${plural}/:id`);
  routes([`create_${singular}`], `POST /v1/${plural}`);
  routes([`update_${singular}`], `PATCH /v1/${plural}/:id`);
  routes([`delete_${singular}`], `DELETE /v1/${plural}/:id`);
}
routes(["reorder_contact_stages"], "PATCH /v1/contact-stages/reorder");
routes(["get_inbox_tools"], "GET /v1/conversations/:id/tools");
routes(["mutate_inbox_tools"], "PATCH /v1/conversations/:id/tools");
for (const [plural, singular] of [["opportunities", "opportunity"], ["demands", "demand"]] as const) {
  routes([`list_${plural}`], `GET /v1/${plural}`);
  routes([`get_${singular}`], `GET /v1/${plural}/:id`);
  routes([`create_${singular}`], `POST /v1/${plural}`);
  routes([`update_${singular}`], `PATCH /v1/${plural}/:id`);
  routes([`list_${singular}_activities`], `GET /v1/${plural}/:id/activities`);
  routes([`list_${singular}_conversations`], `GET /v1/${plural}/:id/conversations`);
  routes([`link_${singular}_conversation`], `POST /v1/${plural}/:id/conversations`);
  routes([`unlink_${singular}_conversation`], `DELETE /v1/${plural}/:id/conversations`);
}
routes(["list_radar"], "GET /v1/radar");
routes(["list_radar_stage_rules"], "GET /v1/radar/stage-rules");
routes(["configure_radar_stage_rule"], "PUT /v1/radar/stage-rules/:id");
routes(["list_journeys"], "GET /v1/journeys");
routes(["get_journey"], "GET /v1/journeys/:id");
routes(["create_journey"], "POST /v1/journeys");
routes(["update_journey"], "PUT /v1/journeys/:id");
routes(["archive_journey"], "DELETE /v1/journeys/:id");
routes(["control_journey"], "POST /v1/journeys/:id/control");
routes(["list_journey_runs"], "GET /v1/journeys/:id/runs");
routes(["enroll_journey"], "POST /v1/journeys/:id/runs");
routes(["get_journey_run"], "GET /v1/journey-runs/:id");
routes(["control_journey_run"], "POST /v1/journey-runs/:id/control");
routes(["list_conversation_assignments"], "GET /v1/conversations/:id/assignments");
routes(["get_conversation_assignment"], "GET /v1/conversations/:id/assignments/:assignmentId");
routes(["create_conversation_assignment"], "POST /v1/conversations/:id/assignments");
routes(["update_conversation_assignment"], "PATCH /v1/conversations/:id/assignments/:assignmentId");
routes(["list_appointments"], "GET /v1/appointments");
routes(["get_appointment"], "GET /v1/appointments/:id");
routes(["create_appointment"], "POST /v1/appointments");
routes(["update_appointment"], "PATCH /v1/appointments/:id");
routes(["delete_appointment"], "DELETE /v1/appointments/:id");
routes(["list_appointment_history"], "GET /v1/appointments/:id/history");
routes(["get_appointment_availability"], "GET /v1/appointments/availability");
for (const [plural, singular] of [["services", "service"], ["schedules", "schedule"], ["exceptions", "exception"]] as const) {
  routes([`list_appointment_${plural}`], `GET /v1/appointments/${plural}`);
  routes([`create_appointment_${singular}`], `POST /v1/appointments/${plural}`);
  routes([`update_appointment_${singular}`], `PATCH /v1/appointments/${plural}/:id`);
  routes([`delete_appointment_${singular}`], `DELETE /v1/appointments/${plural}/:id`);
}
routes(["list_calendar_connections"], "GET /v1/calendar/connections");
routes(["disconnect_calendar"], "DELETE /v1/calendar/connections/:id");
routes(["list_connection_calendars"], "GET /v1/calendar/connections/:id/calendars");
routes(["refresh_connection_calendars"], "POST /v1/calendar/connections/:id/refresh");
routes(["select_calendar"], "PATCH /v1/calendar/selections/:id");
routes(["list_calendar_jobs"], "GET /v1/calendar/jobs");
routes(["retry_calendar_job"], "POST /v1/calendar/jobs/:id/retry");
routes(["resolve_calendar_conflict"], "POST /v1/calendar/conflicts/:id/resolve");

routes(["stage_review_template"], "GET /v1/conversations/:id", "GET /v1/phone_numbers/:id");
routes(["review_template_variables"], "GET /v1/templates/:id");
routes(["open_agent_cases"], "GET /v1/ai/cases", "GET /v1/ai/alerts", "GET /v1/conversations", "GET /v1/customers");
routes(["stage_appointment_booking"], "GET /v1/conversations/:id", "GET /v1/phone_numbers/:id", "GET /v1/appointments/services", "GET /v1/appointments/availability");

routes(["open_live_conversation"], "GET /v1/conversations/:id", "GET /v1/messages", "GET /v1/events");
routes(["open_botozap"], "GET /v1/customers");
