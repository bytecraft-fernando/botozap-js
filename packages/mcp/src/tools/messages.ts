/** Ferramentas de mensagens: envio, listagem e leitura. */
import { z } from "zod";
import type { ListMessagesParams } from "@botozap/sdk";
import type { Register } from "../register.js";

/**
 * Shape (raw) de `send_message`. Fica como *raw shape* de propósito: é ele que
 * vai pro `registerTool` do MCP SDK, que só gera JSON Schema (com as descrições
 * dos campos, que o AGENTE lê) a partir de um ZodObject/raw shape. Um schema
 * refinado (`superRefine`) ou uma discriminated union viram ZodEffects/ZodUnion
 * SEM `.shape` — o `normalizeObjectSchema` do SDK não os reconhece e cai no
 * `EMPTY_OBJECT_JSON_SCHEMA`, apagando todas as descrições. Por isso: shape base
 * pro JSON Schema; a regra cruzada (type ↔ payload) mora no `sendMessageSchema`.
 */
const sendMessageShape = {
  to: z.string().describe("Destinatário: telefone E.164 (ex.: 5511999999999) ou wa_id."),
  type: z.enum(["text", "template"]).describe("Tipo da mensagem."),
  text: z
    .object({ body: z.string() })
    .optional()
    .describe("Conteúdo de texto quando type='text'."),
  // Schema restritivo de propósito: o MCP é consumido por AGENTES, então o
  // objeto do template precisa espelhar o contrato da rota (e do SDK:
  // TemplatePayload) — não aceitar "qualquer objeto". A rota exige `name` e o
  // objeto `language: { code }` (string solta é rejeitada). `components` fica
  // como array de objetos livres porque é genuinamente o formato aberto da
  // Cloud API (parâmetros de header/body/button). Contraste com create_template
  // em tools/templates.ts, onde `components` também é livre pelo mesmo motivo.
  template: z
    .object({
      name: z.string().describe("Nome do template APROVADO na Meta."),
      language: z
        .object({
          code: z.string().describe("Código de idioma, ex.: pt_BR."),
          // Zod sem .strict() faz STRIP de chaves extras — sem `policy`
          // declarado, um `language.policy` legítimo da Cloud API seria
          // descartado em silêncio. Declarado pra preservar.
          policy: z
            .string()
            .optional()
            .describe("Política de idioma da Cloud API (ex.: deterministic)."),
        })
        .describe("Idioma no formato da Cloud API: { code, policy? }."),
      components: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          "Componentes com parâmetros (header/body/button) no formato da Cloud API.",
        ),
    })
    .optional()
    .describe(
      "Objeto do template quando type='template'. Exige name e language.code.",
    ),
  from: z
    .string()
    .optional()
    .describe("phone_number_id de origem (obrigatório se a conta tem >1 número)."),
} as const;

/**
 * Schema refinado que amarra `type` ao payload (o shape base sozinho aceitaria
 * type='text' sem `text`, type='template' sem `template`, ou os dois juntos).
 * Exportado pros testes e usado no handler pra validar ANTES de chamar a API —
 * a validação do próprio SDK roda contra o shape base (sem esta regra cruzada).
 */
export const sendMessageSchema = z
  .object(sendMessageShape)
  .superRefine((val, ctx) => {
    if (val.type === "text") {
      if (!val.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["text"],
          message: "type='text' exige o campo 'text' com { body }.",
        });
      }
      if (val.template) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["template"],
          message:
            "type='text' não aceita 'template' junto — envie só 'text' (ou use type='template').",
        });
      }
    } else if (val.type === "template") {
      if (!val.template) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["template"],
          message: "type='template' exige o campo 'template' com { name, language.code }.",
        });
      }
      if (val.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["text"],
          message:
            "type='template' não aceita 'text' junto — envie só 'template' (ou use type='text').",
        });
      }
    }
  });

export function registerMessageTools(register: Register): void {
  register(
    "send_message",
    "Envia uma mensagem de WhatsApp (texto ou template) via API do BotoZap. `to` é o número E.164 ou wa_id do destinatário. Para texto: type='text' e text={ body }. Para template: type='template' e template={ name, language, components? }. `from` (phone_number_id) é obrigatório se a conta tem mais de um número. Retorna { id, wamid, to, status }.",
    sendMessageShape,
    (client, args) => {
      // O SDK do MCP já validou `args` contra o shape base; aqui aplicamos a
      // regra cruzada type ↔ payload (que o shape base não expressa) com mensagem
      // PT-BR clara pro agente, ANTES de gastar um round-trip com a API.
      const parsed = sendMessageSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
      }
      const { to, type, text, template, from } = parsed.data;
      // Despacha pelo `type` — o superRefine já garantiu o payload correspondente.
      // Resposta direta (sem envelope), igual ao POST /messages.
      if (type === "text") {
        return client.messages.send({ to, text: text!.body, from });
      }
      return client.messages.sendTemplate({ to, template: template!, from });
    },
  );

  register(
    "list_messages",
    "Lista mensagens da conta (paginação por cursor: { data, paging }). Filtros opcionais por número, conversa, direção, status, tipo e presença de mídia.",
    {
      phone_number_id: z.string().optional().describe("Filtra pelo phone_number_id (Meta)."),
      conversation_id: z.string().optional().describe("Filtra pela conversa (uuid interno)."),
      direction: z.enum(["inbound", "outbound"]).optional(),
      status: z.string().optional().describe("Status da mensagem (enum message_status)."),
      message_type: z.string().optional().describe("Tipo da mensagem (kind: text, image, ...)."),
      has_media: z.boolean().optional().describe("true para apenas mensagens com mídia."),
      limit: z.number().int().positive().optional().describe("Tamanho da página."),
      after: z.string().optional().describe("Cursor: itens após este created_at."),
      before: z.string().optional().describe("Cursor: itens antes deste created_at."),
    },
    (client, args) => client.messages.list(args as ListMessagesParams),
  );

  register(
    "get_message",
    "Busca uma mensagem específica pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID da mensagem (uuid interno).") },
    async (client, args) => ({ data: await client.messages.get(String(args.id)) }),
  );
}
