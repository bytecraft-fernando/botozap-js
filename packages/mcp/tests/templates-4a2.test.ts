// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { mountTemplate } from '../web/screens/template.js';
import { templateModelSummary } from '../web/screens/template-language.js';
import { completeTemplates, completeTemplateContext, completeTemplateOptions } from '../web/scenarios/template-complete.js';
import { templateStage, templateTool } from '../web/scenarios/template.js';
beforeEach(() => { document.body.replaceChildren(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
async function mount(scenario: string) {
  const bridge = { context: vi.fn(async () => {}), call: vi.fn(async (n:string,a:any) => templateTool(n,a,scenario)) };
  const panel = mountTemplate(document.body, bridge as any, templateStage(scenario));
  await vi.waitFor(() => expect(document.body.dataset.state).toBe('Rascunho'));
  return {panel, bridge};
}
it.each(completeTemplateOptions)('%s: prévia primeiro e campos recolhidos', async scenario => {
  await mount(scenario);
  const editor = document.querySelector('.template-editor')!;
  expect(editor.firstElementChild?.className).toBe('screen-preview');
  expect(document.querySelector<HTMLDetailsElement>('.template-edit')?.open).toBe(false);
  expect([...document.querySelectorAll<HTMLDetailsElement>('.template-advanced')].every(d => !d.open)).toBe(true);
  expect(document.body.textContent).toContain('Peça ajustes na conversa ou edite os campos.');
});
it('contexto legível preserva chaves de staging e protege URL de mídia', () => {
  const t = completeTemplates[6]!;
  const v = {...completeTemplateContext('template-carousel').suggested_values[t.id], card_1_header_media: 'https://example.com/private?secret=abc'};
  const summary = templateModelSummary(t,v,'conversation');
  expect(summary.variables).toContainEqual({key:'card_1_header_media', name:'Imagem do card 2', value:'Arquivo por endereço protegido'});
  expect(JSON.stringify(summary)).not.toContain('secret=abc');
  expect(summary.variables.some(v => v.name === 'Quantidade do card 2')).toBe(true);
  expect(summary.instruction).toContain('stage_review_template');
});
it('staging ajusta nome e imagem no mesmo card, sem envio', async () => {
  const {panel,bridge} = await mount('template-carousel');
  const data = templateStage('template-carousel'); const id = data.preferred_template_id!;
  panel.bootstrap({structuredContent:{...data, suggested_values:{[id]:{body_1:'Mariana',card_1_header_media_id:'456'}},media_metadata:{card_1_header:{filename:'Nova coleção Floresta.jpg'}}}});
  expect(document.querySelector('.template-message')?.textContent).toContain('Mariana');
  expect(document.querySelector('.template-message')?.textContent).toContain('Nova coleção Floresta.jpg');
  expect(bridge.context).toHaveBeenCalledWith(expect.objectContaining({template_id:id,screen:'template'}));
  expect(bridge.call.mock.calls.some(([n]) => n === 'send_message')).toBe(false);
});
it('staging não altera conteúdo após confirmação', async () => {
  const {panel} = await mount('template-carousel');
  document.querySelector<HTMLButtonElement>('.actions button')!.click();
  const data = templateStage('template-carousel');
  panel.bootstrap({structuredContent:{...data,suggested_values:{[data.preferred_template_id!]:{body_1:'Outro'}}}});
  expect(document.querySelector('.template-message')?.textContent).toContain('Marina');
  expect(document.querySelector('.template-message')?.textContent).not.toContain('Outro');
});
it('falta de mídia aponta para campo avançado com linguagem humana', async () => {
  const {panel} = await mount('template-carousel'); const data = templateStage('template-carousel');
  panel.bootstrap({structuredContent:{...data,suggested_values:{[data.preferred_template_id!]:{card_1_header_media_id:''}}}});
  const shortcut = [...document.querySelectorAll<HTMLButtonElement>('.template-missing button')].find(b=>b.textContent==='Falta imagem do card 2')!;
  expect(shortcut).toBeTruthy(); shortcut.click();
  expect(document.querySelector<HTMLDetailsElement>('.template-edit')?.open).toBe(true);
  expect(document.activeElement?.id).toBe('variable-card_1_header_media');
  expect(document.querySelector<HTMLButtonElement>('.actions button')?.disabled).toBe(true);
});
it('autenticação mantém código visível e não exige abrir editor', async () => {
  await mount('template-auth');
  expect(document.querySelector('.template-auth-code input')?.getAttribute('id')).toBe('variable-body_1');
  expect(document.querySelector('.template-auth-code')?.textContent).toContain('sistema do negócio');
  expect(document.querySelector<HTMLElement>('.template-edit')?.hidden).toBe(true);
});

it('abrir prévia não abre formulário nativo nem prepara envio', async () => { const {bridge}=await mount('template-image'); expect(bridge.call.mock.calls.some(([n])=>['review_template_variables','prepare_send_intent','send_message'].includes(n))).toBe(false); });
