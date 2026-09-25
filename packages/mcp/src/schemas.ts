/** Schemas de saída compartilhados pelas tools MCP estruturadas. */
import { z, type AnyZodObject } from "zod";
import type {
  ApiLog,
  Contact,
  Conversation,
  CursorPaging,
  Customer,
  Message,
  MediaUploadResult,
  MetaCostReport,
  OffsetMeta,
  PhoneNumber,
  SendResult,
  SetupLink,
  Template,
  User,
  Webhook,
  WebhookDelivery,
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

function itemResultSchemaFor<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z.object({ data: itemSchema }).passthrough();
}

function cursorListResultSchemaFor<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z
    .object({ data: z.array(itemSchema), paging: cursorPagingSchema })
    .passthrough();
}

function offsetListResultSchemaFor<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z
    .object({ data: z.array(itemSchema), meta: offsetMetaSchema })
    .passthrough();
}

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

export const listMessagesResultSchema = cursorListResultSchemaFor(messageSchema);

export const getMessageResultSchema = itemResultSchemaFor(messageSchema);

export const contactSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Contato no BotoZap."),
    wa_id: z.string().describe("Identidade canônica do Contato: telefone ou BSUID."),
    profile_name: z.string().nullable(),
    display_name: z
      .string()
      .nullable()
      .optional()
      .describe("Nome que a empresa dá ao Contato; null quando não definido. Não vem do canal."),
    phone: z.string().nullable(),
    user_id: z.string().nullable(),
    username: z.string().nullable(),
    parent_user_id: z.string().nullable(),
    phone_number_id: internalPhoneNumberIdSchema,
    last_seen_at: z.string().nullable(),
    created_at: z.string(),
    notes: z.string().nullable(),
    metadata: jsonValueSchema.nullable(),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags do contato (servidores com #498 sempre devolvem a lista)."),
    stage: z
      .object({
        id: internalUuidSchema,
        key: z.string(),
        label: z.string(),
      })
      .nullable(),
  })
  .passthrough() satisfies z.ZodType<Contact>;

export const listContactsResultSchema = cursorListResultSchemaFor(contactSchema);

export const contactResultSchema = itemResultSchemaFor(contactSchema);

/** Resultado MCP explícito para APIs que concluíram com HTTP 204. */
export const emptyOperationResultSchema = z
  .object({ success: z.literal(true) })
  .strict();

export const conversationSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno da Conversa no BotoZap."),
    phone_number_id: internalPhoneNumberIdSchema,
    phone_number_meta_id: metaPhoneNumberIdSchema.nullable(),
    display_phone_number: z.string().nullable(),
    contact_id: internalUuidSchema,
    contact: z
      .object({
        name: z.string(),
        phone: z.string().nullable(),
        username: z.string().nullable(),
        wa_id: z
          .string()
          .nullable()
          .optional()
          .describe("Identidade canônica do Contato: telefone ou BSUID."),
      })
      .strict(),
    status: z.enum(["active", "ended"]),
    window_expires_at: z.string().nullable(),
    entry_point: z
      .enum(["ctwa", "organic"])
      .nullable()
      .optional()
      .describe("Origem: ctwa (anúncio Click-to-WhatsApp), organic ou null (desconhecida)."),
    referral: z
      .object({
        source_id: z.string().nullable(),
        source_url: z.string().nullable(),
        headline: z.string().nullable(),
        ctwa_clid: z.string().nullable(),
        received_at: z.string().nullable(),
      })
      .passthrough()
      .nullable()
      .optional()
      .describe("Último clique em anúncio Click-to-WhatsApp; null se a Conversa nunca veio de anúncio."),
    fep_expires_at: z
      .string()
      .nullable()
      .optional()
      .describe("Fim da janela grátis do Free Entry Point informado pela Meta; null fora dela."),
    fep_reply_by: z
      .string()
      .nullable()
      .optional()
      .describe("Estimativa (último clique + 24h) do prazo para responder e abrir a janela grátis."),
    last_message_at: z.string().nullable(),
    last_read_at: z.string().nullable(),
    created_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<Conversation>;

export const listConversationsResultSchema =
  cursorListResultSchemaFor(conversationSchema);

export const conversationResultSchema = itemResultSchemaFor(conversationSchema);

export const customerSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Cliente no BotoZap."),
    name: z.string(),
    external_customer_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<Customer>;

export const listCustomersResultSchema = offsetListResultSchemaFor(customerSchema);

export const customerResultSchema = itemResultSchemaFor(customerSchema);

export const setupLinkSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Setup Link no BotoZap."),
    status: z.enum(["active", "expired", "revoked"]),
    whatsapp_setup_status: z.enum([
      "pending",
      "in_progress",
      "completed",
      "failed",
    ]),
    url: z.string().describe("URL pública com token opaco embutido."),
    allowed_connection_types: z.array(z.enum(["dedicated", "coexistence"])),
    provision_phone_number: z.boolean(),
    language: z.string().nullable(),
    success_redirect_url: z.string().nullable(),
    failure_redirect_url: z.string().nullable(),
    theme_config: jsonValueSchema.nullable(),
    expires_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<SetupLink>;

export const listSetupLinksResultSchema = offsetListResultSchemaFor(setupLinkSchema);

export const setupLinkResultSchema = itemResultSchemaFor(setupLinkSchema);

export const mediaUploadSchema = z
  .object({
    ingest_id: internalUuidSchema,
    target: z
      .object({
        kind: z.string(),
        media_id: z.string().optional(),
        handle: z.string().optional(),
      })
      .passthrough(),
    resource: z
      .object({
        filename: z.string(),
        mime_type: z.string(),
        size_bytes: z.number().int().nonnegative(),
        sha256: z.string(),
        source_url: z.string(),
      })
      .passthrough(),
  })
  .passthrough() satisfies z.ZodType<MediaUploadResult>;

export const mediaUploadResultSchema = itemResultSchemaFor(mediaUploadSchema);

export const apiLogSchema = z
  .object({
    id: internalUuidSchema,
    source: z.string(),
    method: z.string(),
    path: z.string(),
    status_code: z.number().int().nullable(),
    error_code: z.string().nullable(),
    api_key_id: internalUuidSchema.nullable(),
    duration_ms: z.number().int().nonnegative().nullable(),
    created_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<ApiLog>;

export const listApiLogsResultSchema = cursorListResultSchemaFor(apiLogSchema);

export const userSchema = z
  .object({
    id: internalUuidSchema,
    user_id: internalUuidSchema,
    email: z.string().nullable(),
    name: z.string().nullable(),
    role: z.enum(["owner", "admin", "member"]),
  })
  .passthrough() satisfies z.ZodType<User>;

export const listUsersResultSchema = offsetListResultSchemaFor(userSchema);

export const webhookSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Endpoint no BotoZap."),
    customer_id: internalUuidSchema
      .nullable()
      .optional()
      .describe("Cliente cujas entregas o endpoint recebe; null = toda a conta."),
    url: z.string(),
    events: z.array(z.string()),
    active: z.boolean(),
    has_authorization: z
      .boolean()
      .optional()
      .describe(
        "True quando o endpoint tem header Authorization configurado. O valor nunca é devolvido.",
      ),
    secret: z
      .string()
      .optional()
      .describe("Segredo HMAC; presente somente na resposta de criação."),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<Webhook>;

export const listWebhooksResultSchema = cursorListResultSchemaFor(webhookSchema);

export const webhookResultSchema = itemResultSchemaFor(webhookSchema);

export const webhookTestResultSchema = z
  .object({
    data: z.object({ success: z.boolean() }).strict(),
  })
  .passthrough();

export const webhookDeliverySchema = z
  .object({
    id: internalUuidSchema,
    endpoint_id: internalUuidSchema,
    event_type: z.string(),
    status: z.enum(["pending", "success", "failed", "exhausted"]),
    response_code: z.number().int().nullable(),
    attempts: z.number().int().nonnegative(),
    last_attempt_at: z.string().nullable(),
    next_retry_at: z.string().nullable(),
    created_at: z.string(),
  })
  .passthrough() satisfies z.ZodType<WebhookDelivery>;

export const listWebhookDeliveriesResultSchema =
  cursorListResultSchemaFor(webhookDeliverySchema);

export const phoneNumberSchema = z
  .object({
    id: internalPhoneNumberIdSchema,
    phone_number_id: metaPhoneNumberIdSchema,
    display_phone_number: z.string().nullable(),
    verified_name: z.string().nullable(),
    label: z
      .string()
      .nullable()
      .optional()
      .describe("Nome local do Número no BotoZap; null quando não definido."),
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

export const listPhoneNumbersResultSchema =
  offsetListResultSchemaFor(phoneNumberSchema);

export const getPhoneNumberResultSchema = itemResultSchemaFor(phoneNumberSchema);

export const phoneNumberHealthSchema = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    error: z.string().optional(),
    checks: z.record(z.string(), z.string()).optional(),
  })
  .passthrough() satisfies z.ZodType<Record<string, unknown>>;

export const phoneNumberHealthResultSchema = itemResultSchemaFor(
  phoneNumberHealthSchema,
);

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

export const listTemplatesResultSchema = offsetListResultSchemaFor(templateSchema);

export const templateResultSchema = itemResultSchemaFor(templateSchema);

const metaCostGroupShape = {
  currency: z.string().nullable().describe("Moeda da WABA; moedas nunca são somadas nem convertidas."),
  volume: z.number().nonnegative(),
  cost: z
    .number()
    .nullable()
    .describe("Custo aproximado informado pela Meta; null se faltou custo em alguma linha (nunca 0)."),
  estimated_cost: z
    .number()
    .nullable()
    .describe("Custo da Meta + volume × tarifa publicada onde a Meta não informou; null sem tarifa conhecida."),
  cost_source: z.enum(["meta", "estimate", "mixed"]).nullable(),
};

export const metaCostReportSchema = z
  .object({
    customer_id: internalUuidSchema
      .nullable()
      .describe("Cliente do recorte; null quando cobre a Conta inteira."),
    source: z.string(),
    approximate: z.literal(true),
    from: z.string(),
    to: z.string(),
    unavailable: z.boolean(),
    unavailable_reason: z.enum(["not_synced", "cost_not_returned"]).nullable(),
    totals: z.array(z.object(metaCostGroupShape).passthrough()),
    by_day: z.array(z.object({ day: z.string(), ...metaCostGroupShape }).passthrough()),
    by_category: z.array(
      z
        .object({
          pricing_category: z.string(),
          pricing_type: z.string(),
          ...metaCostGroupShape,
        })
        .passthrough(),
    ),
    estimate: z
      .object({
        available: z.boolean(),
        basis: z.string(),
        market: z.string(),
        rates_effective_from: z.string(),
        rates_as_of: z.string(),
        source_url: z.string(),
        excludes: z.array(z.string()),
      })
      .passthrough(),
    sync: z
      .object({
        connections: z.number().int().nonnegative(),
        synced_connections: z.number().int().nonnegative(),
        last_synced_at: z.string().nullable(),
        covered_from: z.string().nullable(),
      })
      .passthrough(),
  })
  .passthrough() satisfies z.ZodType<MetaCostReport>;

export const metaCostsResultSchema = itemResultSchemaFor(metaCostReportSchema);
