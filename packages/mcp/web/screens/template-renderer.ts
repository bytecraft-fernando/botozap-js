import { fillTemplate, isAuthentication, isOtp, templateUnsupportedReason, type TemplateRow } from '../../src/template-preview.js';
import { node } from './screen-kit.js';
const type = (v: unknown) => String(v ?? '').toUpperCase();
function media(format: string, values: Record<string, string>, p: string, metadata: TemplateRow = {}) {
    const label = ({ IMAGE: 'Imagem', VIDEO: 'Vídeo', DOCUMENT: 'Documento' } as Record<string, string>)[format] ?? 'Arquivo';
    const slot = node('div', '', 'template-media');
    slot.setAttribute('role', 'img');
    const providedName = String(values[p + 'header_filename'] || metadata.filename || metadata.name || '');
    const name = /https?:\/\//i.test(providedName) ? '' : providedName;
    const bytes = Number(metadata.file_size ?? metadata.size);
    const size = Number.isFinite(bytes) && bytes > 0 ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : '';
    slot.setAttribute('aria-label', [label, name, size, 'Prévia sem carregar arquivo'].filter(Boolean).join(' · '));
    slot.append(node('span', format === 'VIDEO' ? '▷' : format === 'DOCUMENT' ? '▤' : '▧', 'media-symbol'), node('strong', label), node('span', [name, size].filter(Boolean).join(' · ') || 'Arquivo do cabeçalho', 'muted'), node('small', values[p + 'header_media_id'] ? 'media_id selecionado' : values[p + 'header_media'] ? 'URL protegida · arquivo não carregado' : 'Escolha URL pública ou media_id', 'muted'));
    return slot;
}
/** Semantic local preview. No img/src, anchors, video/source or external URL. */
export function renderTemplatePreview(template: TemplateRow, values: Record<string, string>, metadata: Record<string, TemplateRow> = {}) {
    const outer = node('div', '', 'template-message');
    const reason = templateUnsupportedReason(template);
    if (reason) { outer.append(node('p', reason)); return outer; }
    function bubble(components: TemplateRow[], card?: number) {
        const p = card === undefined ? '' : `card_${card}_`;
        const item = node('article', '', 'template-bubble');
        for (const c of components) {
            const kind = type(c.type);
            if (kind === 'HEADER') {
                const format = type(c.format);
                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format))
                    item.append(media(format, values, p, metadata[p + 'header']));
                else if (format === 'LOCATION') {
                    const location = node('div', '', 'template-location');
                    location.setAttribute('role', 'img');
                    location.setAttribute('aria-label', 'Localização · mapa não carregado');
                    location.append(node('span', '⌖', 'media-symbol'), node('strong', values[p + 'header_name'] || 'Localização'), node('p', values[p + 'header_address'] || `${values[p + 'header_latitude'] || 'Latitude'}, ${values[p + 'header_longitude'] || 'longitude'}`));
                    item.append(location);
                }
                else if (c.text)
                    item.append(node('h2', fillTemplate(c.text, values, 'header', undefined, card)));
            }
            else if (kind === 'BODY') {
                item.append(node('p', c.text ? fillTemplate(c.text, values, 'body', undefined, card) : isAuthentication(template) ? `${values.body_1 || '••••••'} é seu código de verificação.${c.add_security_recommendation ? ' Para sua segurança, não compartilhe este código.' : ''}` : ''));
            }
            else if (kind === 'FOOTER')
                item.append(node('p', c.text || (c.code_expiration_minutes ? `Este código expira em ${c.code_expiration_minutes} minutos.` : ''), 'template-footer'));
            else if (kind === 'BUTTONS')
                for (const b of c.buttons ?? []) {
                    const label = b.text || (isOtp(b, template) ? 'Copiar código' : type(b.type) === 'COPY_CODE' ? 'Copiar código' : 'Abrir');
                    item.append(node('div', label, 'template-client-button'));
                }
            else if (kind === 'LIMITED_TIME_OFFER') {
                const offer = node('div', '', 'template-offer');
                offer.append(node('strong', c.limited_time_offer?.text || 'Oferta por tempo limitado'));
                if (values.limited_time_offer_expiration) {
                    const date = new Date(values.limited_time_offer_expiration);
                    if (Number.isFinite(date.getTime()))
                        offer.append(node('span', `Válida até ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)}`));
                }
                item.append(offer);
            }
        }
        return item;
    }
    outer.append(bubble(template.components));
    if (isAuthentication(template) && template.components.some((c: TemplateRow) => type(c.type) === 'BODY' && !c.text))
        outer.append(node('small', `Prévia do código. O texto padrão de autenticação é definido pelo canal no idioma ${template.language?.code ?? template.language ?? 'do template'}.`, 'template-platform-note'));
    const carousel = template.components.find((c: TemplateRow) => type(c.type) === 'CAROUSEL');
    if (carousel) {
        const cards = node('div', '', 'template-carousel');
        cards.setAttribute('role', 'region');
        cards.setAttribute('aria-label', 'Cards do template');
        cards.tabIndex = 0;
        carousel.cards.forEach((c: TemplateRow, i: number) => cards.append(bubble(c.components, i)));
        outer.append(cards);
    }
    if (isAuthentication(template) && template.components.some((c: TemplateRow) => type(c.type) === 'BUTTONS' && c.buttons?.some((b: TemplateRow) => ['ONE_TAP', 'ZERO_TAP'].includes(type(b.otp_type)))))
        outer.append(node('small', 'Autopreenchimento depende do app e do dispositivo do cliente.', 'template-platform-note'));
    return outer;
}
