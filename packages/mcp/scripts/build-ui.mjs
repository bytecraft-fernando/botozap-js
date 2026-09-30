import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
async function bundle(entry, target, title) {
  const result = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, write: false,
    outfile: 'bundle.js', platform: 'browser', format: 'iife', target: ['es2022'], minify: true, legalComments: 'inline' });
  const js = result.outputFiles.find(file => file.path.endsWith('.js'))?.text ?? '';
  const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><main id="app"></main><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
  const destination = path.join(root, target);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
  console.log(`${target}: ${Buffer.byteLength(html)} bytes`);
}
await bundle('web/main.ts', 'dist/ui/review.html', 'Pendências · BotoZap');
if (process.argv.includes('--demo')) await bundle('web/demo.ts', 'web/.preview/demo.html', 'BotoZap · demonstração local');
