import { uiContent, uiToolMetadata, type UiView } from './versioned-ui.js';
import { registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Register } from "../register.js";
import { BotoZapError } from "../client.js";
export function registerScreenResource(server: McpServer, register: Register, view: UiView) {
  const content=uiContent(view);
  const resource=registerAppResource(server,`botozap-${view}`,content.uri,{_meta:content._meta},async()=>{
    if(!register.uiEnabled)throw new BotoZapError("ui_not_allowed","UI não habilitada para esta conta.",403);
    return {contents:[content]};
  });
  register.onUiChange?.(enabled => { if (resource.enabled !== enabled) enabled ? resource.enable() : resource.disable(); });
}
export const screenMetadata = (view: UiView) => uiToolMetadata(view);
