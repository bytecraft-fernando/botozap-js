import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { isToolAllowed, getToolPolicy } from "../permissions.js";
import { registerScreenResource } from "./screen-resource.js";
export function registerCasesPanel(server: McpServer, register: Register) {
  registerScreenResource(server, register, "cases");
  register("open_agent_cases", "Mostra alertas abertos, conversas com agente pausado e casos escalados, com evidência e permissões da identidade atual. Não assume nem retoma automação.",
    { customer_id: z.string().uuid() }, z.object({ customer_id: z.string(), cases: z.unknown(), alerts: z.unknown(), paused: z.unknown(), usage: z.unknown(), user_id: z.string().nullable(), can_update: z.boolean() }),
    async (client, args, identity) => {
      const customer_id = String(args.customer_id);
      const now = new Date(); const start = new Date(now); start.setUTCHours(0,0,0,0);
      const cases = await client.ai.invoke("cases", "list", { customer_id, status: "open", per_page: 20 });
      const alerts = await client.ai.invoke("alerts", "list", { customer_id, status: "open", per_page: 100 });
      const paused = await client.conversations.list({ customer_id, agent_paused: true, limit: 100 });
      const usage = await client.ai.invoke("usage", "get", { customer_id, from: start.toISOString(), to: now.toISOString() }).catch(() => null);
      return { customer_id, cases, alerts, paused, usage, user_id: identity.user_id ?? null, can_update: isToolAllowed(getToolPolicy("ai_cases_update"), identity) };
    });
}
