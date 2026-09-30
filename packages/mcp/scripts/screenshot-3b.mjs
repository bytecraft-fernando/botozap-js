import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {writeFile,rename} from 'node:fs/promises';
const dir=new URL('../web/screenshots/',import.meta.url).pathname;
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4174';
const browser=await chromium.launch();const results=[];
try{for(const theme of ['light','dark'])for(const [device,width,height]of [['desktop',1440,1050],['mobile',390,844]])for(const scenario of ['live','global']){
 const recording=theme==='dark'&&device==='desktop';const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',...(recording?{recordVideo:{dir,size:{width,height}}}:{})});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/chat?theme=${theme}&scenario=${scenario}`);await page.locator('html[data-demo-ready=true]').waitFor();const frame=()=>page.frameLocator('iframe').last();
 async function prompt(text){await page.locator('#prompt').fill(text);await page.locator('#composer').evaluate(f=>f.requestSubmit());}
 async function capture(step){
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${scenario}/${step} AA`);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const child of page.frames().slice(1))assert.equal(await child.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(scenario==='global' && step!=='pendencias'){
   const composer=await page.locator('#composer-wrap').boundingBox();const action=await frame().locator('.fullscreen-actions #review').boundingBox();assert.ok(action&&action.y+action.height<=composer.y-4,'global action above composer');
   for(const position of ['top','middle','end']){await frame().locator('#app').evaluate((el,p)=>{el.scrollTop=p==='top'?0:p==='middle'?el.scrollHeight/2:el.scrollHeight},position);await page.waitForTimeout(80);const a=await frame().locator('.fullscreen-actions #review').boundingBox();assert.ok(a&&a.y+a.height<=composer.y-4,'global scrolling action');}
   const tail=await frame().locator('#length').boundingBox();const bar=await frame().locator('.fullscreen-actions').boundingBox();assert.ok(tail&&bar&&tail.y+tail.height<bar.y,'global last content above actions');
  }
  if(scenario==='live'&&step==='fullscreen'){
   const composer=await page.locator('#composer-wrap').boundingBox();const action=await frame().locator('.fullscreen-actions .primary').boundingBox();const tail=await frame().locator('.screen-status').boundingBox();assert.ok(action&&action.y+action.height<=composer.y-4,'live fullscreen primary above composer');assert.ok(tail&&tail.y+tail.height<action.y,'live final status above action');
  }
  const file=`3b-${scenario}-${step}-${device}-${theme}.png`;await page.screenshot({path:dir+file});results.push({file,axeViolations:0,hostOverflow:false,iframeOverflow:false,...(scenario==='global'?{primaryAboveComposer:true,lastContentAboveActions:true}:{})});console.log(file);
 }
 if(scenario==='live'){
  await frame().locator('#card-preview').filter({hasText:'40 lembranças'}).waitFor();await frame().getByRole('button',{name:'Enviar',exact:true}).click();await frame().getByLabel('Conferi o destinatário, o canal e a mensagem.').check();await frame().getByRole('button',{name:'Enviar',exact:true}).click();await frame().locator('#app[data-state=accepted]').waitFor();
  await prompt('Abra o plantão ao vivo');await frame().locator('.live-timeline').waitFor();await capture('enviada');await frame().getByText('Digitando…',{exact:true}).waitFor();await capture('digitando');await frame().getByText('Pode confirmar! Vocês conseguem embalar cada lembrança separadamente?',{exact:true}).waitFor();await capture('resposta');await page.frames().at(-1).evaluate(()=>window.parent.postMessage({jsonrpc:'2.0',id:'live-fullscreen',method:'ui/request-display-mode',params:{mode:'fullscreen'}},location.origin));await frame().locator('.fullscreen-actions').waitFor();await capture('fullscreen');await frame().getByRole('button',{name:'Responder',exact:true}).click();await frame().locator('#card-preview').filter({hasText:'embalar cada lembrança separadamente'}).waitFor();await frame().locator('#incoming-context').filter({hasText:'embalar cada lembrança separadamente'}).waitFor();await capture('novo-rascunho');
 }else{
  await frame().locator('#history .message').last().waitFor();await frame().locator('.fullscreen-actions').waitFor();await capture('conversa');await page.locator('#prompt').evaluate(el=>el.style.height='100px');await page.waitForTimeout(200);await capture('compositor-alto');
  // Real host-context-changed is forwarded by AppBridge through a theme update.
  await page.getByRole('button',{name:'Alternar tema'}).click();await page.waitForTimeout(150);await page.getByRole('button',{name:'Alternar tema'}).click();await page.waitForTimeout(250);await capture('contexto-atualizado');
  await page.locator('#close-fullscreen').click();if(device==='mobile')await page.locator('#mobile-menu').click();await page.locator('#open-botozap').click();await frame().locator('#business').selectOption({index:1});await frame().locator('.radar-item').first().waitFor();await capture('pendencias');
  await page.locator('#close-fullscreen').click();if(device==='mobile')await page.locator('#mobile-menu').click();await page.locator('#demo-deep-link').click();await page.frames().at(-1).evaluate(()=>window.parent.postMessage({jsonrpc:'2.0',id:'global-fullscreen',method:'ui/request-display-mode',params:{mode:'fullscreen'}},location.origin));await frame().locator('#history .message').last().waitFor();await capture('link-atualizado');
 }
 const video=page.video();await page.close();await context.close();if(video)await rename(await video.path(),dir+`3b-roteiro-${scenario}-desktop-dark.webm`);
}
 // Generic host does not expose the OpenAI sidebar or deep link; live remains inline.
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(`${origin}/chat?scenario=global&host=generic`);await page.locator('html[data-demo-ready=true]').waitFor();assert.equal(await page.locator('#open-botozap').isVisible(),false);assert.equal(await page.frameLocator('iframe').locator('#history .message').count(),0);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations,[]);await page.screenshot({path:dir+'3b-global-generico-mobile.png'});results.push({file:'3b-global-generico-mobile.png',axeViolations:0,openAiDeepLinkIgnored:true,openAiSidebarHidden:true});await context.close();
}finally{await browser.close();}
await writeFile(dir+'validation-3b.json',JSON.stringify({screenshots:results.length,results},null,2)+'\n');
