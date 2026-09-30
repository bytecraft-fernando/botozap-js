import { readFile } from "node:fs/promises";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { BotoZapError } from "../client.js";
export function registerScreenResource(server: McpServer, register: Register, view: string) {
  const uri = `ui://botozap/${view}/v1.html`;
  const resource = registerAppResource(server, `botozap-${view}`, uri, {}, async () => {
    if (!register.uiEnabled) throw new BotoZapError("ui_not_allowed", "UI não habilitada para esta conta.", 403);
    return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE,
      text: (await readFile(new URL("../ui/review.html", import.meta.url), "utf8")).replace('id="app"', `id="app" data-initial-mode="inline" data-view="${view}"`),
      _meta: { "openai/ui": { availableDisplayModes: ["inline", "fullscreen"], preferredDisplayMode: "inline" }, ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [], frameDomains: [] } } },
    }] };
  });
  register.onUiChange?.(enabled => { if (resource.enabled !== enabled) enabled ? resource.enable() : resource.disable(); });
}
export const screenMetadata = (view: string) => ({ ui: { resourceUri: `ui://botozap/${view}/v1.html`, visibility: ["model", "app"] } });
