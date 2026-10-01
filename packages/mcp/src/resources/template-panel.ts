import { z } from "zod";
import { createElicitInput } from "@openai/mcp-extensions/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { BotoZapError } from "../client.js";
import { templateFields, templateUnsupportedReason } from "../template-preview.js";
import { registerScreenResource } from "./screen-resource.js";
export function registerTemplatePanel(server: McpServer, register: Register) {
  registerScreenResource(server, register, "template");
  register("stage_review_template", "Abre revisão de template aprovado para uma conversa. Não envia mensagem.",
    { conversation_id: z.string().uuid(), template_id: z.string().optional().describe('ID interno ou nome do template aprovado a pré-selecionar.'), suggested_values: z.record(z.record(z.string().max(32768))).optional().describe('Mapa por ID ou nome de template, com chaves body_1/body_2 para posicionais ou body_nome/body_pedido para parâmetros nomeados.'), media_metadata: z.record(z.object({ filename:z.string().max(240).optional(),file_size:z.number().positive().optional() })).optional() }, z.object({ conversation: z.record(z.unknown()), customer_id: z.string(), number: z.record(z.unknown()), preferred_template_id:z.string().optional(), suggested_values:z.record(z.record(z.string())).optional(), media_metadata:z.unknown().optional() }),
    async (client, args) => {
      const conversation = await client.conversations.get(String(args.conversation_id));
      if (conversation.channel === 'instagram') return {conversation, customer_id:'', number:{}};
      if (!conversation.phone_number_id) throw new BotoZapError("unsupported_channel", "Selecione uma conversa WhatsApp.", 422);
      const number = await client.phoneNumbers.get(conversation.phone_number_id);
      if (typeof number.customer_id !== 'string' || !number.customer_id) throw new BotoZapError('missing_customer', 'Negócio da conversa indisponível.', 422);
      return { conversation, number, customer_id: number.customer_id, ...(args.template_id ? { preferred_template_id: String(args.template_id) } : {}), ...(args.suggested_values ? { suggested_values:args.suggested_values } : {}), ...(args.media_metadata ? { media_metadata:args.media_metadata } : {}) };
    });
  register("review_template_variables", "Revisa variáveis em formulário nativo quando o host oferece openai/elicitation; fallback retorna os valores para edição na UI. Não envia.",
    { template_id: z.string(), variables: z.record(z.string().max(32768)).optional() },
    z.object({ supported: z.boolean(), action: z.string(), variables: z.record(z.string()) }),
    async (client, args) => {
      const template = await client.templates.get(String(args.template_id));
      const reason = templateUnsupportedReason(template);
      if (reason) throw new BotoZapError("template_not_supported", reason, 422);
      const values = args.variables as Record<string,string> ?? {};
      const fields = templateFields(template).filter(f => f.required);
      const variables = Object.fromEntries(fields.map(f => [f.key, values[f.key] ?? '']));
      const capabilities = server.server.getClientCapabilities() as { extensions?: Record<string, any> } | undefined;
      if (!capabilities?.extensions?.["openai/elicitation"]?.form || !fields.length || fields.some(f => f.kind !== 'text' || values[f.key+'__format'] && values[f.key+'__format'] !== 'text')) return { supported: false, action: "unsupported", variables };
      const result = await createElicitInput(server)({ mode: "form", message: "Revise os valores que o cliente verá no template aprovado.", requestedSchema: {
        type: "object", properties: Object.fromEntries(fields.map(f => [f.key, { type: "string", title: `${f.section} · ${f.variable}`, minLength: 1, maxLength: f.max, ...(variables[f.key] ? { "x-openai-suggestions": [{ const: variables[f.key]!, title: variables[f.key]! }] } : {}) }])), required: fields.map(f => f.key),
      } });
      return { supported: true, action: result.action, variables: result.action === "accept" ? result.content as Record<string,string> : variables };
    });
}
