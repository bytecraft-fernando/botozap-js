/**
 * Helper de registro de ferramentas: encapsula o padrão comum de
 *  1. validar args (zod, feito pelo SDK a partir do `inputSchema`),
 *  2. chamar a API via cliente do `@botozap/sdk`,
 *  3. devolver o JSON cru como conteúdo de texto (JSON pretty),
 *  4. converter `BotoZapError`/exceções em resultado `isError` com mensagem PT-BR.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import { BotoZapError, type Client } from "./client.js";

/** Assinatura do handler de uma ferramenta: recebe o client + args validados. */
export type ToolHandler<Args> = (
  client: Client,
  args: Args,
) => Promise<unknown>;

/**
 * Fábrica que devolve um `register(...)` ligado a um server + client.
 * `inputSchema` é um *raw shape* zod (objeto de schemas), como o
 * `registerTool` do SDK espera.
 */
export function createRegister(server: McpServer, client: Client) {
  return function register(
    name: string,
    description: string,
    inputSchema: ZodRawShape,
    handler: ToolHandler<Record<string, unknown>>,
  ): void {
    server.registerTool(
      name,
      { description, inputSchema },
      async (args): Promise<CallToolResult> => {
        try {
          const data = await handler(client, (args ?? {}) as Record<string, unknown>);
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          };
        } catch (err) {
          let message: string;
          if (err instanceof BotoZapError) {
            message = `Erro [${err.code}]: ${err.message}`;
          } else if (err instanceof Error) {
            message = `Erro: ${err.message}`;
          } else {
            message = `Erro: ${String(err)}`;
          }
          return {
            content: [{ type: "text", text: message }],
            isError: true,
          };
        }
      },
    );
  };
}

export type Register = ReturnType<typeof createRegister>;
