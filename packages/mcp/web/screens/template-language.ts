import { templateFields, type TemplateField, type TemplateRow } from '../../src/template-preview.js';
/** Human vocabulary shared by the editor and model context; wire keys stay intact. */
export function templateFieldName(t: TemplateRow, f: TemplateField) {
  const components = f.card === undefined ? t.components : t.components.find((c: TemplateRow) => c.type === 'CAROUSEL')?.cards[f.card]?.components;
  const component = components?.find((c: TemplateRow) => c.type.toLowerCase() === f.section);
  const variable = f.variable.toLowerCase();
  if (f.kind === 'otp') return 'Código de autenticação';
  if (f.kind === 'coupon') return 'Código para copiar';
  if (f.kind === 'filename') return 'Nome do documento';
  if (f.kind === 'expiry') return 'Validade da oferta';
  if (f.kind === 'media' || f.kind === 'media_id') return ({ IMAGE: 'Imagem', VIDEO: 'Vídeo', DOCUMENT: 'Documento' } as Record<string,string>)[component?.format] ?? 'Arquivo';
  if (f.kind === 'payload') return 'Resposta do cliente';
  if (f.section === 'button') return f.kind === 'json' ? 'Produtos do catálogo' : 'Destino do botão';
  if (['latitude','longitude'].includes(f.kind)) return f.kind === 'latitude' ? 'Latitude do local' : 'Longitude do local';
  if (variable === 'name') return f.section === 'header' ? 'Nome do lugar' : 'Nome do cliente';
  if (variable === 'address') return 'Endereço';
  if (['nome','customer_name'].includes(variable) || variable === '1' && f.card === undefined) return 'Nome do cliente';
  if (variable === 'cupom') return 'Código da oferta';
  if (f.card !== undefined && variable === '1') return 'Quantidade';
  if (variable === '2' && /orçamento|pedido/i.test(component?.text ?? '')) return 'Pedido';
  return /^\d+$/.test(variable) ? `Texto ${variable}` : variable.replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
}
export const technicalTemplateField = (f: TemplateField) => ['media','media_id','latitude','longitude','json','payload'].includes(f.kind) || f.section === 'button' && f.kind === 'text';
export function templateModelSummary(t: TemplateRow, values: Record<string,string>, conversationId: string, metadata: TemplateRow = {}) {
  return { screen: 'template', conversation_id: conversationId, template_id: t.id, template_name: t.name,
    instruction: 'Peça ajustes na conversa ou edite os campos. Aplique alterações com stage_review_template, conversation_id, template_id e suggested_values por template. Não envie sem confirmação. Preserve os demais valores.',
    variables: templateFields(t).map(f => ({ key: f.key, name: `${templateFieldName(t,f)}${f.card === undefined ? '' : ` do card ${f.card+1}`}`, value: f.kind === 'media' ? (values[f.key] ? 'Arquivo por endereço protegido' : '') : values[f.key] ?? '' })),
    suggested_values: { [t.id]: Object.fromEntries(Object.entries(values).filter(([k]) => !k.endsWith('_media'))) }, media_metadata: metadata };
}
