export const string = (value: unknown) => typeof value === 'string' ? value : '';
export function initials(name: string) { return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase() || '?'; }
export function maskedPhone(value: string) { const digits = value.replace(/\D/g, ''); return digits ? `+${digits.slice(0,2)} •••• ${digits.slice(-4)}` : 'Número não informado'; }
export function relative(value: unknown) {
  const at = Date.parse(string(value)); if (!Number.isFinite(at)) return '';
  const minutes = Math.max(0, Math.floor((Date.now()-at)/60000));
  return minutes < 1 ? 'agora' : minutes < 60 ? `há ${minutes} min` : minutes < 1440 ? `há ${Math.floor(minutes/60)}h` : `há ${quantity(Math.floor(minutes/1440), 'dia', 'dias')}`;
}
export const bucketLabel = (bucket: unknown) => ({ critical: 'Crítico', at_risk: 'Atenção', scheduled: 'Programado' } as Record<string,string>)[string(bucket)] || 'Acompanhamento';

export function quantity(count: number, singular: string, plural: string) { return `${count} ${count === 1 ? singular : plural}`; }

/** Preserve non-phone identifiers; format Brazilian E.164 without guessing missing digits. */
export function formatPhone(value: unknown): string {
  const raw=string(value).trim(),digits=raw.replace(/\D/g,'');
  if(/^[A-Za-z]{2}\.[A-Za-z0-9]+$/.test(raw)||/^\d{16,32}$/.test(raw))return '';
  if(!/^\+?[\d\s().-]+$/.test(raw))return raw;
  const match=/^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return match?`+55 ${match[1]} ${match[2]}-${match[3]}`:raw;
}

export function contactLabel(contact: Record<string,any>|undefined): string {
  const name=string(contact?.display_name||contact?.profile_name||contact?.name).trim();
  if(name && !/^[A-Za-z]{2}\.[A-Za-z0-9]+$/.test(name) && !/^\d{16,32}$/.test(name))return formatPhone(name);
  const username=string(contact?.username).replace(/^@/,'');
  return username?`@${username}`:formatPhone(contact?.phone)||'Contato';
}
export function channelLabel(conversation: Record<string,any>): string {return conversation.channel==='instagram'?'Instagram':'WhatsApp';}
export function contactAddress(contact: Record<string,any>|undefined): string {const username=string(contact?.username).replace(/^@/,'');const address=username?`@${username}`:formatPhone(contact?.phone);return address===contactLabel(contact)?'':address;}
export function channelOrigin(c: Record<string,any>): string {return string(c.channel_account?.display)||formatPhone(c.display_phone_number)||channelLabel(c);}
