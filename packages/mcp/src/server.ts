/**
 * Construção do servidor MCP: cria o `McpServer`, instancia o cliente do SDK
 * e registra todos os grupos de ferramentas. Extraído de `index.ts` para que o
 * smoke test possa montar o servidor sem abrir o transporte stdio.
 */
import { registerReviewPanel } from "./resources/review-panel.js";
import { requestAuthContext, type RequestAuthContext } from "./auth-context.js";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BotoZapError, createClient, DEFAULT_API_URL } from "./client.js";
import { createRegister } from "./register.js";
import { EVENT_RESOURCE_POLICY, isToolAllowed } from "./permissions.js";
import { registerContactConfigurationTools } from "./tools/contact-configuration.js";
import { registerCalendarTools } from "./tools/calendar.js";
import { registerAiTools } from "./tools/ai.js";
import { registerAgendaTools } from "./tools/agenda.js";
import { registerAttendanceTools } from "./tools/attendance.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerConversationTools } from "./tools/conversations.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerMediaTools } from "./tools/media.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerPhoneNumberTools } from "./tools/phone-numbers.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerMiscTools } from "./tools/misc.js";
import { registerUsageTools } from "./tools/usage.js";
import {
  registerEventResources,
  type EventSignalSource,
} from "./resources/events.js";

const { version: VERSION } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

export interface BuildServerOptions {
  apiKey: string;
  /** Opt-in MCP Apps resource and conversation panel. */
  uiEnabled?: boolean;
  baseUrl?: string;
  /** Injeta um fetch (testes de integração). Prod → global do SDK. */
  fetch?: typeof fetch;
  resolveRequestAuth?: () => Promise<RequestAuthContext>;
  /** Intervalo do tail enquanto há assinatura ativa. Padrão: 1,5 s. */
  eventPollIntervalMs?: number;
  /** Máximo de URIs de Eventos assinadas por sessão. */
  maxEventSubscriptions?: number;
  /** Sinal compartilhado usado pelo transporte remoto; o payload vem da API. */
  eventSignal?: EventSignalSource;
}

/** Snapshot from `/me`; pass only between internal HTTP bootstrap helpers. */
export type ApiIdentity = {
  account_id: string; environment: "live" | "sandbox"; scopes: string[];
  auth_type?: "api_key" | "oauth";
  user_id?: string; client_id?: string; grant_id?: string; allowed_routes?: string[];
};
const permissionRefreshers = new WeakMap<McpServer, (identity: ApiIdentity) => void>();
export function refreshServerIdentity(server: McpServer, identity: ApiIdentity): void {
  permissionRefreshers.get(server)?.(identity);
}

export class IntrospectionError extends Error {
  constructor(readonly httpStatus: number, readonly code: string) {
    super("A introspecção da chave BotoZap falhou.");
    this.name = "IntrospectionError";
  }
}

export function parseIdentity(value: unknown): ApiIdentity {
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    typeof (value as ApiIdentity).account_id !== "string" ||
    !(value as ApiIdentity).account_id ||
    ((value as ApiIdentity).environment !== "live" &&
      (value as ApiIdentity).environment !== "sandbox") ||
    !Array.isArray((value as ApiIdentity).scopes) ||
    (value as ApiIdentity).scopes.some((scope) => typeof scope !== "string")
  ) throw new IntrospectionError(502, "invalid_identity_response");
  const identity = value as ApiIdentity;
  if (identity.auth_type !== undefined && identity.auth_type !== "api_key" && identity.auth_type !== "oauth") {
    throw new IntrospectionError(502, "invalid_identity_response");
  }
  if (identity.auth_type === "oauth" && (
    identity.environment !== "live" ||
    [identity.user_id, identity.client_id, identity.grant_id].some((id) => typeof id !== "string" || !id) ||
    !Array.isArray(identity.allowed_routes) ||
    identity.allowed_routes.some((route) => typeof route !== "string" || !/^(GET|POST|PUT|PATCH|DELETE|HEAD) \/v1\/[A-Za-z0-9_/:.-]+$/.test(route))
  )) throw new IntrospectionError(502, "invalid_identity_response");
  return identity;
}

async function introspect(client: ReturnType<typeof createClient>): Promise<ApiIdentity> {
  try {
    return parseIdentity(await client.me.get());
  } catch (error) {
    if (error instanceof IntrospectionError) throw error;
    if (error instanceof BotoZapError) {
      if (error.status === 401) throw new IntrospectionError(401, "invalid_api_key");
      if (error.status === 403) throw new IntrospectionError(403, "api_key_forbidden");
      if (error.status === 429) throw new IntrospectionError(429, "rate_limited");
      throw new IntrospectionError(error.status === 0 || error.status >= 500 ? 503 : 502, "introspection_failed");
    }
    throw new IntrospectionError(503, "introspection_unavailable");
  }
}

export async function getApiIdentity(options: Pick<BuildServerOptions, "apiKey" | "baseUrl" | "fetch">): Promise<ApiIdentity> {
  const client = createClient(options);
  return introspect(client);
}

/** Monta um `McpServer` com todas as ferramentas registradas. */
export async function buildServer(
  options: BuildServerOptions,
  prevalidatedIdentity?: ApiIdentity,
): Promise<McpServer> {
  const client = createClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    resolveRequestAuth: options.resolveRequestAuth,
  });
  // HTTP uses a preflight before reserving a session slot; only internal code
  // passes its result here. Direct consumers always resolve identity themselves.
  const identity = prevalidatedIdentity ? parseIdentity(prevalidatedIdentity) : await introspect(client);
  const canReadEvents = isToolAllowed(EVENT_RESOURCE_POLICY, identity);

  const server = new McpServer(
    {
      name: "botozap-mcp",
      version: VERSION,
    },
    { capabilities: canReadEvents ? { resources: { subscribe: true } } : {} },
  );

  const register = createRegister(server, client, options.apiKey, identity, { uiEnabled: options.uiEnabled });
  permissionRefreshers.set(server, register.updateIdentity);

  registerAttendanceTools(register);
  registerAgendaTools(register);
  registerAiTools(register);
  registerCalendarTools(register);
  registerContactConfigurationTools(register);
  registerMessageTools(register);
  registerConversationTools(register);
  registerContactTools(register);
  registerMediaTools(register);
  registerCustomerTools(register);
  registerPhoneNumberTools(register);
  registerTemplateTools(register);
  registerWebhookTools(register);
  registerMiscTools(register);
  registerUsageTools(register);
  if (options.uiEnabled) registerReviewPanel(server, register);
  const closeEventResources = canReadEvents
    ? registerEventResources(server, client, {
        maxSubscriptions: options.maxEventSubscriptions,
        pollIntervalMs: options.eventPollIntervalMs ?? 1_500,
        eventSignal: options.eventSignal,
      })
    : () => {};
  server.registerTool(
    "get_profile",
    {
      description: "Retorna a identidade da Conta BotoZap autorizada por esta credencial.",
      inputSchema: {},
      outputSchema: z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
        nickname: z.string().optional(),
      }).strict(),
      _meta: { "openai/profile": true },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      try {
        const current = requestAuthContext.getStore()?.identity ?? await introspect(client);
        const profile = {
          id: `botozap:${current.account_id}:${current.environment}`,
          nickname: `Conta BotoZap — ${current.environment === "live" ? "produção" : "sandbox"}`,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(profile) }],
          structuredContent: profile,
        };
      } catch {
        const message = "Não foi possível confirmar o perfil desta chave BotoZap.";
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );
  const previousOnClose = server.server.onclose;
  server.server.onclose = () => {
    closeEventResources();
    previousOnClose?.();
  };

  return server;
}

/**
 * Lê a config do ambiente e valida a presença da chave (falha rápida com
 * mensagem PT-BR clara). Usado pelo bootstrap stdio.
 */
export function configFromEnv(): BuildServerOptions {
  const apiKey = process.env.BOTOZAP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "BOTOZAP_API_KEY não definida. Gere uma chave (bz_live_...) no painel " +
        "do BotoZap em /chaves e exporte-a como variável de ambiente " +
        "BOTOZAP_API_KEY antes de iniciar o servidor MCP.",
    );
  }
  return {
    apiKey,
    uiEnabled: process.env.BOTOZAP_MCP_UI_ENABLED === "true",
    baseUrl: process.env.BOTOZAP_API_URL?.trim() || DEFAULT_API_URL,
  };
}
