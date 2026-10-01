import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { isToolAllowed, getToolPolicy } from "../permissions.js";
import { registerScreenResource } from "./screen-resource.js";
export function registerCasesPanel(server: McpServer, register: Register) {
  registerScreenResource(server, register, "cases");
  register("open_agent_cases", "Mostra alertas não resolvidos (abertos e reconhecidos), conversas com agente pausado e casos escalados, com evidência e permissões da identidade atual. Não assume nem retoma automação.",
    { customer_id: z.string().uuid() }, z.object({ customer_id: z.string(), cases: z.unknown(), alerts: z.unknown(), paused: z.unknown(), usage: z.unknown(), user_id: z.string().nullable(), can_update: z.boolean(), can_resume: z.boolean(), summary: z.unknown() }),
    async (client, args, identity) => {
      const customer_id = String(args.customer_id);
      const now = new Date(); const start = new Date(now); start.setUTCHours(0,0,0,0);
      const cases = await client.ai.invoke("cases", "list", { customer_id, status: "open", per_page: 20 });
      const groups = await Promise.all(["open", "acknowledged"].map(async status => {
        const rows: Record<string, any>[] = []; let total = 0;
        for (let page = 1, pages = 1; page <= pages; page++) {
          const result = await client.ai.invoke("alerts", "list", { customer_id, status, per_page: 100, page }) as any;
          rows.push(...result.data.filter((a: any) => a.status === status)); total = result.meta.total_count; pages = result.meta.total_pages;
        }
        return { data: rows, total };
      }));
      const alerts = { data: groups.flatMap(g => g.data), meta: { total_count: groups.reduce((n,g)=>n+g.total,0) } };
      const paused = await client.conversations.list({ customer_id, agent_paused: true, limit: 100 });
      // Preview is optional and each read uses the same route/scope policy as its tool.
      if (isToolAllowed(getToolPolicy("list_messages"), identity)) {
        const ids = [...new Set([...alerts.data, ...paused.data, ...(cases as any).data].map((r:any)=>r.conversation_id || (r.agent_paused_at ? r.id : null)).filter(Boolean))] as string[];
        const previews = new Map<string, unknown>();
        for (let offset=0; offset<ids.length; offset+=4) await Promise.all(ids.slice(offset,offset+4).map(async id=>{
          try { previews.set(id, (await client.messages.list({conversation_id:id, direction:"inbound", sort:"created_at", limit:1})).data[0] ?? null); }
          catch { previews.set(id, null); }
        }));
        for (const row of [...alerts.data, ...paused.data, ...(cases as any).data] as any[]) row.latest_customer_message = previews.get(row.conversation_id || row.id) ?? null;
      }
      for (const row of alerts.data) { const conversation = paused.data.find(c=>c.id===row.conversation_id); if(conversation)row.contact_name=conversation.contact?.name || conversation.contact?.phone; }
      const summary = { alerts_unresolved: alerts.meta.total_count, alerts_by_status: Object.fromEntries(groups.map((g,i)=>[["open","acknowledged"][i],g.total])), alerts: alerts.data.map(a=>({id:a.id,status:a.status,severity:a.severity,title:a.title})), paused_conversations: paused.data.length, paused_has_more: Boolean(paused.paging.next), open_cases: (cases as any).meta.total_count, instruction: "Categorias independentes: zero casos não significa zero alertas ou conversas pausadas. Informe todas as contagens, status e severidades; não afirme ausência quando há itens." };
      const usage = await client.ai.invoke("usage", "get", { customer_id, from: start.toISOString(), to: now.toISOString() }).catch(() => null);
      return { customer_id, cases, alerts, paused, usage, summary, can_resume: isToolAllowed(getToolPolicy("control_conversation_agent"), identity), user_id: identity.user_id ?? null, can_update: isToolAllowed(getToolPolicy("ai_cases_update"), identity) };
    });
}
