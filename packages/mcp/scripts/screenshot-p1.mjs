import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';
const dir=new URL('../web/screenshots/',import.meta.url).pathname,origin=process.env.UI_ORIGIN??'http://127.0.0.1:4174';
const browser=await chromium.launch(),results=[],prefix=process.env.CAPTURE_PREFIX??'p1';
const screens=(process.env.CAPTURE_SCREENS??'carousel,reply,radar,global,template,cases,booking,live,unlinked,unlinked-panel,alerts').split(',');
try{for(const theme of ['light','dark'])for(const [device,width,height] of [['desktop',1440,1050],['mobile',390,844]])for(const screen of screens){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const scenario={instagram:'instagram',carousel:'normal',reply:'draft',radar:'draft',global:'pilot-global',template:'template-carousel',cases:'cases',booking:'booking',live:'live',unlinked:'pilot-unlinked','unlinked-panel':'pilot-unlinked',alerts:'pilot-alerts',paused:'pilot-alerts',p2:'cases-p2',p3:'cases-p3'}[screen];
 await page.goto(`${origin}/chat?theme=${theme}&scenario=${scenario}`);await page.locator('html[data-demo-ready=true]').waitFor();
 const app=()=>page.frameLocator('iframe').last();
 const prompt=async(text)=>{await page.locator('#prompt').fill(text);await page.locator('#composer').evaluate(f=>f.requestSubmit());};
 if(screen==='radar'||screen==='unlinked-panel'){await prompt('Abra o Radar');await app().locator('#business').selectOption({index:1});await app().locator('.radar-item').first().waitFor();if(screen==='unlinked-panel'){await app().locator('.radar-item').first().click();await app().locator('#pending-detail:not([hidden])').waitFor();}}
 if(screen==='reply'){await prompt('Prepare uma resposta para Marina');await app().locator('#card-preview').filter({hasText:'40 lembranças'}).waitFor();}
 if(screen==='template'){await app().getByRole('button',{name:'Usar template aprovado',exact:true}).click();await app().locator('#app[data-state=Rascunho]').waitFor();}
 if(screen==='live'){await app().getByRole('button',{name:'Enviar',exact:true}).click();await app().locator('#consent').check();await app().getByRole('button',{name:'Enviar',exact:true}).click();await page.waitForTimeout(1000);await prompt('Abra o plantão ao vivo');await app().locator('.live-event').first().waitFor();}
 if(screen==='global'){await app().locator('.radar-item').first().waitFor();assert.equal(await app().locator('#business').inputValue(),'00000000-0000-4000-8000-000000000001','one business auto-selected');}
 if(['alerts','paused','p2','p3'].includes(screen))await app().locator('#app[data-state="Alerta crítico"]').waitFor();
 if(screen==='paused'){await app().locator('.case-choices').getByRole('button',{name:'Marina Oliveira',exact:true}).click();await app().locator('#app[data-state="Agente pausado"]').waitFor();assert.equal(await app().getByRole('button',{name:'Assumir',exact:true}).count(),0);await app().getByRole('button',{name:'Revisar conversa',exact:true}).waitFor();}
 if(screen==='cases')await app().getByRole('button',{name:'Assumir',exact:true}).waitFor();
 if(screen==='booking')await app().getByRole('button',{name:'Marcar',exact:true}).first().waitFor();
 async function mode(value){await page.frames().at(-1).evaluate(value=>window.parent.postMessage({jsonrpc:'2.0',id:'capture-'+value,method:'ui/request-display-mode',params:{mode:value}},location.origin),value);await app().locator(`#app[data-mode=${value}]`).waitFor();await page.waitForTimeout(200);}
 async function capture(value){
  if(screen==='instagram'){const text=await app().locator('main').innerText();assert.ok(text.includes('Instagram'));assert.ok(text.includes('@contato_instagram'));assert.ok(!text.includes('BR.'));assert.equal(await app().locator('#use-template').isVisible(),false);assert.equal(await app().locator('#draft').isDisabled(),false);}
  const hostOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),iframeOverflow=await app().locator('#app').evaluate(root=>root.scrollWidth>root.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1);assert.equal(hostOverflow,false,screen+' host overflow');assert.equal(iframeOverflow,false,screen+' iframe overflow');
  assert.ok((await app().locator('main').innerText()).trim().length>30,screen+' no empty screen');
  if(await app().locator('.inline-heading').isVisible()){assert.ok((await app().locator('#avatar').innerText()).trim());assert.notEqual((await app().locator('#contact-name').innerText()).trim(),'Conversa');assert.ok((await app().locator('#card-preview').innerText()).trim());}
  if(['global','radar'].includes(screen)){assert.equal(await app().locator('.fullscreen-actions').count(),0);assert.equal(await app().locator('.draft-bubble').isVisible(),false);assert.ok(await app().locator('.radar-item').first().isVisible());if(value==='inline')await app().getByRole('button',{name:'Abrir em tela cheia',exact:true}).waitFor();}
  if(screen.startsWith('unlinked')){assert.equal(await app().getByRole('button',{name:'Responder',exact:false}).count(),0);if(screen==='unlinked-panel'){assert.equal(await app().locator('#draft').isVisible(),false);assert.equal(await app().locator('.draft-label').isVisible(),false);assert.equal(await app().locator('.detail .caption').isVisible(),false);}await app().getByRole('link',{name:'Abrir no BotoZap',exact:true}).waitFor();}
  if(value==='inline'){
   assert.ok(await page.locator('iframe').last().evaluate(el=>parseFloat(getComputedStyle(el).borderTopWidth)>0),'host frame has border');
   const double=await app().locator('.panel,.screen-card,.pending-card').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().height&&getComputedStyle(el).display!=='none').some(el=>parseFloat(getComputedStyle(el).borderTopWidth)>0||getComputedStyle(el).boxShadow!=='none'));assert.equal(double,false,screen+' no double border');
   await page.locator('iframe').last().evaluate(el=>el.scrollIntoView({block:'start'}));
  }else{await app().locator('#app').evaluate(el=>el.scrollTop=0);}
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],screen+'/'+value+' axe');assert.deepEqual(errors,[]);
  const file=`${prefix}-${screen}-${value}-${device}-${theme}.png`;await page.screenshot({path:dir+file});results.push({file,axeViolations:0,hostOverflow,iframeOverflow,noEmptyCard:true,...(value==='inline'?{hostBorder:true,noDoubleBorder:true}:{})});console.log(file);
 }
 await page.waitForTimeout(200);assert.equal(await page.locator('iframe').last().evaluate(el=>el.classList.contains('is-fullscreen')),false,screen+' opens inline without an automatic expansion');
 await mode('inline');await capture('inline');await mode('fullscreen');await capture('fullscreen');
 if(['p2','p3'].includes(screen)){
  assert.equal(await app().locator('.case-row').count(),8);assert.ok((await app().locator('main').innerText()).includes('Reconhecido'));assert.ok((await app().locator('main').innerText()).includes('+55 11 98966-9559'));
  if(screen==='p3'){assert.ok((await app().locator('main').innerText()).includes('Nenhum cliente atendido hoje'));assert.ok(!(await app().locator('main').innerText()).includes('authority_claim'));assert.ok(!(await app().locator('main').innerText()).includes('America/Sao_Paulo'));assert.equal(await app().locator('.screen-evidence p').evaluateAll(els=>els.filter(e=>!e.textContent.trim()).length),0);}
  await app().getByRole('button',{name:'Revisar conversa',exact:true}).click();await app().locator('#draft:not([disabled])').waitFor();await app().locator('#history').filter({hasText:'Se eu fechar'}).waitFor();await capture('review');
  await app().getByRole('button',{name:'Retomar IA',exact:true}).click();await app().getByRole('button',{name:'Confirmar retomada',exact:true}).waitFor();await capture('resume-confirm');await app().getByRole('button',{name:'Confirmar retomada',exact:true}).click();await app().getByText('IA retomada.',{exact:false}).waitFor();await capture('resumed');
 }

 if(screen==='global'){await mode('inline');await capture('inline-return');}
 await context.close();
}}finally{await browser.close();}
await writeFile(dir+`validation-${prefix}.json`,JSON.stringify({screenshots:results.length,results},null,2)+'\n');
