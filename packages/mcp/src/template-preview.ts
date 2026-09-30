/** Pure catalogue → Cloud API model. No media download, network or credentials. */
export type TemplateRow = Record<string, any>;
export type TemplateField = {
    key: string;
    section: string;
    variable: string;
    index?: number;
    card?: number;
    kind: 'text' | 'media' | 'media_id' | 'filename' | 'latitude' | 'longitude' | 'coupon' | 'otp' | 'payload' | 'expiry' | 'json';
    required: boolean;
    label: string;
    max: number;
    example?: string;
    secret?: boolean;
};
const upper = (v: unknown) => String(v ?? '').toUpperCase();
const prefix = (card?: number) => card === undefined ? '' : `card_${card}_`;
export const isAuthentication = (t: TemplateRow) => upper(t.category) === 'AUTHENTICATION';
export const isOtp = (b: TemplateRow, t: TemplateRow) => upper(b.type) === 'OTP' || isAuthentication(t) && (upper(b.type) === 'COPY_CODE' || upper(b.type) === 'URL' && /whatsapp\.com\/otp\//i.test(b.url ?? ''));
function variables(text: string) { return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]!))].sort((a, b) => /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) - Number(b) : 0); }
function example(c: TemplateRow, section: string, variable: string) { const named = c.example?.[`${section}_text_named_params`]?.find((p: TemplateRow) => p.param_name === variable); return named?.example ?? (section === 'body' ? c.example?.body_text?.[0] : c.example?.header_text)?.[Number(variable) - 1]; }
export function templateFields(template: TemplateRow): TemplateField[] {
    if (templateUnsupportedReason(template))
        return [];
    const fields: TemplateField[] = [];
    function walk(components: TemplateRow[], card?: number) {
        const p = prefix(card), where = card === undefined ? '' : `Card ${card + 1} · `;
        const add = (section: string, variable: string, kind: TemplateField['kind'], label: string, required = true, max = 1024, index?: number, ex?: string) => fields.push({ key: `${p}${section}_${index === undefined ? '' : `${index}_`}${variable}`, section, variable, kind, required, label: where + label, max, index, card, example: ex, secret: ['media', 'otp'].includes(kind) });
        for (const c of components ?? []) {
            const type = upper(c.type), section = type.toLowerCase();
            if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(upper(c.format))) {
                add('header', 'media', 'media', 'URL HTTPS pública', false, 2048);
                add('header', 'media_id', 'media_id', 'Ou media_id existente', false, 200);
                if (upper(c.format) === 'DOCUMENT')
                    add('header', 'filename', 'filename', 'Nome do documento', false, 240);
            }
            else if (type === 'HEADER' && upper(c.format) === 'LOCATION') {
                add('header', 'latitude', 'latitude', 'Latitude', true, 32);
                add('header', 'longitude', 'longitude', 'Longitude', true, 32);
                add('header', 'name', 'text', 'Nome do lugar', false, 1000);
                add('header', 'address', 'text', 'Endereço', false, 1000);
            }
            else if (type === 'BODY' || type === 'HEADER' && upper(c.format) === 'TEXT') {
                const vars = variables(c.text ?? '');
                if (type === 'BODY' && isAuthentication(template) && !vars.length)
                    vars.push('1');
                for (const v of vars)
                    add(section, v, isAuthentication(template) && type === 'BODY' ? 'otp' : 'text', isAuthentication(template) && type === 'BODY' ? 'Código emitido pelo seu sistema' : `${type === 'BODY' ? 'Corpo' : 'Cabeçalho'} · ${v}`, true, isAuthentication(template) ? 15 : type === 'HEADER' ? 60 : 4096, undefined, example(c, section, v));
            }
            else if (type === 'BUTTONS')
                for (const [i, b] of (c.buttons ?? []).entries()) {
                    const bt = upper(b.type);
                    if (isOtp(b, template))
                        continue;
                    if (bt === 'URL')
                        for (const v of variables(b.url ?? ''))
                            add('button', v, 'text', `Sufixo de “${b.text}”`, true, 1024, i);
                    if (bt === 'COPY_CODE')
                        add('button', 'code', 'coupon', 'Código para copiar', true, 15, i);
                    if (bt === 'QUICK_REPLY')
                        add('button', 'payload', 'payload', `Resposta de “${b.text}”`, card !== undefined, 256, i, card !== undefined ? b.text : undefined);
                    if (['CATALOG', 'MPM', 'SPM'].includes(bt))
                        add('button', 'action', 'json', 'Seleção do catálogo (JSON)', bt !== 'CATALOG', 4096, i);
                }
            else if (type === 'CAROUSEL')
                for (const [i, row] of (c.cards ?? []).entries())
                    walk(row.components, i);
            else if (type === 'LIMITED_TIME_OFFER' && c.limited_time_offer?.has_expiration !== false)
                add('limited_time_offer', 'expiration', 'expiry', 'Oferta válida até', true, 40);
        }
    }
    walk(template.components);
    return fields;
}
/** Unknown catalogue shapes fail closed; the tools-only API remains unconstrained. */
export function templateUnsupportedReason(template: TemplateRow): string | null {
    const containsRemovedButton = (components: TemplateRow[]): boolean => components.some(c => (Array.isArray(c?.buttons) && c.buttons.some((b: TemplateRow) => upper(b?.type) === 'FLOW')) ||
        (Array.isArray(c?.cards) && c.cards.some((card: TemplateRow) => containsRemovedButton(Array.isArray(card?.components) ? card.components : []))));
    if (Array.isArray(template.components) && containsRemovedButton(template.components))
        return 'Este template usa WhatsApp Flows, que não fazem parte do BotoZap. Use outro template aprovado.';
    if (upper(template.status) !== 'APPROVED')
        return 'Template não aprovado.';
    if (!Array.isArray(template.components) || !template.components.length)
        return 'Catálogo sem componentes; sincronize o template.';
    function inspect(list: TemplateRow[], card = false): string | null {
        for (const c of list) {
            const type = upper(c.type);
            if (type === 'HEADER' && !['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(upper(c.format)))
                return `Cabeçalho ${c.format ?? 'desconhecido'} sem schema conhecido.`;
            if (type === 'BUTTONS')
                for (const b of c.buttons ?? []) {
                    if (!['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'OTP', 'CATALOG', 'MPM', 'SPM', 'VOICE_CALL'].includes(upper(b.type)))
                        return `Botão ${b.type} sem schema conhecido.`;
                }
            if (type === 'CAROUSEL') {
                if (card || !Array.isArray(c.cards) || c.cards.length < 2 || c.cards.length > 10)
                    return 'Carrossel deve ter de 2 a 10 cards.';
                for (const row of c.cards) {
                    const err = inspect(row.components ?? [], true);
                    if (err)
                        return err;
                    const h = (row.components ?? []).find((v: TemplateRow) => upper(v.type) === 'HEADER');
                    if (!h || !['IMAGE', 'VIDEO'].includes(upper(h.format)))
                        return 'Carrossel exige imagem ou vídeo em cada card.';
                }
            }
            if (!['HEADER', 'BODY', 'FOOTER', 'BUTTONS', 'CAROUSEL', 'LIMITED_TIME_OFFER'].includes(type))
                return `Componente ${c.type} sem schema conhecido.`;
        }
        return null;
    }
    return inspect(template.components);
}
export const supportedTemplate = (template: TemplateRow) => !templateUnsupportedReason(template);
export function fillTemplate(source: string, values: Record<string, string>, section: string, index?: number, card?: number) { return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[`${prefix(card)}${section}_${index === undefined ? '' : `${index}_`}${key}`] || `{{${key}}}`); }
function publicHttps(value: string) {
    try {
        const u = new URL(value), h = u.hostname.toLowerCase();
        return u.protocol === 'https:' && !u.username && !u.password && h.includes('.') && !h.endsWith('.local') && !h.endsWith('.localhost') && !h.endsWith('.internal') && !/\.(test|invalid|onion)$/.test(h) && !h.startsWith('[') && !/^\d+(\.\d+){3}$/.test(h) && h !== 'localhost';
    }
    catch {
        return false;
    }
}
function coordinate(v: string, min: number, max: number) { const raw = v.trim().replace(',', '.'); const n = Number(raw); return /^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(n) && n >= min && n <= max; }
function objectJson(v: string) {
    try {
        const data = JSON.parse(v);
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    }
    catch {
        return null;
    }
}
export function validateTemplateValues(t: TemplateRow, values: Record<string, string>, now = Date.now()): Record<string, string> {
    const errors: Record<string, string> = {}, reason = templateUnsupportedReason(t);
    if (reason)
        errors.template = reason;
    const fields = templateFields(t);
    for (const f of fields) {
        const v = (values[f.key] ?? '').trim();
        if (f.required && !v) {
            errors[f.key] = `Preencha ${f.label.toLowerCase()}.`;
            continue;
        }
        if (!v)
            continue;
        if (v.length > f.max)
            errors[f.key] = `Máximo de ${f.max} caracteres.`;
        else if (f.kind === 'media' && !publicHttps(v))
            errors[f.key] = 'Use URL HTTPS pública, sem usuário/senha, localhost ou IP.';
        else if (f.kind === 'media_id' && !/^[1-9]\d{0,199}$/.test(v))
            errors[f.key] = 'Use o media_id numérico de um upload já existente.';
        else if (f.kind === 'latitude' && !coordinate(v, -90, 90))
            errors[f.key] = 'Latitude entre −90 e 90.';
        else if (f.kind === 'longitude' && !coordinate(v, -180, 180))
            errors[f.key] = 'Longitude entre −180 e 180.';
        else if (f.kind === 'otp' && !/^[a-zA-Z0-9]{1,15}$/.test(v))
            errors[f.key] = 'Código de 1 a 15 caracteres alfanuméricos, emitido pelo seu sistema.';
        else if (f.kind === 'coupon' && /[\x00-\x1f\x7f]/.test(v))
            errors[f.key] = 'Código de até 15 caracteres, sem caracteres de controle.';
        else if (f.kind === 'expiry' && (!Number.isFinite(Date.parse(v)) || Date.parse(v) <= now || !/(Z|[+-]\d\d:\d\d)$/.test(v)))
            errors[f.key] = 'Informe uma data futura ISO 8601 com fuso.';
        else if (f.kind === 'json' && !objectJson(v))
            errors[f.key] = 'Informe um objeto JSON válido.';
    }
    for (const f of fields.filter(f => f.kind === 'text' && f.section === 'body')) {
        const format = values[f.key + '__format'];
        if (format && !['text', 'currency', 'date_time'].includes(format))
            errors[f.key] = 'Formato de parâmetro desconhecido.';
        if (format === 'currency') {
            if (!/^[A-Z]{3}$/.test(values[f.key + '__code'] ?? ''))
                errors[f.key + '__code'] = 'Moeda: código ISO com 3 letras (BRL).';
            const amount = values[f.key + '__amount'];
            if (!/^-?\d+$/.test(amount ?? '') || !Number.isSafeInteger(Number(amount)))
                errors[f.key + '__amount'] = 'Valor inteiro em milésimos, dentro do limite seguro.';
        }
    }
    function walk(list: TemplateRow[], card?: number) {
        const p = prefix(card);
        for (const c of list ?? []) {
            const type = upper(c.type);
            if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(upper(c.format))) {
                const url = values[p + 'header_media']?.trim(), id = values[p + 'header_media_id']?.trim();
                if (!url && !id || url && id)
                    errors[p + 'header_media'] = 'Informe uma URL pública OU media_id existente.';
            }
            if (type === 'BUTTONS')
                for (const [i, b] of (c.buttons ?? []).entries())
                    if (upper(b.type) === 'URL' && !isOtp(b, t)) {
                        const url = fillTemplate(b.url ?? '', values, 'button', i, card);
                        if (!publicHttps(url) || url.length > 2000)
                            errors[`${p}button_${i}_${variables(b.url ?? '')[0] ?? 'url'}`] = 'URL final deve ser HTTPS pública com até 2000 caracteres.';
                    }
            if (type === 'CAROUSEL')
                for (const [i, row] of c.cards.entries())
                    walk(row.components, i);
        }
    }
    walk(t.components);
    if (!Object.keys(errors).length)
        try {
            validateBudget(buildParameters(t, values));
        }
        catch (error) {
            errors.template = (error as Error).message;
        }
    return errors;
}
function buildParameters(t: TemplateRow, values: Record<string, string>): TemplateRow[] {
    function walk(list: TemplateRow[], card?: number): TemplateRow[] {
        const out: TemplateRow[] = [], p = prefix(card);
        for (const c of list) {
            const type = upper(c.type), section = type.toLowerCase();
            if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(upper(c.format))) {
                const format = String(c.format).toLowerCase(), id = values[p + 'header_media_id']?.trim(), filename = values[p + 'header_filename']?.trim();
                out.push({ type: 'header', parameters: [{ type: format, [format]: { ...(id ? { id } : { link: (values[p + 'header_media'] ?? '').trim() }), ...(format === 'document' && filename ? { filename } : {}) } }] });
            }
            else if (type === 'HEADER' && upper(c.format) === 'LOCATION') {
                const loc: TemplateRow = { latitude: Number((values[p + 'header_latitude'] ?? '').replace(',', '.')), longitude: Number((values[p + 'header_longitude'] ?? '').replace(',', '.')) };
                for (const k of ['name', 'address'])
                    if (values[p + 'header_' + k]?.trim())
                        loc[k] = (values[p + 'header_' + k] ?? '').trim();
                out.push({ type: 'header', parameters: [{ type: 'location', location: loc }] });
            }
            else if (type === 'BODY' || type === 'HEADER' && upper(c.format) === 'TEXT') {
                const fs = templateFields(t).filter(f => f.section === section && f.card === card && f.required);
                if (fs.length)
                    out.push({ type: section, parameters: fs.map(f => ({ ...parameter(f, values), ...(/^\d+$/.test(f.variable) ? {} : { parameter_name: f.variable }) })) });
            }
            else if (type === 'BUTTONS')
                for (const [i, b] of (c.buttons ?? []).entries()) {
                    const key = `${p}button_${i}_`, bt = upper(b.type), base = { type: 'button', index: String(i) };
                    if (isOtp(b, t)) {
                        const otp = templateFields(t).find(f => f.kind === 'otp' && f.card === card);
                        out.push({ ...base, sub_type: 'url', parameters: [{ type: 'text', text: values[otp!.key] }] });
                    }
                    else if (bt === 'URL' && variables(b.url ?? '').length)
                        out.push({ ...base, sub_type: 'url', parameters: variables(b.url).map(v => ({ type: 'text', text: values[key + v] })) });
                    else if (bt === 'COPY_CODE')
                        out.push({ ...base, sub_type: 'copy_code', parameters: [{ type: 'coupon_code', coupon_code: values[key + 'code']?.trim() }] });
                    else if (bt === 'QUICK_REPLY' && values[key + 'payload']?.trim())
                        out.push({ ...base, sub_type: 'quick_reply', parameters: [{ type: 'payload', payload: values[key + 'payload'] }] });
                    else if (['CATALOG', 'MPM', 'SPM'].includes(bt) && values[key + 'action'])
                        out.push({ ...base, sub_type: bt.toLowerCase(), parameters: [{ type: 'action', action: objectJson(values[key + 'action'] ?? '') }] });
                }
            else if (type === 'CAROUSEL')
                out.push({ type: 'carousel', cards: c.cards.map((row: TemplateRow, i: number) => ({ card_index: i, components: walk(row.components, i) })) });
            else if (type === 'LIMITED_TIME_OFFER' && c.limited_time_offer?.has_expiration !== false)
                out.push({ type: 'limited_time_offer', parameters: [{ type: 'limited_time_offer', limited_time_offer: { expiration_time_ms: Date.parse(values.limited_time_offer_expiration ?? '') } }] });
        }
        return out;
    }
    return walk(t.components);
}
function parameter(f: TemplateField, values: Record<string, string>) {
    const format = values[f.key + '__format'];
    if (format === 'currency')
        return { type: 'currency', currency: { fallback_value: values[f.key], code: values[f.key + '__code'], amount_1000: Number(values[f.key + '__amount']) } };
    if (format === 'date_time')
        return { type: 'date_time', date_time: { fallback_value: values[f.key] } };
    return { type: 'text', text: values[f.key] };
}
function validateBudget(out: TemplateRow[]) {
    if (out.length > 20 || new TextEncoder().encode(JSON.stringify(out)).length > 32 * 1024)
        throw new Error('Componentes excedem o limite da API: 20 itens / 32 KB.');
}
export function templateParameters(t: TemplateRow, values: Record<string, string>): TemplateRow[] {
    const errors = validateTemplateValues(t, values);
    if (Object.keys(errors).length)
        throw new Error(Object.values(errors)[0]);
    return buildParameters(t, values);
}
