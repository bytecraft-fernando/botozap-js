import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const build = spawnSync(process.execPath, [new URL('./build-ui.mjs', import.meta.url).pathname, '--demo'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4173');
  const isApp = url.pathname === '/app';
  const host = await readFile(new URL('../web/.preview/demo.html', import.meta.url));
  const app = await readFile(new URL('../dist/ui/review.html', import.meta.url), 'utf8');
  const html = isApp ? app.replace('id="app"', `id="app" data-initial-mode="inline" data-view="${['carousel','template','cases','booking'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'review'}"`) : host;
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(html);
});
server.listen(4173, '127.0.0.1', () => console.log('Simulador ChatGPT: http://127.0.0.1:4173/chat'));
