import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const build = spawnSync(process.execPath, [new URL('./build-ui.mjs', import.meta.url).pathname, '--demo'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const html = await readFile(new URL('../web/.preview/demo.html', import.meta.url));
const server = createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(html); });
server.listen(4173, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4173/?mode=inline&state=draft&theme=light'));
