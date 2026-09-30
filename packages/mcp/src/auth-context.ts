import { AsyncLocalStorage } from "node:async_hooks";
import type { ApiIdentity } from "./server.js";

export type RequestAuthContext = { credential: string; identity: ApiIdentity };
export const requestAuthContext = new AsyncLocalStorage<RequestAuthContext>();

/** Scheduled resource polls must resolve the latest credential, not inherit an
 * expired token from the request that established their subscription. */
export function withoutRequestAuth<T>(fn: () => T): T {
  return requestAuthContext.exit(fn);
}

export function sameOAuthBinding(a: ApiIdentity, b: ApiIdentity): boolean {
  return a.auth_type === "oauth" && b.auth_type === "oauth" &&
    a.account_id === b.account_id && a.environment === b.environment &&
    a.user_id === b.user_id && a.client_id === b.client_id && a.grant_id === b.grant_id;
}

export function routeAllowed(identity: ApiIdentity, method: string, path: string): boolean {
  if (identity.auth_type !== "oauth") return true;
  const segments = path.split("/");
  return identity.allowed_routes!.some((route) => {
    const [verb, template] = route.split(" ");
    if (verb !== method.toUpperCase() || !template) return false;
    const expected = template.split("/");
    return segments.length === expected.length && expected.every((segment, i) =>
      segment.startsWith(":") ? Boolean(segments[i]) : segment === segments[i]);
  });
}
