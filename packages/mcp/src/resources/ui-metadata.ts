/** Same policy on every UI resource; redirects are distinct from iframe network access. */
export function uiResourceMetadata(prefersBorder: boolean) {
  const configured = process.env.BOTOZAP_MCP_UI_DOMAIN?.trim();
  let domain: string | undefined;
  if (configured) {
    let parsed: URL;
    try { parsed = new URL(configured); } catch { throw new Error("BOTOZAP_MCP_UI_DOMAIN deve ser uma origem HTTPS."); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error("BOTOZAP_MCP_UI_DOMAIN deve ser uma origem HTTPS sem credenciais, caminho ou query.");
    domain = parsed.origin;
  }
  return {
    ui: { ...(domain ? { domain } : {}), prefersBorder, csp: { connectDomains: [], resourceDomains: [], frameDomains: [] } },
    ...(domain ? { 'openai/widgetDomain': domain } : {}),
    'openai/widgetPrefersBorder': prefersBorder,
    'openai/widgetCSP': { connect_domains: [], resource_domains: [], frame_domains: [], redirect_domains: ['https://botozap.com.br'] },
  };
}
