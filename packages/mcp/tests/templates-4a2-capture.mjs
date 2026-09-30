import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {writeFile,rename,readdir,unlink} from 'node:fs/promises';
const dir = new URL('../web/screenshots/',import.meta.url).pathname;
const browser=await chromium.launch(); const results=[];
try {
for(const theme of ['light','dark'])for(const [device,width,height] of [['desktop',1440,1050],['mobile',390,844]])for(const route of ['template','template-image','template-document','template-video','template-location','template-auth','template-one-tap','template-carousel','template-offer','template-catalog','template-named']) {
 const recording=route==='template-carousel'&&theme==='dark'&&device==='desktop';
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',...(recording?{recordVideo:{dir,size:{width,height}}}:{})});const page=await context.newPage();const failures=[];page.on('pageerror',e=>failures.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')) failures.push('External request');});
 await page.goto(`http://127.0.0.1:4173/chat?theme=${theme}&scenario=${route}`);
 const frame=page.frameLocator('iframe').last(); await frame.getByRole('button',{name:'Usar template aprovado',exact:true}).click(); await frame.locator('#app[data-state=Rascunho]').waitFor();
 async function capture(step){assert.equal(await frame.locator('.template-editor').evaluate(el=>getComputedStyle(el).display),'flex','Preview-first layout must override the old editor grid');await frame.locator('.template-bubble').first().scrollIntoViewIfNeeded();const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze(); assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);assert.deepEqual(failures,[]);assert.equal(await page.frames().at(-1).evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const file=`4a2-${route}-${step}-${device}-${theme}.png`;await page.screenshot({path:dir+file});results.push({file,axeViolations:0});console.log(file);if(recording)await page.waitForTimeout(1300);}
 await capture('previa');
 if(route==='template-carousel') {await page.locator('#prompt').fill('Muda o nome para Mariana e troca a imagem do segundo card pela coleção Floresta');await page.locator('#composer').evaluate(f=>f.requestSubmit());await frame.locator('.template-message').getByText('Mariana, escolhemos duas ideias para suas lembranças.',{exact:true}).waitFor();await frame.getByText('Coleção Floresta · nova imagem.jpg',{exact:false}).waitFor();await capture('conversa');}
 if(route!=='template-auth'&&route!=='template-one-tap') {await frame.locator('.template-edit>summary').click();await capture('campos'); if(['template-carousel','template-image','template-document','template-named'].includes(route)){await frame.locator('.template-advanced>summary').first().click();await frame.locator('.template-advanced[open]').first().scrollIntoViewIfNeeded();const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations,[]);const file=`4a2-${route}-avancado-${device}-${theme}.png`;await page.screenshot({path:dir+file});results.push({file,axeViolations:0});}}
 if(recording){await frame.getByRole('button',{name:'Revisar envio',exact:true}).click();await page.waitForTimeout(1500);await frame.getByRole('button',{name:'Enviar template',exact:true}).click();await frame.locator('#app[data-state=Aceito]').waitFor();await page.waitForTimeout(1800);}
 const video=page.video();await context.close();if(recording)await rename(await video.path(),dir+'roteiro-4a2-template-carousel-conversa-desktop-dark.webm');
}
} finally {await browser.close();for(const file of await readdir(dir))if(/^[a-f0-9]{32}\.webm$/.test(file))await unlink(dir+file);}
await writeFile(dir+'validation-4a2-templates.json',JSON.stringify({screenshots:results.length,results},null,2)+'\n');
