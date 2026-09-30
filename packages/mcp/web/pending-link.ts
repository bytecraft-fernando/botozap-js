import type { Bridge } from './panel.js';
import { string } from './ui-helpers.js';
/** Only first-party known screens; tenant access is enforced again by the web app. */
export function pendingUrl(entry: Record<string,any>) {
  const appointment=entry.entity_type==='appointment'||['meeting','appointment','reuniao','agendamento'].includes(string(entry.kind));
  const url=new URL(appointment?'/agenda':'/radar','https://botozap.com.br');
  if(typeof entry.id==='string'&&/^[a-f0-9-]{36}$/i.test(entry.id))url.searchParams.set(appointment?'appointment_id':'item_id',entry.id);
  return url.href;
}
export function externalLink(label: string, href: string, bridge: Bridge) {
  const link=document.createElement('a');link.textContent=label;link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.className='external-action';
  link.onclick=event=>{if(bridge.openExternal){event.preventDefault();void bridge.openExternal!(href).catch(()=>{link.insertAdjacentText('afterend',' Não foi possível abrir. Use o link em uma nova aba.');});}};
  return link;
}
