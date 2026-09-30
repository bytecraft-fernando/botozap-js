/** Pure template rendering and Cloud API parameters, shared by server and UI. */
export type TemplateRow = Record<string, any>;
export function templateFields(template: TemplateRow) {
  const fields: { key: string; section: string; variable: string; index?: number }[] = [];
  for (const c of template.components ?? []) {
    const section = String(c.type).toLowerCase();
    const add = (source: string, part: string, index?: number) => {
      for (const match of source.matchAll(/\{\{(\w+)\}\}/g)) {
        const key = `${part}_${index === undefined ? '' : `${index}_`}${match[1]}`;
        if (!fields.some(f => f.key === key)) fields.push({ key, section: part, variable: match[1]!, index });
      }
    };
    if (section === 'body' || section === 'header') add(c.text ?? '', section);
    if (section === 'buttons') (c.buttons ?? []).forEach((b: TemplateRow, i: number) => add(b.url ?? '', 'button', i));
  }
  return fields;
}
export function supportedTemplate(template: TemplateRow) {
  return template.status === 'APPROVED' && template.category !== 'AUTHENTICATION' && Array.isArray(template.components) && template.components.every((c: TemplateRow) =>
    ['BODY','FOOTER'].includes(c.type) || c.type === 'BUTTONS' && (c.buttons ?? []).every((b: TemplateRow) => ['QUICK_REPLY','URL','PHONE_NUMBER'].includes(b.type)) || c.type === 'HEADER' && c.format === 'TEXT');
}
export function fillTemplate(source: string, values: Record<string,string>, section: string, index?: number) {
  return source.replace(/\{\{(\w+)\}\}/g, (_, key) => values[`${section}_${index === undefined ? '' : `${index}_`}${key}`] || `{{${key}}}`);
}
export function templateParameters(template: TemplateRow, values: Record<string,string>) {
  const fields = templateFields(template);
  if (fields.some(f => !values[f.key]?.trim())) throw new Error('Preencha todas as variáveis do template.');
  const groups = new Map<string, TemplateRow>();
  for (const f of fields) {
    const key = `${f.section}:${f.index ?? ''}`;
    if (!groups.has(key)) groups.set(key, { type: f.section, ...(f.section === 'button' ? { sub_type: 'url', index: String(f.index) } : {}), parameters: [] });
    groups.get(key)!.parameters.push({ type: 'text', text: values[f.key], ...(/^\d+$/.test(f.variable) ? {} : { parameter_name: f.variable }) });
  }
  return [...groups.values()];
}
