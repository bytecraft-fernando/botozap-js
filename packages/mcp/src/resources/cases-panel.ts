import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { isToolAllowed, getToolPolicy } from "../permissions.js";
import { registerScreenResource } from "./screen-resource.js";
import { groupInbox, messagePreview } from "../agent-inbox.js";
export function registerCasesPanel(server: McpServer, register: Register) {
  registerScreenResource(server, register, "cases");
  register("open_agent_cases", "Mostra alertas não resolvidos (abertos e reconhecidos), conversas com agente pausado e casos escalados, com evidência e permissões da identidade atual. customer_id é opcional: sem ele agrega todos os negócios autorizados. Chame diretamente para saber se a IA precisa de ajuda; nunca abra open_botozap ou outra UI só para descobrir IDs. Se precisar escolher negócio, use list_customers sem UI. Não assume nem retoma automação.",
    { customer_id: z.string().uuid().optional() }, z.object({ customer_id: z.string().nullable(), businesses: z.unknown(), cases: z.unknown(), alerts: z.unknown(), paused: z.unknown(), usage: z.unknown(), user_id: z.string().nullable(), can_update: z.boolean(), can_resume: z.boolean(), summary: z.unknown() }),
    async (client, args, identity) => {
      const businesses: {id:string;name?:unknown}[] = [];
      if(args.customer_id)businesses.push({id:String(args.customer_id)});
      else for(let page=1,pages=1;page<=pages;page++){
        const result=await client.customers.list({page,per_page:100});businesses.push(...result.data);pages=result.meta.total_pages;
      }
      async function readBusiness(business:{id:string;name?:unknown}) {
      const customer_id=business.id;
      const now = new Date(); const start = new Date(now); start.setUTCHours(0,0,0,0);
      const caseRows:Record<string,any>[]=[];let caseTotal=0;
      for(let page=1,pages=1;page<=pages;page++){const result=await client.ai.invoke("cases","list",{customer_id,status:"open",page,per_page:100}) as any;caseRows.push(...result.data);caseTotal=result.meta.total_count;pages=result.meta.total_pages;}
      const cases={data:caseRows,meta:{total_count:caseTotal}};
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
      const seenCursors=new Set<string>();let cursor=paused.paging.next;
      while(cursor){if(seenCursors.has(cursor))throw new Error('Cursor de conversas repetido pela API.');seenCursors.add(cursor);const next=await client.conversations.list({customer_id,agent_paused:true,limit:100,after:cursor});paused.data.push(...next.data);cursor=next.paging.next;}
      paused.paging.next=null;
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
      const usage = await client.ai.invoke("usage", "get", { customer_id, from: start.toISOString(), to: now.toISOString() }).catch(() => null);
      for(const row of [...alerts.data,...paused.data,...(cases as any).data] as any[]){row.customer_id=customer_id;row.customer_name=business.name;row.latest_customer_preview=messagePreview(row.latest_customer_message);}
      return { customer_id, cases, alerts, paused, usage: (usage as any)?.data??usage, can_resume: isToolAllowed(getToolPolicy("control_conversation_agent"), identity), user_id: identity.user_id ?? null, can_update: isToolAllowed(getToolPolicy("ai_cases_update"), identity) };
      }
      const parts=[];for(const business of businesses)parts.push(await readBusiness(business));
      const alerts={data:parts.flatMap(p=>p.alerts.data),meta:{total_count:parts.reduce((n,p)=>n+p.alerts.meta.total_count,0)}};
      const cases={data:parts.flatMap(p=>(p.cases as any).data),meta:{total_count:parts.reduce((n,p)=>n+(p.cases as any).meta.total_count,0)}};
      const paused={data:parts.flatMap(p=>p.paused.data),paging:{next:parts.some(p=>p.paused.paging.next)?'more':null}};
      const unique=groupInbox({alerts,cases,paused});
      const summary={unique_items:unique.length,alerts_unresolved:alerts.meta.total_count,alerts_by_status:{open:alerts.data.filter(a=>a.status==='open').length,acknowledged:alerts.data.filter(a=>a.status==='acknowledged').length},alerts:alerts.data.map(a=>({status:a.status,severity:a.severity,title:a.title})),paused_conversations:paused.data.length,open_cases:cases.meta.total_count,businesses:businesses.length,instruction:'Contagem principal de conversas/itens únicos: alertas, pausas e casos da mesma conversa são agrupados e não somados. Informe todas as categorias; zero casos não significa ausência de alertas ou pausadas.'};
      return {customer_id:args.customer_id?String(args.customer_id):businesses.length===1?businesses[0]!.id:null,businesses,cases,alerts,paused,usage:parts.length===1?parts[0]!.usage:null,summary,user_id:identity.user_id??null,can_resume:isToolAllowed(getToolPolicy('control_conversation_agent'),identity),can_update:isToolAllowed(getToolPolicy('ai_cases_update'),identity)};
    });
}
