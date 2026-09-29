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
import { routeAllowed, type RequestAuthContext } from "./auth-context.js";

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
  /** Remote requests supply isolated credentials and current API authority. */
  resolveRequestAuth?: () => Promise<RequestAuthContext>;
}

/** Instancia o cliente do SDK. `baseUrl` indefinido → default do SDK. */
export function createClient(options: ClientOptions): Client {
  return new BotoZap({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetch: options.resolveRequestAuth ? async (input, init) => {
      const url = new URL(String(input));
      // SDK putArtifact sends only a signed storage URL, never our credential.
      if (init?.method === "PUT" && init.credentials === "omit" &&
          init.redirect === "error" && !new Headers(init.headers).has("Authorization")) {
        return (options.fetch ?? globalThis.fetch)(input, init);
      }
      const auth = await options.resolveRequestAuth!();
      const base = new URL(options.baseUrl ?? DEFAULT_API_URL);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/$/, "") + "/")) {
        throw new BotoZapError("invalid_api_target", "Destino da API inválido.", 403);
      }
      const path = "/v1" + url.pathname.slice(base.pathname.replace(/\/$/, "").length);
      if (!routeAllowed(auth.identity, init?.method ?? "GET", path)) {
        throw new BotoZapError("forbidden_scope", "Esta autorização não permite a operação.", 403);
      }
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${auth.credential}`);
      return (options.fetch ?? globalThis.fetch)(input, { ...init, headers, redirect: "error" });
    } : options.fetch,
  });
}
