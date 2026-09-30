import { installFullscreenLayout } from './fullscreen-layout.js';
import type { Bridge } from '../panel.js';
import './screens.css';
export type Row = Record<string, any>;
export class ScreenError extends Error { constructor(message: string, readonly outcome?: string, readonly status?: number) { super(message); } }
export async function call(bridge: Bridge, name: string, args: Row) {
  const result = await bridge.call(name, args);
  if (result.isError) { const e = result.structuredContent?.error; throw new ScreenError(e?.message ?? 'Operação não autorizada ou indisponível. Confira seu acesso.', e?.outcome, e?.status); }
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((c: Row) => c.type === 'text')?.text;
  if (!text) throw new ScreenError('Não foi possível confirmar o resultado. Confira o histórico.');
  return JSON.parse(text);
}
export function node(tag: string, text = '', className = '') { const el = document.createElement(tag); el.textContent = text; el.className = className; return el; }
export function shell(root: HTMLElement, eyebrow: string, heading: string) {
  root.replaceChildren(); root.dataset.mode = 'inline'; root.dataset.state='Carregando'; delete root.dataset.focus; root.dataset.screen = eyebrow;
  const main = node('main','','screen-card'); const top = node('div','','screen-top'); const title = node('div'); title.append(node('p',eyebrow,'eyebrow'),node('h1',heading));
  const chip=node('span','Carregando','badge'); chip.setAttribute('role','status'); top.append(title,chip);
  const content=node('div','','screen-content'); const status=node('p','Carregando…','screen-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const actions=node('div','','actions');main.append(top,content,status,actions); root.append(main); installFullscreenLayout(root);
  return { main, content, actions, chip, status, state(state: string, text = '') { root.dataset.state=state;chip.textContent=state;status.textContent=text; }, setMode(mode: string) { root.dataset.mode=mode; }, connectionError() { status.textContent='Não foi possível conectar ao assistente. Reabra a tela.'; } };
}
export function button(text: string, handler: () => unknown, primary = false) { const el=node('button',text,primary?'primary':'') as HTMLButtonElement;el.type='button';el.onclick=handler;return el; }
export function skeleton(target: HTMLElement) { target.replaceChildren(node('div','','skeleton'),node('div','','skeleton'),node('div','','skeleton')); }
export function field(label: string, value: string, id: string) { const wrapper=node('div','','compact-field');const lab=node('label',label);lab.setAttribute('for',id);const input=document.createElement('input'); input.id=id;input.value=value;input.type='text'; input.maxLength=2000;wrapper.append(lab,input);return {wrapper,input}; }
