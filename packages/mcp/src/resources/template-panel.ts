import { z } from "zod";
import { createElicitInput } from "@openai/mcp-extensions/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { BotoZapError } from "../client.js";
import { templateFields, supportedTemplate } from "../template-preview.js";
import { registerScreenResource } from "./screen-resource.js";
export function registerTemplatePanel(server: McpServer, register: Register) {
  registerScreenResource(server, register, "template");
  register("stage_review_template", "Abre revisão de template aprovado para uma conversa. Não envia mensagem.",
    { conversation_id: z.string().uuid() }, z.object({ conversation: z.record(z.unknown()), customer_id: z.string(), number: z.record(z.unknown()) }),
    async (client, args) => {
      const conversation = await client.conversations.get(String(args.conversation_id));
      if (!conversation.phone_number_id) throw new BotoZapError("unsupported_channel", "Selecione uma conversa WhatsApp.", 422);
      const number = await client.phoneNumbers.get(conversation.phone_number_id);
      if (typeof number.customer_id !== 'string' || !number.customer_id) throw new BotoZapError('missing_customer', 'Negócio da conversa indisponível.', 422);
      return { conversation, number, customer_id: number.customer_id };
    });
  register("review_template_variables", "Revisa variáveis em formulário nativo quando o host oferece openai/elicitation; fallback retorna os valores para edição na UI. Não envia.",
    { template_id: z.string(), variables: z.record(z.string().max(2000)).optional() },
    z.object({ supported: z.boolean(), action: z.string(), variables: z.record(z.string()) }),
    async (client, args) => {
      const template = await client.templates.get(String(args.template_id));
      if (!supportedTemplate(template)) throw new BotoZapError("template_not_supported", "Use um template aprovado com prévia de texto suportada.", 422);
      const values = args.variables as Record<string,string> ?? {};
      const fields = templateFields(template);
      const variables = Object.fromEntries(fields.map(f => [f.key, values[f.key] ?? '']));
      const capabilities = server.server.getClientCapabilities() as { extensions?: Record<string, any> } | undefined;
      if (!capabilities?.extensions?.["openai/elicitation"]?.form || !fields.length) return { supported: false, action: "unsupported", variables };
      const result = await createElicitInput(server)({ mode: "form", message: "Revise os valores que o cliente verá no template aprovado.", requestedSchema: {
        type: "object", properties: Object.fromEntries(fields.map(f => [f.key, { type: "string", title: `${f.section} · ${f.variable}`, minLength: 1, maxLength: 2000, ...(variables[f.key] ? { "x-openai-suggestions": [{ const: variables[f.key]!, title: variables[f.key]! }] } : {}) }])), required: fields.map(f => f.key),
      } });
      return { supported: true, action: result.action, variables: result.action === "accept" ? result.content as Record<string,string> : variables };
    });
}
