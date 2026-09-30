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
