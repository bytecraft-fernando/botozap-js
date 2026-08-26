/**
 * Helper de registro de ferramentas: encapsula o padrão comum de
 *  1. validar args (zod, feito pelo SDK a partir do `inputSchema`),
 *  2. chamar a API via cliente do `@botozap/sdk`,
 *  3. devolver o JSON cru como conteúdo de texto (JSON pretty),
 *  4. nas tools migradas, validar a saída forte e devolvê-la também como
 *     `structuredContent`, com `outputSchema` compatível com MCP SDK 1.29,
 *  5. converter `BotoZapError`/exceções em resultado `isError` com mensagem PT-BR.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AnyZodObject, ZodRawShape } from "zod";
import { BotoZapError, type Client } from "./client.js";
import {
  compatibleOutputSchema,
  structuredError,
  type StructuredError,
} from "./schemas.js";

/** Assinatura do handler de uma ferramenta: recebe o client + args validados. */
export type ToolHandler<Args> = (
  client: Client,
  args: Args,
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
const BEARER_PATTERN = /\bBearer\s+\S+/gi;

function safeMessage(value: unknown, apiKey?: string): string {
  let message = String(value);
  if (apiKey) message = message.split(apiKey).join("[credencial removida]");
  return message
    .replace(API_KEY_PATTERN, "[credencial removida]")
    .replace(BEARER_PATTERN, "Bearer [credencial removida]");
}

function errorResult(err: unknown, apiKey?: string): {
  text: string;
  structured: StructuredError;
} {
  if (err instanceof BotoZapError) {
    const message = safeMessage(err.message, apiKey);
    return {
      text: `Erro [${err.code}]: ${message}`,
      structured: structuredError(err.code, message, err.status),
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
  apiKey?: string,
) {
  const register: Register = function register(
    name: string,
    description: string,
    inputSchema: ZodRawShape,
    outputOrHandler: AnyZodObject | ToolHandler<Record<string, unknown>>,
    maybeHandler?: ToolHandler<Record<string, unknown>>,
  ): void {
    const outputSchema = maybeHandler ? (outputOrHandler as AnyZodObject) : undefined;
    const handler = maybeHandler ?? (outputOrHandler as ToolHandler<Record<string, unknown>>);
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        ...(outputSchema
          ? { outputSchema: compatibleOutputSchema(outputSchema) }
          : {}),
      },
      async (args): Promise<CallToolResult> => {
        try {
          const handlerResult = await handler(
            client,
            (args ?? {}) as Record<string, unknown>,
          );
          const data = isStructuredToolResult(handlerResult)
            ? handlerResult.structuredContent
            : handlerResult;
          const textFallback = isStructuredToolResult(handlerResult)
            ? handlerResult.textFallback
            : handlerResult;
          const content = [
            { type: "text" as const, text: JSON.stringify(textFallback, null, 2) },
          ];
          if (!outputSchema) return { content };

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

          return {
            content,
            structuredContent: data,
          };
        } catch (err) {
          const result = errorResult(err, apiKey);
          return {
            content: [{ type: "text", text: result.text }],
            ...(outputSchema ? { structuredContent: result.structured } : {}),
            isError: true,
          };
        }
      },
    );
  };
  return register;
}
