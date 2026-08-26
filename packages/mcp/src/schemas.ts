/** Schemas de saída compartilhados pelas tools MCP estruturadas. */
import { z, type AnyZodObject } from "zod";
import type {
  CursorList,
  CursorPaging,
  Message,
  OffsetList,
  OffsetMeta,
  PhoneNumber,
  SendResult,
  Template,
} from "@botozap/sdk";

/** UUID interno persistido pelo BotoZap (não é um identificador da Meta). */
export const internalUuidSchema = z
  .string()
  .uuid()
  .describe("UUID interno do recurso no BotoZap.");

/** UUID interno de um Número no BotoZap. */
export const internalPhoneNumberIdSchema = internalUuidSchema.describe(
  "UUID interno do Número no BotoZap; use nas tools get_phone_number e phone_number_health.",
);

/** Identificador do Número atribuído pela Graph API da Meta. */
export const metaPhoneNumberIdSchema = z.string().describe(
  "ID Meta do Número (phone_number_id); use em send_message.from.",
);

export const structuredErrorSchema = z
  .object({
    code: z.string().describe("Código estável do erro da API BotoZap."),
    message: z.string().describe("Mensagem segura e acionável do erro."),
    status: z
      .number()
      .int()
      .nonnegative()
      .describe("Status HTTP; 0 quando não houve resposta HTTP."),
  })
  .strict()
  .describe("Erro estruturado sem credenciais, tokens ou headers de request.");

export type StructuredError = {
  error: z.infer<typeof structuredErrorSchema>;
};

export function structuredError(
  code: string,
  message: string,
  status: number,
): StructuredError {
  return { error: { code, message, status } };
}

/**
 * O SDK MCP 1.29 só anuncia schemas ZodObject na raiz e o Client dessa versão
 * também valida structuredContent presente em resultados isError. Portanto a
 * forma anunciada mantém os campos de sucesso opcionais e acrescenta o erro;
 * o schema forte de sucesso continua sendo validado pelo register antes da
 * resposta. Isso evita ZodUnion/ZodEffects na raiz (que virariam schema vazio).
 */
export function compatibleOutputSchema(successSchema: AnyZodObject): AnyZodObject {
  return successSchema.partial().extend({
    error: structuredErrorSchema.optional(),
  });
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const cursorPagingSchema = z
  .object({
    cursors: z.object({
      before: z.string().nullable(),
      after: z.string().nullable(),
    }),
    next: z.string().nullable(),
    previous: z.string().nullable(),
  })
  .strict() satisfies z.ZodType<CursorPaging>;

export const offsetMetaSchema = z
  .object({
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative(),
  })
  .strict() satisfies z.ZodType<OffsetMeta>;

export const sendMessageResultSchema = z
  .object({
    id: internalUuidSchema
      .nullable()
      .describe("UUID interno da Mensagem; null se a persistência best-effort falhou."),
    wamid: z.string().describe("ID da Mensagem atribuído pelo WhatsApp/Meta."),
    to: z.string().describe("Destinatário solicitado pelo cliente."),
    sent_to: z
      .string()
      .optional()
      .describe("Destinatário efetivamente usado após normalização de identidade."),
    status: z.string().describe("Status inicial do envio."),
    sandbox: z.boolean().optional(),
  })
  .passthrough() satisfies z.ZodType<SendResult>;

export const messageSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno da Mensagem no BotoZap."),
    wamid: z.string().nullable().describe("ID da Mensagem na Meta, quando disponível."),
    conversation_id: internalUuidSchema.nullable(),
    phone_number_id: internalPhoneNumberIdSchema,
    contact_id: internalUuidSchema.nullable(),
    direction: z.enum(["inbound", "outbound"]),
    type: z.string().describe("Tipo da Mensagem: text, image, template etc."),
    status: z.string(),
    source: z.string(),
    content: jsonValueSchema,
    context: jsonValueSchema.nullable(),
    error: jsonValueSchema.nullable(),
    has_media: z.boolean(),
    revoked_at: z.string().nullable(),
    event_at: z.string().nullable(),
    wa_timestamp: z.string().nullable(),
    created_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<Message>;

export const listMessagesResultSchema = z
  .object({
    data: z.array(messageSchema),
    paging: cursorPagingSchema,
  })
  .passthrough() satisfies z.ZodType<CursorList<Message>>;

export const getMessageResultSchema = z
  .object({ data: messageSchema })
  .passthrough();

export const phoneNumberSchema = z
  .object({
    id: internalPhoneNumberIdSchema,
    phone_number_id: metaPhoneNumberIdSchema,
    display_phone_number: z.string().nullable(),
    verified_name: z.string().nullable(),
    quality_rating: z.string(),
    type: z.string().nullable(),
    waba_connection_id: internalUuidSchema,
    customer_id: internalUuidSchema.nullable(),
    waba_id: z.string().nullable(),
    connection_status: z.string().nullable(),
    token_status: z.string().nullable(),
    created_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<PhoneNumber>;

export const listPhoneNumbersResultSchema = z
  .object({
    data: z.array(phoneNumberSchema),
    meta: offsetMetaSchema,
  })
  .passthrough() satisfies z.ZodType<OffsetList<PhoneNumber>>;

export const getPhoneNumberResultSchema = z
  .object({ data: phoneNumberSchema })
  .passthrough();

export const phoneNumberHealthSchema = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    error: z.string().optional(),
    checks: z.record(z.string(), z.string()).optional(),
  })
  .passthrough() satisfies z.ZodType<Record<string, unknown>>;

export const phoneNumberHealthResultSchema = z
  .object({ data: phoneNumberHealthSchema })
  .passthrough();

export const templateSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Template no BotoZap."),
    name: z.string(),
    language: z.string(),
    category: z.string().nullable(),
    status: z.string(),
    meta_template_id: z.string().nullable(),
    components: jsonValueSchema.nullable(),
    waba_connection_id: internalUuidSchema,
    created_at: z.string(),
    last_synced_at: z.string().nullable(),
  })
  .passthrough() satisfies z.ZodType<Template>;

export const listTemplatesResultSchema = z
  .object({
    data: z.array(templateSchema),
    meta: offsetMetaSchema,
  })
  .passthrough() satisfies z.ZodType<OffsetList<Template>>;

export const templateResultSchema = z
  .object({ data: templateSchema })
  .passthrough() satisfies z.ZodType<{ data: Template }>;
