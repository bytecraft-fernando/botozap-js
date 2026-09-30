/** Same policy on every UI resource; redirects are distinct from iframe network access. */
export function uiResourceMetadata(prefersBorder: boolean) {
  return {
    ui: { prefersBorder, csp: { connectDomains: [], resourceDomains: [], frameDomains: [] } },
    'openai/widgetPrefersBorder': prefersBorder,
    'openai/widgetCSP': { connect_domains: [], resource_domains: [], frame_domains: [], redirect_domains: ['https://botozap.com.br'] },
  };
}
