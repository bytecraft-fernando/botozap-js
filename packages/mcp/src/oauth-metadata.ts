import type { ServerResponse } from "node:http";
import { MCP_TOOL_POLICIES } from "./permissions.js";

export type ProtectedResourceConfig = { resource: string; issuer: string; metadataUrl: string; metadataPath: string };
function canonicalUrl(raw: string, name: string): URL {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} deve ser uma URL HTTPS canônica (HTTP somente em localhost).`);
  }
  return url;
}

/** RFC 9728 resource identifiers come from trusted configuration, never Host. */
export function protectedResourceConfig(resource?: string, issuer?: string): ProtectedResourceConfig | undefined {
  if (!resource && !issuer) return undefined;
  if (!resource || !issuer) throw new Error("Configure OAUTH_RESOURCE_URL e OAUTH_ISSUER_URL juntos.");
  const resourceUrl = canonicalUrl(resource, "OAUTH_RESOURCE_URL");
  const issuerUrl = canonicalUrl(issuer, "OAUTH_ISSUER_URL");
  if (resourceUrl.pathname !== "/mcp") throw new Error("OAUTH_RESOURCE_URL deve identificar o endpoint /mcp.");
  const metadataPath = `/.well-known/oauth-protected-resource${resourceUrl.pathname}`;
  return { resource: resourceUrl.href, issuer: issuerUrl.href.replace(/\/$/, ""), metadataPath, metadataUrl: `${resourceUrl.origin}${metadataPath}` };
}

export function bearerChallenge(response: ServerResponse, config?: ProtectedResourceConfig, invalid = false): void {
  response.setHeader("WWW-Authenticate", config
    ? `Bearer resource_metadata="${config.metadataUrl}"${invalid ? ', error="invalid_token"' : ''}`
    : "Bearer");
}

export function writeProtectedResourceMetadata(response: ServerResponse, config: ProtectedResourceConfig): void {
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" });
  response.end(JSON.stringify({
    resource: config.resource,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [...new Set(Object.values(MCP_TOOL_POLICIES).flatMap((p) => [...p.requiredScopes]))].sort(),
    resource_name: "BotoZap",
  }));
}
