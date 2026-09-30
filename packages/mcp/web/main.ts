import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { mountCarousel } from './carousel.js';
import { mountReview } from './panel.js';
import './review.css';

applyDocumentTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const root = document.getElementById('app') ?? document.body;
const modes: ('inline' | 'fullscreen')[] = ['inline', 'fullscreen'];
const app = new App({ name: 'BotoZap · Revisão', version: '1.0.0' }, { availableDisplayModes: modes });
const bridge = {
  call: (name: string, args: Record<string, unknown>) => app.callServerTool({ name, arguments: args }),
  context: (value: unknown) => app.updateModelContext({ content: [{ type: 'text', text: JSON.stringify(value) }] }),
  message: (text: string) => app.sendMessage({ role: 'user', content: [{ type: 'text', text }] }),
  async displayMode(mode: 'inline' | 'fullscreen') {
    if (app.getHostContext()?.availableDisplayModes?.includes(mode)) return app.requestDisplayMode({ mode });
    return { mode: 'inline' };
  },
};
const panel = root.dataset.view === 'carousel' ? mountCarousel(root, bridge) : mountReview(root, bridge);
app.ontoolinput = params => { if ('input' in panel) panel.input(params.arguments ?? {}); };
function hostContext(context: McpUiHostContext) {
  if (context.displayMode && 'setMode' in panel) panel.setMode(context.displayMode === 'fullscreen' ? 'fullscreen' : 'inline');
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  document.documentElement.style.setProperty('--host-safe-bottom', `${context.safeAreaInsets?.bottom ?? 0}px`);
}
app.ontoolresult = result => panel.bootstrap(result);
app.onhostcontextchanged = hostContext;
void app.connect().then(() => {
  const context = app.getHostContext();
  if (context) hostContext(context);
}).catch(() => panel.connectionError());
