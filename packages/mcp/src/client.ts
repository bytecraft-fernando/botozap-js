/**
 * Ponte fina para o SDK oficial `@botozap/sdk`.
 *
 * O servidor MCP NÃO fala HTTP diretamente: cada ferramenta chama um método do
 * `BotoZap` (o cliente do SDK), que cuida de auth (`Authorization: Bearer`),
 * query string, envelope de erro e desempacote de itens. Este módulo só expõe:
 *  - `createClient` — instancia o `BotoZap` a partir de `{ apiKey, baseUrl }`;
 *  - `Client` — o tipo do cliente, usado por `register`/tools;
 *  - `BotoZapError` — re-exportado para o `register` adaptar o `isError`.
 */
import { BotoZap, BotoZapError } from "@botozap/sdk";

export { BotoZapError };

/** Tipo do cliente do SDK usado pelas ferramentas. */
export type Client = BotoZap;

/**
 * Base padrão da API pública. O SDK já usa o mesmo default; mantemos a constante
 * aqui só para a config por ambiente (`BOTOZAP_API_URL`) ser explícita.
 */
export const DEFAULT_API_URL = "https://botozap.com.br/api/v1";

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injeta um fetch (usado pelos testes de integração). Prod → global do SDK. */
  fetch?: typeof fetch;
}

/** Instancia o cliente do SDK. `baseUrl` indefinido → default do SDK. */
export function createClient(options: ClientOptions): Client {
  return new BotoZap({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  });
}
