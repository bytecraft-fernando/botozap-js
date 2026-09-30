import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,rename,writeFile,readdir,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('../web/screenshots/',import.meta.url));await mkdir(dir,{recursive:true});
const browser=await chromium.launch();const results=[];
try{
for(const theme of ['light','dark'])for(const [device,width,height]of [['desktop',1440,1050],['mobile',390,844]])for(const route of ['template','cases','booking']){
 const video=theme==='dark'&&device==='desktop';const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Manaus',reducedMotion:'reduce',...(video?{recordVideo:{dir,size:{width,height}}}:{})});let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const frame=()=>page.frameLocator('iframe').last();
 async function load(scenario=route){await page.goto(`http://127.0.0.1:4173/chat?theme=${theme}&scenario=${scenario}`);await page.waitForSelector('html[data-demo-ready=true]');}
 async function capture(step){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${step} WCAG AA`);assert.deepEqual(errors,[],'No runtime errors');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No host overflow');
  const f=page.frames().at(-1);assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No iframe overflow');
  if(await f.locator('.slot-card').count()){for(const card of await f.locator('.slot-card').all())assert.equal(await card.getByRole('button').count(),1);}else if(await f.locator('.screen-card').count())assert.ok(await f.getByRole('button').count()<=2,'At most two app actions');
  await page.screenshot({path:`${dir}/3a-${route}-${step}-${device}-${theme}.png`});results.push({route,step,device,theme,axeViolations:0});console.log(`${route}/${step} ${device} ${theme}: ok`);
 }
 async function template(){await frame().getByRole('button',{name:'Usar template aprovado',exact:true}).click();await frame().locator('#approved-template').waitFor();await frame().locator('.screen-preview').filter({hasText:'Seu orçamento está pronto'}).waitFor();}
 async function templateSend(){await frame().getByRole('button',{name:'Revisar envio',exact:true}).click();await frame().getByRole('button',{name:'Enviar template',exact:true}).click();}
 async function book(){await frame().getByRole('button',{name:'Marcar',exact:true}).first().click();await frame().getByRole('button',{name:'Confirmar',exact:true}).click();}
 await load();
 if(route==='template'){await frame().getByRole('button',{name:'Usar template aprovado',exact:true}).waitFor();await capture('janela-fechada');await template();await capture('previa');await frame().getByRole('button',{name:'Revisar envio',exact:true}).click();await capture('confirmacao');await frame().getByRole('button',{name:'Enviar template',exact:true}).click();await frame().locator('#app[data-state=Aceito]').waitFor();await capture('aceito');}
 if(route==='cases'){await frame().getByRole('button',{name:'Assumir',exact:true}).waitFor();await capture('escalado');await frame().getByRole('button',{name:'Assumir',exact:true}).click();await capture('confirmacao');await frame().getByRole('button',{name:'Confirmar',exact:true}).click();await frame().locator('#app[data-state=Assumido]').waitFor();await capture('assumido');await load();await frame().getByRole('button',{name:'Devolver ao agente',exact:true}).click();await frame().getByRole('button',{name:'Confirmar',exact:true}).click();await frame().locator('#app[data-state=Devolvido]').waitFor();await capture('devolvido');}
 if(route==='booking'){await frame().getByRole('button',{name:'Marcar',exact:true}).first().waitFor();await capture('horarios');await frame().getByRole('button',{name:'Marcar',exact:true}).first().click();await capture('confirmacao');await frame().getByRole('button',{name:'Confirmar',exact:true}).click();await frame().locator('#app[data-state=Marcado]').waitFor();await capture('marcado');}
 if(video){const recorded=page.video();await page.close();await context.close();await rename(await recorded.path(),`${dir}/roteiro-3a-${route}-desktop-dark.webm`);const alternate=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});page=await alternate.newPage();page.on('pageerror',e=>errors.push(e.message));}
 const variants=route==='cases'?['empty','loading','error','permission']:['empty','loading','error','rejected','uncertain'];
 for(const variant of variants){await load(`${route}-${variant}`);if(route==='template'&&variant!=='loading'){await frame().getByRole('button',{name:'Usar template aprovado',exact:true}).click();if(['rejected','uncertain'].includes(variant)){await frame().getByRole('button',{name:'Revisar envio',exact:true}).waitFor();await templateSend();await frame().locator(`#app[data-state=${variant==='rejected'?'Recusado':'Incerto'}]`).waitFor();}}
  if(route==='booking'&&['rejected','uncertain'].includes(variant)){await book();await frame().locator(`#app[data-state=${variant==='rejected'?'Recusado':'Incerto'}]`).waitFor();}
  if(variant==='empty')await frame().getByText(route==='template'?'Nenhum template aprovado com prévia suportada neste número.':route==='cases'?'Nenhum caso precisa de você':'Sem horários livres neste período',{exact:false}).waitFor();
  if(variant==='permission')await frame().getByText('Você pode ler este caso, mas sua autorização não permite assumir ou devolver ao agente.',{exact:true}).waitFor();
  if(variant==='error')await frame().locator('#app[data-state=Erro]').waitFor();
  await capture(variant);
 }
 await page.context().close();
}
}finally{await browser.close();}
for(const file of await readdir(dir))if(/^[a-f0-9]{32}\.webm$/.test(file))await unlink(`${dir}/${file}`);
await writeFile(`${dir}/validation-3a.json`,JSON.stringify({scenarios:results.length,results},null,2)+'\n');
