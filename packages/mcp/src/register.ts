import { uiDescription, uiInvocation } from './ui-routing.js';
import { globalToolMetadata } from './resources/global-panel.js';
import { getUiCapability, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { screenMetadata } from "./resources/screen-resource.js";
/**
 * Helper de registro de ferramentas: encapsula o padrão comum de
 *  1. validar args (zod, feito pelo SDK a partir do `inputSchema`),
 *  2. chamar a API via cliente do `@botozap/sdk`,
 *  3. devolver JSON compacto como conteúdo de texto,
 *  4. nas tools migradas, validar a saída forte e devolvê-la também como
 *     `structuredContent`, com `outputSchema` compatível com MCP SDK 1.29,
 *  5. converter `BotoZapError`/exceções em resultado `isError` com mensagem PT-BR.
 */

import { reviewToolMetadata, replyToolMetadata, radarToolMetadata } from "./resources/review-panel.js";
import { requestAuthContext } from "./auth-context.js";
import type { ApiIdentity } from "./server.js";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AnyZodObject, ZodRawShape } from "zod";
import { BotoZapError, type Client } from "./client.js";
import {
  compatibleOutputSchema,
  structuredError,
  type StructuredError,
} from "./schemas.js";
import { getToolPolicy, isToolAllowed } from "./permissions.js";

/** Assinatura do handler de uma ferramenta: recebe o client + args validados. */
export type ToolHandler<Args> = (
  client: Client,
  args: Args,
  identity: ApiIdentity,
) => Promise<unknown>;

const STRUCTURED_RESULT = Symbol("structured-result");

type StructuredToolResult = {
  [STRUCTURED_RESULT]: true;
  textFallback: unknown;
  structuredContent: Record<string, unknown>;
};

/**
 * Mantém o valor textual legado quando a API não tem corpo, mas permite que a
 * tool publique um contrato estruturado explícito para clientes novos.
 */
function structuredToolResult(
  textFallback: unknown,
  structuredContent: Record<string, unknown>,
): StructuredToolResult {
  return { [STRUCTURED_RESULT]: true, textFallback, structuredContent };
}

/** Resultado compatível de uma operação que concluiu sem corpo HTTP. */
export function emptyOperationResult(): StructuredToolResult {
  return structuredToolResult(null, { success: true });
}

export interface Register {
  readonly uiEnabled?: boolean;
  onUiChange?(listener: (enabled: boolean) => void): void;
  (
    name: string,
    description: string,
    inputSchema: ZodRawShape,
    handler: ToolHandler<Record<string, unknown>>,
  ): void;
  (
    name: string,
    description: string,
    inputSchema: ZodRawShape,
    outputSchema: AnyZodObject,
    handler: ToolHandler<Record<string, unknown>>,
  ): void;
}

const API_KEY_PATTERN = /\bbz_(?:live|sandbox)_[A-Za-z0-9._-]+\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bBearer\s+\S+/gi;

function safeMessage(value: unknown, apiKey?: string): string {
  let message = String(value).replace(
    BEARER_PATTERN,
    "Bearer [credencial removida]",
  );
  if (apiKey) message = message.split(apiKey).join("[credencial removida]");
  return message.replace(API_KEY_PATTERN, "[credencial removida]").replace(JWT_PATTERN, "[credencial removida]");
}

function errorResult(err: unknown, apiKey?: string): {
  text: string;
  structured: StructuredError;
} {
  if (err instanceof BotoZapError) {
    const message = safeMessage(err.message, apiKey);
    return {
      text: `Erro [${err.code}]: ${message}${err.outcome ? ` Resultado: ${err.outcome}.` : ""}${err.retry ? ` Retentativa: ${err.retry}.` : ""}`,
      structured: structuredError(err.code, message, err.status, {
        ...(err.outcome ? { outcome: err.outcome } : {}),
        ...(err.retry ? { retry: err.retry } : {}),
      }),
    };
  }

  const message = safeMessage(err instanceof Error ? err.message : err, apiKey);
  return {
    text: `Erro: ${message}`,
    structured: structuredError("tool_error", message, 0),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStructuredToolResult(value: unknown): value is StructuredToolResult {
  return isObject(value) && Reflect.get(value, STRUCTURED_RESULT) === true;
}

/**
 * Fábrica que devolve um `register(...)` ligado a um server + client.
 * `inputSchema` é um *raw shape* zod (objeto de schemas), como o
 * `registerTool` do SDK espera.
 */
export function createRegister(
  server: McpServer,
  client: Client,
  apiKey: string,
  identity: ApiIdentity,
  options: { uiEnabled?: boolean } = {},
) {
  let currentIdentity = identity;
  const accounts = process.env.BOTOZAP_MCP_UI_ACCOUNTS;
  const allowedAccounts = accounts === undefined
    ? null
    : new Set(accounts.split(",").map(id => id.trim()).filter(Boolean));
  const supportsUi = () => { const mimeTypes = getUiCapability(server.server.getClientCapabilities())?.mimeTypes; return Array.isArray(mimeTypes) && mimeTypes.includes(RESOURCE_MIME_TYPE); };
  const uiAllowed = (value: ApiIdentity) => !!options.uiEnabled && supportsUi() && (allowedAccounts === null || allowedAccounts.has(value.account_id));
  const uiTools = new Set(["open_review_panel", "stage_review_reply", "stage_review_template", "review_template_variables", "open_agent_cases", "stage_appointment_booking", "open_live_conversation", "open_botozap"]);
  const listeners: Array<(enabled: boolean) => void> = [];
  const screenMeta = (name: string) => {
    if (name === "open_review_panel") return reviewToolMetadata();
    if (name === "stage_review_reply") return replyToolMetadata();
    if (name === "list_radar") return radarToolMetadata();
    if (name === "stage_review_template") return screenMetadata("template");
    if (name === "open_agent_cases") return screenMetadata("cases");
    if (name === "open_live_conversation") return screenMetadata("live");
    if (name === "open_botozap") return globalToolMetadata();
    if (name === "stage_appointment_booking") return screenMetadata("booking");
    return { ui: { visibility: ["model", "app"] } };
  };
  const metadata = (name: string) => ({...screenMeta(name), ...uiInvocation(name)});
  const tools: Array<{ name: string; description: string; tool: RegisteredTool; policy: ReturnType<typeof getToolPolicy> }> = [];
  const register: Register = function register(
    name: string,
    description: string,
    inputSchema: ZodRawShape,
    outputOrHandler: AnyZodObject | ToolHandler<Record<string, unknown>>,
    maybeHandler?: ToolHandler<Record<string, unknown>>,
  ): void {
    const policy = getToolPolicy(name);

    const outputSchema = maybeHandler ? (outputOrHandler as AnyZodObject) : undefined;
    const handler = maybeHandler ?? (outputOrHandler as ToolHandler<Record<string, unknown>>);
    const tool = server.registerTool(
      name,
      {
        description: uiDescription(name, description, uiAllowed(currentIdentity)),
        ...(name === "open_botozap" ? { title: "Pendências", icons: [{ src: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="M4 4h12v9H9l-5 3V4Z" fill="none" stroke="currentColor" stroke-width="1.33"/></svg>'), mimeType:"image/svg+xml", sizes:["20x20"] }] } : {}),
        inputSchema,
        ...(uiAllowed(currentIdentity) ? { _meta: metadata(name) } : {}),
        annotations: {
          readOnlyHint: policy.readOnlyHint,
          destructiveHint: policy.destructiveHint,
          openWorldHint: policy.openWorldHint,
        },
        ...(outputSchema
          ? { outputSchema: compatibleOutputSchema(outputSchema) }
          : {}),
      },
      async (args): Promise<CallToolResult> => {
        try {
          const authority = requestAuthContext.getStore()?.identity ?? currentIdentity;
          if (!isToolAllowed(policy, authority) || (uiTools.has(name) && !uiAllowed(authority))) {
            throw new BotoZapError("forbidden_scope", "Esta autorização não permite a ferramenta.", 403);
          }
          const handlerResult = await handler(
            client,
            (args ?? {}) as Record<string, unknown>,
            authority,
          );
          const data = isStructuredToolResult(handlerResult)
            ? handlerResult.structuredContent
            : handlerResult;
          const textFallback = isStructuredToolResult(handlerResult)
            ? handlerResult.textFallback
            : handlerResult;
          if (!outputSchema) return {
            content: [{ type: "text", text: JSON.stringify(textFallback) }],
          };

          if (!isObject(data)) {
            throw new Error(
              `Resposta de ${name} viola o output schema: era esperado um objeto.`,
            );
          }
          const parsed = await outputSchema.safeParseAsync(data);
          if (!parsed.success) {
            throw new Error(
              `Resposta de ${name} viola o output schema: ${parsed.error.issues
                .map((issue) => issue.message)
                .join(" ")}`,
            );
          }

          // Publish only the validated projection. Keep the historical null
          // fallback for 204 responses; all other text mirrors structured data.
          return {
            content: [{ type: "text", text: JSON.stringify(
              isStructuredToolResult(handlerResult) ? textFallback : parsed.data,
            ) }],
            structuredContent: parsed.data,
          };
        } catch (err) {
          const result = errorResult(err, requestAuthContext.getStore()?.credential ?? apiKey);
          return {
            content: [{ type: "text", text: result.text }],
            ...(outputSchema ? { structuredContent: result.structured } : {}),
            isError: true,
          };
        }
      },
    );
    tools.push({ name, description, tool, policy });
    if (!isToolAllowed(policy, currentIdentity) || (uiTools.has(name) && !uiAllowed(currentIdentity))) tool.disable();
  };
  Object.defineProperty(register, "uiEnabled", { get: () => uiAllowed(currentIdentity) });
  const previousInitialized = server.server.oninitialized;
  const configured = Object.assign(register, {
    onUiChange(listener: (enabled: boolean) => void) {
      listeners.push(listener);
      listener(uiAllowed(currentIdentity));
    },
    updateIdentity(next: ApiIdentity) {
      currentIdentity = next;
      for (const { name, description, tool, policy } of tools) {
        tool.description = uiDescription(name, description, uiAllowed(next));
        tool._meta = uiAllowed(next) ? metadata(name) : undefined;
        const allowed = isToolAllowed(policy, next) && (!uiTools.has(name) || uiAllowed(next));
        if (tool.enabled !== allowed) allowed ? tool.enable() : tool.disable();
      }
      for (const listener of listeners) listener(uiAllowed(next));
    },
  });
  server.server.oninitialized = () => { previousInitialized?.(); configured.updateIdentity(currentIdentity); };
  return configured;
}
