import { registerSendIntent, sendIntentKey } from "../send-intent.js";
/** Ferramentas de mensagens: envio, listagem e leitura. */
import { z } from "zod";
import type { InteractivePayload, ListMessagesParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import {
  getMessageResultSchema,
  listMessagesResultSchema,
  sendMessageResultSchema,
} from "../schemas.js";

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
  idempotency_key: sendIntentKey.optional(),
  to: z.string().describe("Destinatário: telefone E.164 (ex.: 5511999999999) ou wa_id."),
  type: z
    .enum(["text", "template", "interactive", "location", "reaction"])
    .describe("Tipo da mensagem. interactive, location e reaction são mensagens livres (exigem janela de 24h aberta)."),
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
  interactive: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Objeto interactive da Cloud API quando type='interactive': type 'button' (até 3 botões reply {id,title≤20}), 'list' (action.button + sections[].rows[] {id,title≤24,description?}, até 10 opções) ou 'cta_url' (action {name:'cta_url', parameters {display_text, url https}}); body.text obrigatório; header/footer opcionais. A API valida e recusa com 422 invalid_request.",
    ),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional()
    .describe("Localização quando type='location'."),
  reaction: z
    .object({
      message_id: z.string().describe("UUID interno ou wamid da mensagem RECEBIDA do contato (até 30 dias)."),
      emoji: z.string().describe("Emoji; string vazia retira a reação."),
    })
    .optional()
    .describe("Reação quando type='reaction'."),
  from: z
    .string()
    .optional()
    .describe("ID Meta ou UUID interno do Número de origem (obrigatório se a conta tem >1 número)."),
} as const;

const PAYLOAD_FIELDS = ["text", "template", "interactive", "location", "reaction"] as const;
const PAYLOAD_HINT: Record<(typeof PAYLOAD_FIELDS)[number], string> = {
  text: "o campo 'text' com { body }",
  template: "o campo 'template' com { name, language.code }",
  interactive: "o campo 'interactive' (objeto da Cloud API)",
  location: "o campo 'location' com { latitude, longitude }",
  reaction: "o campo 'reaction' com { message_id, emoji }",
};

/**
 * Schema refinado que amarra `type` ao payload (o shape base sozinho aceitaria
 * type='text' sem `text`, type='template' sem `template`, ou os dois juntos).
 * Exportado pros testes e usado no handler pra validar ANTES de chamar a API —
 * a validação do próprio SDK roda contra o shape base (sem esta regra cruzada).
 */
export const sendMessageSchema = z
  .object(sendMessageShape)
  .superRefine((val, ctx) => {
    if (!val[val.type]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [val.type],
        message: `type='${val.type}' exige ${PAYLOAD_HINT[val.type]}.`,
      });
    }
    for (const field of PAYLOAD_FIELDS) {
      if (field !== val.type && val[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `type='${val.type}' não aceita '${field}' junto — envie só '${val.type}' (ou use type='${field}').`,
        });
      }
    }
  });

export function registerMessageTools(register: Register): void {
  registerSendIntent(register);
  register(
    "send_message",
    "Recomendado: use prepare_send_intent uma vez e reutilize idempotency_key em retries. Recusas confirmadas liberam a chave; após aguardar/corrigir, repita com a mesma chave. Resultado desconhecido exige conferir o histórico. Chamadas sem chave continuam aceitas, com o comportamento anterior sem deduplicação. Envia uma mensagem de WhatsApp ao destinatário via API do BotoZap. `to` é o número E.164 ou wa_id. Para texto: type='text' e text={ body }. Para template: type='template' e template={ name, language, components? }. Botões/lista/link: type='interactive' e interactive={ type: 'button'|'list'|'cta_url', body, action, ... } (formato Cloud API). Localização: type='location' e location={ latitude, longitude, name?, address? }. Reação a uma mensagem recebida: type='reaction' e reaction={ message_id (UUID ou wamid), emoji } (emoji '' retira). Recusas de plano: 429 free_form_limit_reached (limite 1:1 do Free). `from` aceita ID Meta ou UUID interno do Número e é obrigatório se a conta tem mais de um. O envio pode entregar uma mensagem real. Retorna `id` (UUID interno do BotoZap) e `wamid` (ID da mensagem na Meta), além de `to` e `status`; em reação, também `reaction` { message_id, wamid, emoji, action }.",
    sendMessageShape,
    sendMessageResultSchema,
    (client, args) => {
      // O SDK do MCP já validou `args` contra o shape base; aqui aplicamos a
      // regra cruzada type ↔ payload (que o shape base não expressa) com mensagem
      // PT-BR clara pro agente, ANTES de gastar um round-trip com a API.
      const parsed = sendMessageSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
      }
      const { to, type, text, template, interactive, location, reaction, from, idempotency_key } = parsed.data;
      const options = { idempotencyKey: idempotency_key };
      // Despacha pelo `type` — o superRefine já garantiu o payload correspondente.
      // Resposta direta (sem envelope), igual ao POST /messages.
      if (type === "text") {
        return client.messages.send({ to, text: text!.body, from }, options);
      }
      if (type === "interactive") {
        return client.messages.sendInteractive(
          { to, interactive: interactive as unknown as InteractivePayload, from },
          options,
        );
      }
      if (type === "location") return client.messages.sendLocation({ to, ...location!, from }, options);
      if (type === "reaction") return client.messages.sendReaction({ to, ...reaction!, from }, options);
      return client.messages.sendTemplate({ to, template: template!, from }, { idempotencyKey: idempotency_key });
    },
  );

  register(
    "list_messages",
    "Lista mensagens da conta (paginação por cursor: { data, paging }). Filtros opcionais por número (ID Meta ou UUID interno), conversa (UUID interno), direção, status, tipo e presença de mídia; `sort` escolhe a ordem. Cada mensagem traz `source` (api, app, history, broadcast).",
    {
      phone_number_id: z.string().optional().describe("Filtra pelo ID Meta ou UUID interno do número."),
      conversation_id: z.string().optional().describe("Filtra pela conversa (uuid interno)."),
      direction: z.enum(["inbound", "outbound"]).optional(),
      status: z.string().optional().describe("Status da mensagem (enum message_status)."),
      message_type: z.string().optional().describe("Tipo da mensagem (kind: text, image, ...)."),
      has_media: z.boolean().optional().describe("true para apenas mensagens com mídia."),
      sort: z
        .enum(["created_at", "event_at"])
        .optional()
        .describe("Ordem: created_at (padrão, chegada à BotoZap) ou event_at (data real da mensagem). Reuse o cursor com o mesmo sort."),
      limit: z.number().int().positive().optional().describe("Tamanho da página."),
      after: z.string().optional().describe("Cursor opaco da próxima página (paging.next)."),
      before: z.string().optional().describe("Cursor opaco da página anterior (paging.previous)."),
    },
    listMessagesResultSchema,
    (client, args) => client.messages.list(args as ListMessagesParams),
  );

  register(
    "get_message",
    "Busca uma mensagem pelo UUID interno do BotoZap ou pelo `wamid` atribuído pela Meta. Retorna { data }.",
    { id: z.string().describe("UUID interno da mensagem ou `wamid` da Meta.") },
    getMessageResultSchema,
    async (client, args) => ({ data: await client.messages.get(String(args.id)) }),
  );
}
