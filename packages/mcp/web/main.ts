import { mountLive } from './screens/live.js';
import { mountGlobal } from './screens/global.js';
import { mountTemplate } from './screens/template.js';
import { mountCases } from './screens/cases.js';
import { mountBooking } from './screens/booking.js';
import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { mountCarousel } from './carousel.js';
import { mountReview } from './panel.js';
import './review.css';

applyDocumentTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const root = document.getElementById('app') ?? document.body;
const modes: ('inline' | 'fullscreen' | 'pip')[] = ['inline', 'fullscreen', 'pip'];
const app = new App({ name: 'BotoZap · Revisão', version: '1.0.0' }, { availableDisplayModes: modes });
const bridge = {
  async liveDisplayMode(mode: 'pip'|'inline') {
    if(app.getHostContext()?.availableDisplayModes?.includes(mode)) try{return await app.requestDisplayMode({mode});}catch{}
    return {mode:'inline'};
  },
  template: (value: Record<string, any>) => { panel = mountTemplate(root, bridge, value); void bridge.displayMode('fullscreen').then(result => panel.setMode?.(result.mode)); },
  call: (name: string, args: Record<string, unknown>) => app.callServerTool({ name, arguments: args }),
  context: (value: unknown) => !app.getHostCapabilities()?.updateModelContext ? Promise.resolve({}) : app.updateModelContext({ content: [{ type: 'text', text: JSON.stringify(value) }] }),
  message: (text: string) => !app.getHostCapabilities()?.message ? Promise.reject(new Error('Peça ao assistente uma resposta para esta pendência; este host não oferece mensagens ao modelo.')) : app.sendMessage({ role: 'user', content: [{ type: 'text', text }] }),
  async displayMode(mode: 'inline' | 'fullscreen') {
    if (app.getHostContext()?.availableDisplayModes?.includes(mode)) try { return await app.requestDisplayMode({ mode }); } catch { return { mode: 'inline' }; }
    return { mode: 'inline' };
  },
};
let panel: any = root.dataset.view === 'carousel' ? mountCarousel(root, bridge) : mountReview(root, bridge);
if (root.dataset.view === 'template') panel = mountTemplate(root, bridge);
if (root.dataset.view === 'cases') panel = mountCases(root, bridge);
if (root.dataset.view === 'booking') panel = mountBooking(root, bridge);
if (root.dataset.view === 'live') panel = mountLive(root, bridge);
if (root.dataset.view === 'global') panel = mountGlobal(root, bridge);
app.ontoolinput = params => { if ('input' in panel) panel.input(params.arguments ?? {}); };
function hostContext(context: McpUiHostContext) {
  if (context.displayMode && 'setMode' in panel) panel.setMode(context.displayMode);
  panel.hostContext?.(context);
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  // Host-context notifications contain only changed fields; theme updates retain safe area.
  if (context.safeAreaInsets) document.documentElement.style.setProperty('--host-safe-bottom', `${context.safeAreaInsets.bottom ?? 0}px`);
}
app.ontoolresult = result => panel.bootstrap(result);
app.onhostcontextchanged = hostContext;
app.onteardown = async () => { panel.dispose?.(); return {}; };
void app.connect().then(() => {
  const context = app.getHostContext();
  if (context) hostContext(context);
}).catch(() => panel.connectionError());
