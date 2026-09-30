import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Bundle only the official token layers: no Tailwind runtime, fonts or CDN assets.
const sdkStyles = path.dirname(fileURLToPath(import.meta.resolve('@openai/apps-sdk-ui/css')));
const uiLicense = await readFile(path.join(sdkStyles, '../../../LICENSE'), 'utf8');
const tokenCss = `/* @openai/apps-sdk-ui 0.2.2\n${uiLicense} */\n` + (await Promise.all(['variables-primitive.css', 'variables-semantic.css', 'variables-components.css'].map(file => readFile(path.join(sdkStyles, file), 'utf8')))).join('\n').replaceAll('@theme static', ':root');
const root = fileURLToPath(new URL('../', import.meta.url));
async function bundle(entry, target, title) {
  const result = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, write: false,
    outfile: 'bundle.js', platform: 'browser', format: 'iife', target: ['es2022'], minify: true, legalComments: 'inline' });
  const js = result.outputFiles.find(file => file.path.endsWith('.js'))?.text ?? '';
  const css = tokenCss + (result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '');
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="app"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
  const destination = path.join(root, target);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
  console.log(`${target}: ${Buffer.byteLength(html)} bytes`);
}
await bundle('web/main.ts', 'dist/ui/review.html', 'Pendências · BotoZap');
if (process.argv.includes('--demo')) await bundle('web/demo.ts', 'web/.preview/demo.html', 'BotoZap · demonstração local');
