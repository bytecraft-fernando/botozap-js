/**
 * Construção do servidor MCP: cria o `McpServer`, instancia o cliente do SDK
 * e registra todos os grupos de ferramentas. Extraído de `index.ts` para que o
 * smoke test possa montar o servidor sem abrir o transporte stdio.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, DEFAULT_API_URL } from "./client.js";
import { createRegister } from "./register.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerConversationTools } from "./tools/conversations.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerMediaTools } from "./tools/media.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerPhoneNumberTools } from "./tools/phone-numbers.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerMiscTools } from "./tools/misc.js";

export interface BuildServerOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injeta um fetch (testes de integração). Prod → global do SDK. */
  fetch?: typeof fetch;
}

/** Monta um `McpServer` com todas as ferramentas registradas. */
export function buildServer(options: BuildServerOptions): McpServer {
  const server = new McpServer({
    name: "botozap-mcp",
    version: "0.1.0",
  });

  const client = createClient({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  });
  const register = createRegister(server, client);

  registerMessageTools(register);
  registerConversationTools(register);
  registerContactTools(register);
  registerMediaTools(register);
  registerCustomerTools(register);
  registerPhoneNumberTools(register);
  registerTemplateTools(register);
  registerWebhookTools(register);
  registerMiscTools(register);

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
    baseUrl: process.env.BOTOZAP_API_URL?.trim() || DEFAULT_API_URL,
  };
}
