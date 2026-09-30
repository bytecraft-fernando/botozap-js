import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';
const dir=new URL('../web/screenshots/',import.meta.url).pathname;
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4173';const prefix=process.env.CAPTURE_PREFIX??'4a3';
const browser=await chromium.launch();const results=[];
try{for(const theme of ['light','dark'])for(const [device,width,height]of [['desktop',1440,1050],['mobile',390,844]])for(const route of ['template-carousel','conversation','radar','cases','booking']){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});const page=await context.newPage();const failures=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto(`${origin}/chat?theme=${theme}&scenario=${['conversation','radar'].includes(route)?'draft':route}`);await page.locator('html[data-demo-ready=true]').waitFor();
 async function prompt(text){await page.locator('#prompt').fill(text);await page.locator('#composer').evaluate(f=>f.requestSubmit());}
 if(route==='conversation'){await prompt('Prepare uma resposta para Marina');await page.frameLocator('iframe').last().getByRole('button',{name:'Editar',exact:true}).click();}
 if(route==='radar'){await prompt('Abra o Radar');}
 const app=()=>page.frameLocator('iframe').last();
 if(route==='template-carousel')await app().getByRole('button',{name:'Usar template aprovado',exact:true}).click();
 if(route==='radar'){await app().locator('#business').selectOption({index:1});await app().locator('.radar-item').first().waitFor();await page.waitForTimeout(80);assert.equal(await app().locator('.fullscreen-actions').count(),0,'no action footer before selection');await app().locator('#radar-list button').first().click();await app().locator('#draft').fill('Marina, seu orçamento está pronto. Posso enviar os detalhes?');}
 if(['cases','booking'].includes(route)){await page.frames().at(-1).evaluate(()=>window.parent.postMessage({jsonrpc:'2.0',id:'test-fullscreen',method:'ui/request-display-mode',params:{mode:'fullscreen'}},location.origin));}
 await app().locator('#app[data-mode=fullscreen]').waitFor();
 if(route==='booking')await app().getByRole('button',{name:'Marcar',exact:true}).first().click();
 await app().locator('.fullscreen-actions .primary').waitFor();
 async function check(step){
  const composer=await page.locator('#composer-wrap').boundingBox();const frame=await page.locator('iframe').last().boundingBox();
  for(const position of ['top','middle','end']){
   await app().locator('#app').evaluate((root,position)=>{root.scrollTop=position==='top'?0:position==='middle'?root.scrollHeight/2:root.scrollHeight;},position);await page.waitForTimeout(80);
   const action=await app().locator('.fullscreen-actions .primary').boundingBox();assert.ok(action,`${route} primary visible`);assert.ok(action.y>=frame.y,`${route} primary above viewport`);assert.ok(action.y+action.height<=composer.y-4,`${route}/${position} primary under composer`);
  }
  const confirming = ['conversation','radar'].includes(route) && await app().locator('#confirmation').isVisible();
  const last=app().locator(route==='conversation'||route==='radar'?(confirming?'#confirmation .check':'#length'):'.screen-status');
  const tail=await last.boundingBox();const bar=await app().locator('.fullscreen-actions').boundingBox();assert.ok(tail,`${route} final content visible`);assert.ok(tail.y>=frame.y,`${route} final content above viewport`);assert.ok(tail.y+tail.height<=bar.y-4,`${route} final content under action bar`);assert.ok(tail.y+tail.height<=composer.y-4,`${route} final content under composer`);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${route} WCAG AA`);assert.deepEqual(failures,[]);const file=`${prefix}-${route}-${step}-${device}-${theme}.png`;await page.screenshot({path:dir+file});results.push({file,axeViolations:0,primaryAboveComposer:true,lastContentAboveActions:true});console.log(file);
 }
 await check('rodape');
 if(route==='template-carousel'){await app().getByRole('button',{name:'Revisar envio',exact:true}).click();await check('confirmacao');}
 if(route==='conversation'||route==='radar'){await app().getByRole('button',{name:'Revisar envio',exact:true}).click();await app().locator('#confirmation:not([hidden])').waitFor();await check('confirmacao');}
 if(route==='cases'){await app().getByRole('button',{name:'Assumir',exact:true}).click();await check('confirmacao');}
 // Host composer growth is propagated by AppBridge, not inferred from its DOM by the app.
 await page.locator('#prompt').evaluate(el=>el.style.height='100px');await page.waitForTimeout(150);await check('compositor-alto');
 await context.close();
}}finally{await browser.close();}
await writeFile(dir+`validation-${prefix}-fullscreen.json`,JSON.stringify({screenshots:results.length,results},null,2)+'\n');
