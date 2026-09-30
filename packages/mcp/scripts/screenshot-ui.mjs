import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, rename, writeFile, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const destination = fileURLToPath(new URL('../web/screenshots/', import.meta.url));
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop',1440,1050],['mobile',390,844]]) {
    const recording = theme === 'dark' && device === 'desktop';
    const context = await browser.newContext({ viewport: { width,height }, timezoneId: 'America/Sao_Paulo', reducedMotion:'reduce', ...(recording ? { recordVideo: { dir: destination, size: { width,height } } } : {}) });
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    let scenario = 'normal';
    async function load(value='normal') { scenario=value; await page.goto(`http://127.0.0.1:4173/chat?theme=${theme}&scenario=${value}`); await page.waitForSelector('html[data-demo-ready=true]'); }
    const latest = () => page.frameLocator('iframe').last();
    async function reply() { await latest().getByRole('button',{name:'Responder'}).first().click(); await latest().locator('#card-preview').filter({hasText:'40 lembranças'}).waitFor(); }
    async function snapshot(step) {
      const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[], `${step} ${theme} ${device} WCAG AA`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Host has no horizontal overflow');
      const frames=page.frames().filter(f=>f!==page.mainFrame());
      for (const frame of frames) {
        const inline = await frame.locator('#app').getAttribute('data-mode');
        if(inline==='inline') { const count=await frame.locator('button').evaluateAll(buttons=>buttons.filter(b=>b.getClientRects().length>0).length); assert.ok(count<=2,`Inline reply has ${count} actions`); }
        assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No iframe horizontal overflow');
      }
      assert.deepEqual(errors,[],'No runtime errors');
      if (['b-resposta','c-curta'].includes(step)) { const action = await latest().locator('#review').boundingBox(); const overlay = await page.locator('#composer-wrap').boundingBox(); assert.ok(action && overlay && action.y + action.height < overlay.y, 'Inline send action stays above composer'); }
      await page.screenshot({path:`${destination}/chat-${step}-${device}-${theme}.png`});
      results.push({step,theme,device,scenario,axeViolations:0});
      console.log(`${step} · ${device} · ${theme}: ok`);
    }
    await load(); await snapshot('a-pendencias'); await reply(); await snapshot('b-resposta');
    await page.getByLabel('Mensagem para o ChatGPT',{exact:true}).fill('deixa mais curto'); await page.getByRole('button',{name:'Enviar mensagem ao ChatGPT',exact:true}).click();
    await latest().locator('#card-preview').filter({hasText:'Posso confirmar o pedido?'}).waitFor(); await snapshot('c-curta');
    await latest().getByRole('button',{name:'Editar',exact:true}).click(); await page.locator('iframe.is-fullscreen').waitFor();
    await latest().locator('#draft-controls').waitFor();
    // Verify a real action's viewport bounds against the actual overlaid composer.
    const offset = await page.locator('iframe.is-fullscreen').boundingBox(); const composer = await page.locator('#composer-wrap').boundingBox();
    const review = await latest().locator('#review').boundingBox();
    assert.ok(offset && composer && review && review.y+review.height<composer.y, 'Composer does not cover review action');
    await snapshot('d-conversa');
    await latest().getByRole('button',{name:'Revisar envio',exact:true}).click(); await snapshot('e-confirmacao');
    await latest().getByLabel('Conferi o destinatário, o canal e a mensagem.').check(); await latest().getByRole('button',{name:'Enviar',exact:true}).click();
    await latest().locator('#app[data-state=accepted]').waitFor(); await snapshot('e-aceito');
    await latest().locator('#app[data-state=delivered]').waitFor(); await snapshot('e-entregue');
    await latest().locator('#app[data-state=read]').waitFor(); await snapshot('e-lido');
    await page.getByLabel('Mensagem para o ChatGPT',{exact:true}).fill('abra o Radar'); await page.getByRole('button',{name:'Enviar mensagem ao ChatGPT',exact:true}).click();
    await latest().getByLabel('Negócio',{exact:true}).selectOption('00000000-0000-4000-8000-000000000001');
    await latest().locator('.radar-item').first().click(); await latest().locator('#history .message').first().waitFor();
    await latest().locator('.workspace').evaluate(element => element.scrollIntoView({ block:'start' }));
    await snapshot('radar');
    if(recording) {
      const video=page.video(); await page.close(); await context.close();
      if(video) await rename(await video.path(),`${destination}/roteiro-chat-desktop-dark.webm`);
      // Alternate states use another context so the clip remains the complete main journey.
      const alternate=await browser.newContext({viewport:{width,height},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
      const alt=await alternate.newPage();
      for(const variant of ['closed','rejected','uncertain','empty','loading','error']) {
        await alt.goto(`http://127.0.0.1:4173/chat?theme=${theme}&scenario=${variant}`);await alt.waitForSelector('html[data-demo-ready=true]');
        const frame=()=>alt.frameLocator('iframe').last();
        if(['closed','rejected','uncertain'].includes(variant)){await frame().getByRole('button',{name:'Responder'}).first().click();await frame().locator('#card-preview').filter({hasText:'40 lembranças'}).waitFor();}
        if(['rejected','uncertain'].includes(variant)){await frame().getByRole('button',{name:'Enviar',exact:true}).click();await frame().getByLabel('Conferi o destinatário, o canal e a mensagem.').check();await frame().getByRole('button',{name:'Enviar',exact:true}).click();await frame().locator(`#app[data-state=${variant}]`).waitFor();}
        const a=await new AxeBuilder({page:alt}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${variant} WCAG AA`);
        await alt.screenshot({path:`${destination}/chat-f-${variant}-${device}-${theme}.png`});results.push({step:`f-${variant}`,theme,device,axeViolations:0});
      }
      await alternate.close();continue;
    }
    for(const variant of ['closed','rejected','uncertain','empty','loading','error']) {
      await load(variant);
      if(['closed','rejected','uncertain'].includes(variant))await reply();
      if(['rejected','uncertain'].includes(variant)){await latest().getByRole('button',{name:'Enviar',exact:true}).click();await latest().getByLabel('Conferi o destinatário, o canal e a mensagem.').check();await latest().getByRole('button',{name:'Enviar',exact:true}).click();await latest().locator(`#app[data-state=${variant}]`).waitFor();}
      await snapshot(`f-${variant}`);
    }
    await context.close();
  }
} finally { await browser.close(); }
for (const file of await readdir(destination)) if (/^[a-f0-9]{32}\.webm$/.test(file)) await unlink(`${destination}/${file}`);
await writeFile(`${destination}/validation.json`,JSON.stringify({scenarios:results.length,results},null,2)+'\n');
console.log(`Screenshots, video and WCAG report: ${destination}`);
