import { App } from '@modelcontextprotocol/ext-apps';
import { mountReview } from './panel.js';
import './review.css';

const app = new App({ name: 'BotoZap · Revisão', version: '1.0.0' });
const panel = mountReview(document.getElementById('app') ?? document.body, {
  call: (name, args) => app.callServerTool({ name, arguments: args }),
  context: (value) => app.updateModelContext({ content: [{ type: 'text', text: JSON.stringify(value) }] }),
});
app.ontoolresult = result => panel.bootstrap(result);
app.onhostcontextchanged = context => {
  if (context.theme) document.documentElement.classList.toggle('dark', context.theme === 'dark');
};
void app.connect().then(() => {
  const theme = app.getHostContext()?.theme;
  if (theme) document.documentElement.classList.toggle('dark', theme === 'dark');
}).catch(() => panel.connectionError());
