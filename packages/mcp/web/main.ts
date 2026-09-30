import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { mountReview } from './panel.js';
import './review.css';

applyDocumentTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const root = document.getElementById('app') ?? document.body;
const modes: ('inline' | 'fullscreen')[] = root.dataset.initialMode === 'inline' ? ['inline'] : ['inline', 'fullscreen'];
const app = new App({ name: 'BotoZap · Revisão', version: '1.0.0' }, { availableDisplayModes: modes });
const panel = mountReview(root, {
  call: (name, args) => app.callServerTool({ name, arguments: args }),
  context: (value) => app.updateModelContext({ content: [{ type: 'text', text: JSON.stringify(value) }] }),
  async displayMode(mode) {
    if (app.getHostContext()?.availableDisplayModes?.includes(mode)) await app.requestDisplayMode({ mode });
  },
});
function hostContext(context: McpUiHostContext) {
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
