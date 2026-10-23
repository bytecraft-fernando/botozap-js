/** Schemas de saída compartilhados pelas tools MCP estruturadas. */
import { z, type AnyZodObject } from "zod";
import type {
  AccountExport,
  ApiLog,
  Billing,
  Consent,
  ConsentRequestResult,
  ContactConsents,
  TeamEvent,
  BusinessSlot,
  ConnectionBilling,
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
  WebhookChannelHealth,
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
    outcome: z.enum(["rejected", "accepted", "unknown"]).optional(),
    retry: z.enum(["backoff", "after_correction", "reconcile_first", "unknown"]).optional(),
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
  details: Pick<StructuredError["error"], "outcome" | "retry"> = {},
): StructuredError {
  return { error: { code, message, status, ...details } };
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
  .strip() satisfies z.ZodType<CursorPaging>;

export const offsetMetaSchema = z
  .object({
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative(),
  })
  .strip() satisfies z.ZodType<OffsetMeta>;

function itemResultSchemaFor<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z.object({ data: itemSchema }).strip();
}

function cursorListResultSchemaFor<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z
    .object({ data: z.array(itemSchema), paging: cursorPagingSchema })
    .strip();
}

function offsetListResultSchemaFor<Item extends z.ZodTypeAny>(itemSchema: Item) {
  return z
    .object({ data: z.array(itemSchema), meta: offsetMetaSchema })
    .strip();
}

export const sendMessageResultSchema = z
  .object({
    id: internalUuidSchema
      .nullable()
      .describe("UUID interno da Mensagem; null se a persistência best-effort falhou."),
    wamid: z
      .string()
      .nullable()
      .describe("ID da Mensagem atribuído pelo WhatsApp/Meta; null fora do WhatsApp (use external_id)."),
    external_id: z
      .string()
      .nullable()
      .optional()
      .describe("Identificador da Mensagem no canal (o mid no Instagram)."),
    channel: z.string().optional().describe("Canal do envio; ausente no WhatsApp."),
    to: z.string().describe("Destinatário solicitado pelo cliente."),
    sent_to: z
      .string()
      .optional()
      .describe("Destinatário efetivamente usado após normalização de identidade."),
    status: z.string().describe("Status inicial do envio."),
    sandbox: z.boolean().optional(),
    warnings: z.array(z.object({ code: z.string(), message: z.string() }).strip()).optional(),
    type: z.string().optional().describe("WhatsApp: só em reação. Instagram: text, interactive ou o tipo da mídia."),
    reaction: z
      .object({
        message_id: z.string().describe("WhatsApp: UUID interno do alvo. Instagram: mid do alvo."),
        wamid: z.string().optional(),
        emoji: z.string(),
        action: z.enum(["react", "unreact"]),
      })
      .strip()
      .optional()
      .describe("Só em type='reaction': alvo e ação."),
  })
  .strip() satisfies z.ZodType<SendResult>;

/** Public multi-channel identity, additive on older API versions. */
const channelShape = {
  channel: z.string().optional(),
  channel_account: z.object({
    id: internalUuidSchema,
    channel: z.string(),
    display: z.string().nullable(),
  }).strip().nullable().optional(),
};

export const messageSchema = z
  .object({
    ...channelShape,
    external_id: z.string().nullable().optional(),
    id: internalUuidSchema.describe("UUID interno da Mensagem no BotoZap."),
    wamid: z.string().nullable().describe("ID da Mensagem na Meta, quando disponível."),
    conversation_id: internalUuidSchema.nullable(),
    phone_number_id: internalPhoneNumberIdSchema.nullable(),
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
  .strip() satisfies z.ZodType<Omit<Message, "phone_number_id"> & {phone_number_id: string | null}>;

export const listMessagesResultSchema = cursorListResultSchemaFor(messageSchema);

export const getMessageResultSchema = itemResultSchemaFor(messageSchema);

export const instagramConnectionResultSchema = itemResultSchemaFor(z.object({
  status: z.string(), username: z.string().nullable(), subscribed_at: z.string().nullable(),
  token_expires_at: z.string().nullable(), revoked_reason: z.string().nullable(), health: z.string(),
  subscribed_fields: z.array(z.string()),
  diagnostic: z.object({ code: z.string(), message: z.string(), next_step: z.string(), help_url: z.string() }).strip(),
}).strip());
export const messageRuleQrResultSchema = itemResultSchemaFor(z.object({ ref_link: z.string().nullable() }).strip());

export const contactSchema = z
  .object({
    ...channelShape,
    external_id: z.string().optional(),
    ig_follows_business: z.boolean().nullable().optional(),
    ig_followed_by_business: z.boolean().nullable().optional(),
    ig_follower_count: z.number().nullable().optional(),
    ig_verified: z.boolean().nullable().optional(),
    ig_follow_checked_at: z.string().nullable().optional(),
    profile_picture_url: z.string().nullable().optional(),
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
    phone_number_id: internalPhoneNumberIdSchema.nullable(),
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
  .strip() satisfies z.ZodType<Omit<Contact, "phone_number_id"> & {phone_number_id: string | null}>;

export const listContactsResultSchema = cursorListResultSchemaFor(contactSchema);

export const contactResultSchema = itemResultSchemaFor(contactSchema);

const consentChannel = z.enum(["whatsapp", "instagram"]);
const consentPurpose = z.enum(["marketing", "utility"]);

/** Aviso de create_contact sobre um Consentimento inicial que não valeu. */
export const contactWarningSchema = z
  .object({
    code: z
      .string()
      .describe("consent_opted_out (o contato já recusou; o aceite pedido não foi gravado) ou consent_unconfirmed (não deu para confirmar o consentimento vigente)."),
    message: z.string(),
    channel: consentChannel,
    purpose: consentPurpose,
  })
  .strip();

/** Contato recém-criado: o 201 pode trazer `warnings`. Só no catálogo completo. */
export const createdContactResultSchema = itemResultSchemaFor(
  contactSchema.extend({
    warnings: z
      .array(contactWarningSchema)
      .optional()
      .describe("Avisos por canal e finalidade sobre os consentimentos iniciais; ausente quando não há."),
  }),
);

export const consentSchema = z
  .object({
    id: internalUuidSchema,
    channel: consentChannel,
    purpose: consentPurpose,
    state: z.enum(["granted", "revoked"]).describe("granted = aceitou; revoked = recusou."),
    origin: z
      .string()
      .describe("manual, import, api, keyword (Palavra de saída), conversation_button, contact_keyword (Palavra de volta), template_button (botão de saída do template) ou meta_opt_out (recusa informada pela Meta)."),
    recorded_by: z.string().nullable(),
    evidence: z.string(),
    created_at: z.string(),
  })
  .strip() satisfies z.ZodType<Consent>;

export const contactConsentsResultSchema = itemResultSchemaFor(
  z
    .object({
      current: z.array(consentSchema).describe("O registro vigente por canal e finalidade."),
      history: z.array(consentSchema).describe("Todos os registros, do mais novo ao mais antigo."),
    })
    .strip() satisfies z.ZodType<ContactConsents>,
);

export const recordConsentResultSchema = itemResultSchemaFor(consentSchema);

export const consentRequestResultSchema = itemResultSchemaFor(
  z
    .object({
      id: internalUuidSchema.nullable().describe("UUID interno da mensagem; null se a gravação falhou (veja warnings)."),
      wamid: z.string().nullable().describe("ID da mensagem na Meta; null no Instagram."),
      conversation_id: internalUuidSchema,
      contact_id: internalUuidSchema,
      channel: consentChannel.describe("Canal do envio."),
      type: z.literal("interactive"),
      status: z.literal("sent"),
      sent_to: z.string(),
      purposes: z.array(consentPurpose),
      body: z.string().describe("Texto enviado."),
      warnings: z
        .array(z.object({ code: z.string(), message: z.string() }).strip())
        .optional()
        .describe("send_unrecorded = a Meta aceitou e o registro falhou: NÃO reenvie."),
    })
    .strip() satisfies z.ZodType<ConsentRequestResult>,
);

/** Resultado MCP explícito para APIs que concluíram com HTTP 204. */
export const emptyOperationResultSchema = z
  .object({ success: z.literal(true) })
  .strict();

export const conversationSchema = z
  .object({
    ...channelShape,
    closed_at: z.string().nullable().optional(),
    last_message: messageSchema.pick({
      id: true, wamid: true, direction: true, type: true, status: true,
      content: true, event_at: true, wa_timestamp: true, created_at: true,
    }).nullable().optional(),
    id: internalUuidSchema.describe("UUID interno da Conversa no BotoZap."),
    phone_number_id: internalPhoneNumberIdSchema.nullable(),
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
      .strip(),
    agent_paused_at: z.string().nullable().optional(),
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
      .strip()
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
  .strip() satisfies z.ZodType<Omit<Conversation, "phone_number_id"> & {phone_number_id: string | null}>;

export const listConversationsResultSchema =
  cursorListResultSchemaFor(conversationSchema);

export const conversationResultSchema = itemResultSchemaFor(conversationSchema);

export const customerSchema = z
  .object({
    is_self: z.boolean().optional(),
    id: internalUuidSchema.describe("UUID interno do Cliente no BotoZap."),
    name: z.string(),
    external_customer_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strip() satisfies z.ZodType<Customer>;

export const listCustomersResultSchema = offsetListResultSchemaFor(customerSchema);

export const customerResultSchema = itemResultSchemaFor(customerSchema);

/**
 * Cliente no catálogo completo: acrescenta `plan_suspended`. O perfil
 * assistant segue com {@link customerSchema} (ver `catalog-profile.ts`).
 */
export const fullCustomerSchema = customerSchema
  .extend({
    opt_out_keywords: z
      .array(z.string())
      .optional()
      .describe("Palavras de saída: o contato que as manda recusa mensagens. Não há lista padrão; só valem as cadastradas."),
    opt_in_keywords: z
      .array(z.string())
      .optional()
      .describe("Palavras de volta: o contato que as manda volta a aceitar mensagens."),
    opt_out_confirmation: z.string().optional().describe("Texto enviado ao contato que recusa."),
    opt_in_confirmation: z.string().optional().describe("Texto enviado ao contato que volta a aceitar."),
    plan_suspended: z
      .boolean()
      .optional()
      .describe(
        "true = o Cliente passou do teto do plano Free (1 negócio): continua recebendo, mas não conecta canais e o envio responde 402 free_cap. Volta ao assinar ou ao liberar a vaga (apagar o outro Cliente ou desconectar os canais dele).",
      ),
  })
  .strip() satisfies z.ZodType<Customer>;

export const listFullCustomersResultSchema = offsetListResultSchemaFor(fullCustomerSchema);

export const fullCustomerResultSchema = itemResultSchemaFor(fullCustomerSchema);

export const connectionBillingSchema = z
  .object({
    outcome: z
      .enum(["included", "occupies_slot", "creates_slot", "refused"])
      .describe("included = entra no que o plano inclui; occupies_slot = usa um slot vazio; creates_slot = compra um slot de R$ 47/mês; refused = a conexão será recusada."),
    amount_cents: z.number().int().nullable().describe("4700 em creates_slot; null nos demais."),
    reason: z
      .enum(["free_cap", "slot_limit", "billing_customer_required", "capacity_required"])
      .nullable()
      .describe("Só em refused: free_cap = assine o plano; slot_limit = pague uma fatura em aberto; billing_customer_required = fale com o suporte; capacity_required = compre um slot antes."),
    message: z.string().describe("Texto em português para mostrar ao usuário."),
  })
  .strip() satisfies z.ZodType<ConnectionBilling>;

export const setupLinkSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Setup Link no BotoZap."),
    channel: z
      .enum(["whatsapp", "instagram"])
      .describe("Canal que o link conecta (um canal por link)."),
    status: z.enum(["active", "expired", "revoked"]),
    whatsapp_setup_status: z
      .enum(["pending", "in_progress", "completed", "failed"])
      .describe(
        "Andamento da conexão; apesar do nome, vale para os dois canais (no Instagram, completed quando a conta conecta).",
      ),
    url: z
      .string()
      .describe(
        "URL pública com token opaco embutido (/whatsapp/setup/<token> ou /instagram/setup/<token>).",
      ),
    allowed_connection_types: z
      .array(z.enum(["dedicated", "coexistence"]))
      .describe("Modos do WhatsApp; sempre [] em links do Instagram."),
    language: z
      .string()
      .nullable()
      .describe(
        "Legado: null em links novos. A página do link é sempre em português, qualquer que seja o valor.",
      ),
    success_redirect_url: z
      .string()
      .nullable()
      .describe("Destino ao concluir (recebe setup_link_id e status=completed)."),
    failure_redirect_url: z
      .string()
      .nullable()
      .describe(
        "Destino com status=failed (link esgotado) ou status=cancelled (cliente voltou; link segue válido), mais setup_link_id.",
      ),
    theme_config: jsonValueSchema
      .nullable()
      .describe("Reservado: hoje sempre null (a página de conexão não aplica tema)."),
    expires_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    connection_billing: connectionBillingSchema
      .nullable()
      .optional()
      .describe("O que acontece na cobrança quando o Cliente conectar; null quando não deu para conferir agora."),
  })
  .strip() satisfies z.ZodType<SetupLink>;

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
  .strip() satisfies z.ZodType<MediaUploadResult>;

export const mediaUploadResultSchema = itemResultSchemaFor(mediaUploadSchema);

export const apiLogSchema = z
  .object({
    meta_error_code: z.number().nullable().optional(),
    send_outcome: z.string().nullable().optional(),
    phone_number_id: internalUuidSchema.nullable().optional(),
    environment: z.enum(["live", "sandbox"]).nullable().optional(),
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
  .strip() satisfies z.ZodType<ApiLog>;

export const listApiLogsResultSchema = cursorListResultSchemaFor(apiLogSchema);

export const userSchema = z
  .object({
    id: internalUuidSchema,
    user_id: internalUuidSchema,
    email: z.string().nullable(),
    name: z.string().nullable(),
    role: z.enum(["owner", "admin", "member"]),
  })
  .strip() satisfies z.ZodType<User>;

export const listUsersResultSchema = offsetListResultSchemaFor(userSchema);

export const webhookChannelHealthSchema = z
  .object({
    channel_account_id: internalUuidSchema
      .nullable()
      .describe("Conta de canal com falha; null = eventos sem canal."),
    health_status: z.string().describe("degraded | paused (pausa só este canal)."),
    failure_streak: z.number().int().nonnegative(),
    next_attempt_at: z.string().nullable(),
    paused_at: z.string().nullable(),
    last_success_at: z.string().nullable(),
    last_failure_at: z.string().nullable(),
    last_response_code: z.number().int().nullable(),
  })
  .strip() satisfies z.ZodType<WebhookChannelHealth>;

export const webhookSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do Endpoint no BotoZap."),
    customer_id: internalUuidSchema
      .nullable()
      .optional()
      .describe("Cliente cujas entregas o endpoint recebe; null = toda a conta."),
    channel_account_ids: z
      .array(internalUuidSchema)
      .nullable()
      .optional()
      .describe(
        "Canais cujos eventos o endpoint recebe; null = todos. Vazio = canais marcados foram excluídos e o endpoint não recebe eventos.",
      ),
    channels_health: z
      .array(webhookChannelHealthSchema)
      .optional()
      .describe(
        "Saúde por canal, só dos canais com falha (vazio = saudável). health_status/failure_streak do endpoint resumem o pior canal.",
      ),
    url: z.string(),
    events: z.array(z.string()),
    active: z.boolean(),
    has_authorization: z
      .boolean()
      .optional()
      .describe(
        "True quando o endpoint tem header Authorization configurado. O valor nunca é devolvido.",
      ),
    health_status: z.string().optional(),
    failure_streak: z.number().int().nonnegative().optional(),
    verified_at: z.string().nullable().optional(),
    last_success_at: z.string().nullable().optional(),
    last_failure_at: z.string().nullable().optional(),
    last_response_code: z.number().int().nullable().optional(),
    next_attempt_at: z.string().nullable().optional(),
    paused_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strip() satisfies z.ZodType<Webhook>;

export const listWebhooksResultSchema = cursorListResultSchemaFor(webhookSchema);

export const webhookResultSchema = itemResultSchemaFor(webhookSchema);

/** Only creation discloses the signing secret, once, for endpoint setup. */
export const webhookCreationResultSchema = itemResultSchemaFor(webhookSchema.extend({
  secret: z.string().optional().describe("Segredo HMAC devolvido uma única vez na criação."),
}));

export const webhookTestResultSchema = z
  .object({
    data: z.object({
      success: z.boolean(),
      response_code: z.number().int().nullable().optional(),
      health_status: z.string().optional(),
      active: z.boolean().optional(),
    }).strip(),
  })
  .strip();

export const webhookDeliverySchema = z
  .object({
    customer_id: internalUuidSchema.nullable().optional(),
    id: internalUuidSchema,
    endpoint_id: internalUuidSchema,
    channel_account_id: internalUuidSchema.nullable().optional(),
    event_type: z.string(),
    status: z.enum(["pending", "success", "failed", "exhausted", "limited"]),
    response_code: z.number().int().nullable(),
    attempts: z.number().int().nonnegative(),
    last_attempt_at: z.string().nullable(),
    next_retry_at: z.string().nullable(),
    created_at: z.string(),
  })
  .strip() satisfies z.ZodType<WebhookDelivery>;

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
  .strip() satisfies z.ZodType<PhoneNumber>;

export const listPhoneNumbersResultSchema =
  offsetListResultSchemaFor(phoneNumberSchema);

export const getPhoneNumberResultSchema = itemResultSchemaFor(phoneNumberSchema);

/**
 * Número no catálogo completo: acrescenta `plan_suspended`. O perfil assistant
 * segue com {@link phoneNumberSchema} (ver `catalog-profile.ts`).
 */
export const fullPhoneNumberSchema = phoneNumberSchema
  .extend({
    plan_suspended: z
      .boolean()
      .optional()
      .describe(
        "true = o Número (ou o Cliente dele) passou do teto do plano Free (1 número, 1 negócio): continua recebendo, mas o envio responde 402 free_number_cap (ou free_cap, pelo Cliente). Volta ao assinar ou ao desconectar o outro número.",
      ),
  })
  .strip() satisfies z.ZodType<PhoneNumber>;

export const listFullPhoneNumbersResultSchema = offsetListResultSchemaFor(fullPhoneNumberSchema);

export const getFullPhoneNumberResultSchema = itemResultSchemaFor(fullPhoneNumberSchema);

export const phoneNumberHealthSchema = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    error: z.string().optional(),
    checks: z.record(z.string(), z.string()).optional(),
  })
  // Health is an intentionally open diagnostic contract in the SDK.
  .passthrough() satisfies z.ZodType<Record<string, unknown>>;

export const phoneNumberHealthResultSchema = itemResultSchemaFor(
  phoneNumberHealthSchema,
);

export const templateSchema = z
  .object({
    rejection_reason: z.string().nullable().optional(),
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
  .strip() satisfies z.ZodType<Template>;

export const listTemplatesResultSchema = offsetListResultSchemaFor(templateSchema);

export const templateResultSchema = itemResultSchemaFor(templateSchema);

/**
 * Template no catálogo completo: acrescenta `opt_out_buttons`. O perfil
 * assistant segue com {@link templateSchema} (ver `catalog-profile.ts`).
 */
export const fullTemplateSchema = templateSchema
  .extend({
    opt_out_buttons: z
      .array(z.string())
      .optional()
      .describe("Textos dos botões de resposta rápida marcados como de saída: o toque grava a recusa da finalidade do template. [] quando não há."),
  })
  .strip() satisfies z.ZodType<Template>;

export const listFullTemplatesResultSchema = offsetListResultSchemaFor(fullTemplateSchema);

export const fullTemplateResultSchema = itemResultSchemaFor(fullTemplateSchema);

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
    totals: z.array(z.object(metaCostGroupShape).strip()),
    by_day: z.array(z.object({ day: z.string(), ...metaCostGroupShape }).strip()),
    by_category: z.array(
      z
        .object({
          pricing_category: z.string(),
          pricing_type: z.string(),
          ...metaCostGroupShape,
        })
        .strip(),
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
      .strip(),
    sync: z
      .object({
        connections: z.number().int().nonnegative(),
        synced_connections: z.number().int().nonnegative(),
        last_synced_at: z.string().nullable(),
        covered_from: z.string().nullable(),
      })
      .strip(),
  })
  .strip() satisfies z.ZodType<MetaCostReport>;

export const metaCostsResultSchema = itemResultSchemaFor(metaCostReportSchema);

export const businessSlotSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno do slot; use em cancel_business_slot."),
    status: z.enum(["open", "canceled"]),
    customer_id: internalUuidSchema
      .nullable()
      .describe("Cliente que ocupa o slot; null quando o slot está vazio."),
    customer_name: z.string().nullable(),
    amount_cents: z.number().int().describe("Valor mensal em centavos (4700 = R$ 47)."),
    paid: z.boolean().describe("A fatura atual do slot está paga."),
    next_due_date: z.string().describe("Vencimento em aberto (YYYY-MM-DD)."),
    invoice_url: z
      .string()
      .nullable()
      .describe("Link da fatura; null enquanto ainda não está disponível."),
    paused: z
      .boolean()
      .describe("O negócio que ocupa o slot está pausado porque a fatura venceu há mais de 7 dias; pagar libera na hora."),
    created_at: z.string(),
  })
  .strip() satisfies z.ZodType<BusinessSlot>;

export const businessSlotResultSchema = itemResultSchemaFor(businessSlotSchema);

export const billingSchema = z
  .object({
    plan: z
      .enum(["paid", "free", "trial", "courtesy"])
      .describe("paid = plano pago; free; trial = teste grátis; courtesy = conta cortesia, sem cobrança."),
    included_businesses: z
      .number()
      .int()
      .nullable()
      .describe("Negócios incluídos no plano; null = sem limite."),
    legacy_extra_businesses: z
      .number()
      .int()
      .describe("Negócios extras do contrato antigo (não usam slot)."),
    slot_amount_cents: z.number().int().describe("Valor de cada slot em centavos (4700)."),
    can_add_slot: z
      .boolean()
      .describe("Dá para comprar slot (plano pago com cadastro de cobrança)."),
    slots: z.array(businessSlotSchema).describe("Slots ativos, dos mais antigos aos mais novos."),
    guarantee: z
      .object({
        term: z.enum(["monthly", "annual"]).describe("Ciclo da assinatura."),
        amount_cents: z.number().int().describe("Valor devolvido no cancelamento, em centavos."),
        deadline: z.string().describe("Prazo final da garantia (ISO 8601)."),
      })
      .strip()
      .nullable()
      .optional()
      .describe("Garantia de 7 dias: presente enquanto cancelar ainda devolve a primeira mensalidade integral; null quando não há direito."),
  })
  .strip() satisfies z.ZodType<Billing>;

export const billingResultSchema = itemResultSchemaFor(billingSchema);

export const accountExportSchema = z
  .object({
    id: internalUuidSchema,
    status: z.string().describe("pending (na fila), processing, ready (pronto), failed ou expired (passou os 7 dias)."),
    format: z.enum(["json", "csv"]),
    scope: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("account"),
          customer_id: z.null(),
          customer_name: z.null(),
        })
        .strip(),
      z
        .object({
          type: z.literal("customer"),
          customer_id: z.string(),
          customer_name: z.string().nullable(),
        })
        .strip(),
    ]),
    requested_by: z.string(),
    requested_via: z.string().describe("painel ou api."),
    created_at: z.string(),
    finished_at: z.string().nullable(),
    expires_at: z.string().nullable().describe("Quando o arquivo é apagado (7 dias depois de pronto)."),
    size_bytes: z.number().nullable(),
    counts: z.record(z.string(), z.number()).nullable().describe("Registros por tipo; null antes de pronto."),
    error: z.object({ code: z.string(), message: z.string() }).strip().nullable(),
    download: z
      .object({
        url: z.string().describe("Link assinado do zip."),
        expires_in: z.number().describe("Validade do link em segundos (poucos minutos)."),
      })
      .strip()
      .nullable()
      .describe("Só em get_export, com o pedido pronto e dentro do prazo."),
  })
  .strip() satisfies z.ZodType<AccountExport>;

export const exportResultSchema = itemResultSchemaFor(accountExportSchema);

export const listExportsResultSchema = itemResultSchemaFor(z.array(accountExportSchema));

export const teamEventSchema = z
  .object({
    id: internalUuidSchema,
    created_at: z.string(),
    actor: z
      .object({
        type: z.string().describe("user, api_key ou system."),
        user_id: z.string().nullable(),
        api_key_id: z.string().nullable(),
        label: z.string().nullable(),
      })
      .strip(),
    action: z.string().describe("Código da ação, por exemplo export.requested."),
    action_label: z.string(),
    target: z
      .object({
        type: z.string().nullable(),
        type_label: z.string().nullable(),
        id: z.string().nullable(),
        label: z.string().nullable(),
      })
      .strip(),
    before: jsonValueSchema.nullable(),
    after: jsonValueSchema.nullable(),
    ip_address: z.string().nullable(),
  })
  .strip() satisfies z.ZodType<TeamEvent>;

export const listTeamEventsResultSchema = cursorListResultSchemaFor(teamEventSchema);

/** Conta de canal pública (GET /v1/channel_accounts): Número ou Conta do Instagram. */
export const channelAccountSchema = z
  .object({
    id: internalUuidSchema.describe("UUID interno da Conta de canal; serve de `from` no envio."),
    channel: z.string().describe("whatsapp ou instagram."),
    customer_id: internalUuidSchema,
    display: z.string().nullable().describe("Telefone formatado no WhatsApp, @username no Instagram."),
    status: z.string(),
    sandbox: z.boolean(),
    external_id: z.string().describe("Id na Meta: phone_number_id no WhatsApp, id da conta no Instagram."),
    created_at: z.string(),
    updated_at: z.string(),
    whatsapp: z
      .object({
        id: internalUuidSchema.nullable(),
        phone_number_id: z.string(),
        display_phone_number: z.string().nullable(),
        verified_name: z.string().nullable(),
        quality_rating: z.string().nullable(),
        type: z.string().nullable(),
        waba_connection_id: internalUuidSchema.nullable(),
        waba_id: z.string().nullable(),
        connection_status: z.string().nullable(),
        token_status: z.string().nullable(),
      })
      .strip()
      .optional()
      .describe("Detalhes do Número; só em Contas de canal do WhatsApp."),
    instagram: z
      .object({
        instagram_account_id: z.string(),
        username: z.string().nullable(),
        name: z.string().nullable(),
        instagram_connection_id: internalUuidSchema.nullable(),
        connection_status: z.string().nullable(),
        token_status: z
          .string()
          .nullable()
          .describe("ok, expiring, expired, invalid, revoked ou unknown; com expired/invalid/revoked os envios falham até reconectar."),
        token_expires_at: z.string().nullable(),
        token_refreshed_at: z.string().nullable(),
      })
      .strip()
      .optional()
      .describe("Detalhes e saúde do token da conexão; só em Contas de canal do Instagram. Nunca traz o token."),
  })
  .strip();

export const listChannelAccountsResultSchema = offsetListResultSchemaFor(channelAccountSchema);

/** Configuração pública da IA de comentários, sem credenciais ou campos internos. */
export const instagramCommentAiSchema = z.object({
  enabled: z.boolean(),
  agent_id: internalUuidSchema.nullable(),
  daily_limit: z.number().int().min(1).max(200),
  status: z.string(),
  answered_today: z.number().int().nonnegative(),
  reserved_today: z.number().int().nonnegative(),
  timezone: z.string(),
  gate_mode: z.string(),
  readiness: z.array(z.string()),
}).strip();
export const instagramCommentAiResultSchema = itemResultSchemaFor(instagramCommentAiSchema);
export const instagramCommentAiRunSchema = z.object({
  id: internalUuidSchema,
  comment_id: z.string(),
  comment_text: z.string().nullable(),
  author_username: z.string().nullable(),
  media_id: z.string().nullable(),
  execution_id: internalUuidSchema.nullable(),
  status: z.string(),
  action: z.string().nullable(),
  reason: z.string().nullable(),
  reason_message: z.string(),
  reply_text: z.string().nullable(),
  dm_status: z.string(),
  reply_status: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
}).strip();
export const listInstagramCommentAiRunsResultSchema = offsetListResultSchemaFor(instagramCommentAiRunSchema);

/** Regra de comentário do Instagram (GET /v1/channel_accounts/:id/comment-rules). */
export const commentRuleSchema = z
  .object({
    id: internalUuidSchema,
    channel_account_id: internalUuidSchema,
    keyword: z.string().nullable().describe("Palavra-chave; null = qualquer comentário."),
    keywords: z.array(z.string()).optional(),
    excluded_keywords: z.array(z.string()).optional(),
    reply_variations: z.array(z.string()).optional(),
    next_post: z.boolean().optional(),
    live: z.boolean().optional(),
    require_follow: z.boolean().optional(),
    non_follower_text: z.string().nullable().optional(),
    next_post_activated_at: z.string().nullable().optional(),
    dm_text: z.string().describe("Direct enviado a quem comentou."),
    dm_button_title: z.string().nullable().optional(),
    delivery_text: z.string().nullable().optional(),
    delivery_media: z.string().nullable().optional(),
    reply_text: z.string().nullable().describe("Resposta pública ao comentário; null = sem resposta."),
    media_id: z.string().nullable().describe("Id do post; null = todos os posts."),
    is_active: z.boolean().describe("Configuração gravada; o efeito real está em status."),
    status: z.string().describe("active, inactive ou paused_plan (ativa, mas pausada pelo plano)."),
    paused_by_plan: z.boolean(),
    notice: z.string().nullable().describe("Aviso não bloqueante (regra ampla demais)."),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strip();

export const listCommentRulesResultSchema = offsetListResultSchemaFor(commentRuleSchema);

export const commentRuleResultSchema = itemResultSchemaFor(commentRuleSchema);


export const deleteCommentRuleResultSchema = itemResultSchemaFor(z.object({
  id: internalUuidSchema,
  deleted: z.literal(true),
}).strip());

export const instagramMenuItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("postback"), title: z.string(), payload: z.string() }).strict(),
  z.object({ type: z.literal("web_url"), title: z.string(), url: z.string() }).strict(),
]);
export const instagramIceBreakerSchema = z.object({ question: z.string(), payload: z.string() }).strict();

export const messengerProfileResultSchema = itemResultSchemaFor(z.object({
  channel_account_id: internalUuidSchema,
  config: z.object({
    ice_breakers: z.array(instagramIceBreakerSchema),
    persistent_menu: z.array(instagramMenuItemSchema),
  }).strip(),
  revision: z.number().int().nonnegative(),
  sync_status: z.string(),
  synced_at: z.string().nullable(),
  last_error_code: z.number().nullable(),
  updated_at: z.string().nullable(),
}).strip());

export const instagramInteractiveSchema = z.union([
  z.object({ type: z.literal("button"), body: z.object({ text: z.string() }).strict(),
    action: z.object({ buttons: z.array(instagramMenuItemSchema) }).strict() }).strict(),
  z.object({ type: z.literal("generic"), elements: z.array(z.object({
    title: z.string(), subtitle: z.string().optional(), image_url: z.string().optional(),
    default_action: z.object({ type: z.literal("web_url"), url: z.string() }).strict().optional(),
    buttons: z.array(instagramMenuItemSchema).optional(),
  }).strict()) }).strict(),
]);

export const messageRuleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), message: z.union([
    z.object({ type: z.literal("text"), text: z.string(), quick_replies: z.array(z.record(z.unknown())).optional() }).strict(),
    z.object({ type: z.enum(["image", "video", "audio", "document"]), link: z.string(), filename: z.string().optional() }).strict(),
    z.object({ type: z.literal("interactive"), interactive: instagramInteractiveSchema }).strict(),
  ]) }).strict(),
  z.object({ type: z.literal("agent"), agent_id: z.string().uuid().optional(), router_id: z.string().uuid().optional() }).strict(),
  z.object({ type: z.literal("stage"), stage_id: z.string().uuid().nullable() }).strict(),
  z.object({ type: z.literal("tags"), add: z.array(z.string()).optional(), remove: z.array(z.string()).optional() }).strict(),
  z.object({ type: z.literal("assign"), user_id: z.string().uuid() }).strict(),
]);
export const messageRuleTriggerSchema = z.enum(["keyword", "story_reply", "story_mention", "share", "ref", "ad"]);
export const messageRuleSchema = z.object({
  id: internalUuidSchema, account_id: internalUuidSchema, channel_account_id: internalUuidSchema,
  name: z.string(), trigger: messageRuleTriggerSchema, keywords: z.array(z.string()), excluded_keywords: z.array(z.string()),
  story_contains: z.string().nullable(), ref: z.string().nullable(), ad_id: z.string().nullable(),
  ref_link: z.string().nullable().optional(), require_follow: z.boolean().optional(), non_follower_text: z.string().nullable().optional(),
  priority: z.number(), is_active: z.boolean(), actions: z.array(messageRuleActionSchema),
  created_at: z.string(), updated_at: z.string(),
}).strip();
export const messageRuleResultSchema = itemResultSchemaFor(messageRuleSchema);
export const listMessageRulesResultSchema = offsetListResultSchemaFor(messageRuleSchema);
export const deleteMessageRuleResultSchema = deleteCommentRuleResultSchema;
const commentRuleCountersSchema = z.object({
  comments_matched: z.number(), dms_delivered: z.number(), public_replies: z.number(),
  dm_touches: z.number(), conversations_opened: z.number(), touch_rate: z.number().nullable(),
});
export const commentRuleMetricsResultSchema = itemResultSchemaFor(z.object({
  rule_id: internalUuidSchema, channel_account_id: internalUuidSchema, from: z.string(), to: z.string(),
  totals: commentRuleCountersSchema, posts: z.array(commentRuleCountersSchema.extend({ media_id: z.string().nullable(), live: z.boolean().optional() })),
}).strip());
