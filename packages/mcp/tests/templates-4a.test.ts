// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { templateFields, templateParameters, validateTemplateValues, templateUnsupportedReason } from '../src/template-preview.js';
import { renderTemplatePreview } from '../web/screens/template-renderer.js';
import { completeTemplates, completeTemplateContext, completeTemplateOptions } from '../web/scenarios/template-complete.js';
import { approvedTemplates } from '../web/scenarios/template.js';
import { mountTemplate } from '../web/screens/template.js';
import { templateStage, templateTool } from '../web/scenarios/template.js';
import { mountCases } from '../web/screens/cases.js';
import { mountBooking } from '../web/screens/booking.js';
import { casesStage, casesTool } from '../web/scenarios/cases.js';
import { bookingStage, bookingTool } from '../web/scenarios/booking.js';
const values = (i: number) => completeTemplateContext(completeTemplateOptions[i]![0]!).suggested_values[completeTemplates[i]!.id]!;
beforeEach(() => { document.body.replaceChildren(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
describe('templates completos, catálogo aprovado → parâmetros e bolha local', () => {
    it.each(completeTemplates.map((t, i) => [t.name, i] as const))('%s: a prévia não acessa mídia e os parâmetros são válidos', (_name, i) => {
        const t = completeTemplates[i]!, v = values(i);
        expect(templateUnsupportedReason(t)).toBeNull();
        expect(validateTemplateValues(t, v)).toEqual({});
        const payload = templateParameters(t, v);
        expect(payload.length).toBeLessThanOrEqual(20);
        const preview = renderTemplatePreview(t, v, completeTemplateContext(completeTemplateOptions[i]![0]!).media_metadata);
        document.body.append(preview);
        expect(preview.querySelectorAll('img,video,iframe,source,a,[src]')).toHaveLength(0);
        expect(preview.querySelectorAll('.template-bubble').length).toBeGreaterThan(0);
        expect(preview.textContent).not.toContain('https://');
        expect(preview.textContent).not.toContain('[object Object]');
    });
    it.each([['IMAGE', 'image'], ['VIDEO', 'video'], ['DOCUMENT', 'document']])('%s: URL ou media_id, nunca ambos', (format, kind) => {
        const t = { status: 'APPROVED', components: [{ type: 'HEADER', format }] };
        expect(templateParameters(t, { header_media: 'https://botozap.com.br/media/file?secret=123', header_filename: 'Pedido.pdf' })[0]?.parameters[0]).toMatchObject({ type: kind, [kind]: { link: expect.stringContaining('secret') } });
        expect(templateParameters(t, { header_media_id: '123' })[0]?.parameters[0]).toEqual({ type: kind, [kind]: { id: '123' } });
        expect(validateTemplateValues(t, { header_media_id: '123', header_media: 'https://botozap.com.br/file' }).header_media).toBeTruthy();
        expect(validateTemplateValues(t, {}).header_media).toBeTruthy();
        for (const url of ['http://botozap.com.br/file', 'https://127.0.0.1/file', 'https://localhost/file', 'https://private.local/file', 'https://user:pass@botozap.com.br/file', 'https://example.invalid/file', 'https://[::1]/file'])
            expect(validateTemplateValues(t, { header_media: url }).header_media, url).toBeTruthy();
        const preview = renderTemplatePreview(t, { header_media: 'https://botozap.com.br/secret?token=123', header_filename: 'Pedido.pdf' }, { header: { file_size: 1024 * 1024 } });
        expect(preview.textContent).not.toContain('token');
        expect(preview.textContent).toContain('1 MB');
        expect(preview.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('Prévia sem carregar');
    });
    it('location valida limites e renderiza endereço sem buscar mapa', () => {
        const t = completeTemplates[3]!;
        const v = values(3);
        const p = templateParameters(t, v)[0]!;
        expect(p.parameters[0]).toEqual({ type: 'location', location: { latitude: -3.1316, longitude: -60.0234, name: 'Ateliê das Águas', address: 'Centro · Manaus' } });
        expect(validateTemplateValues(t, { ...v, header_latitude: '91', header_longitude: 'NaN' })).toMatchObject({ header_latitude: expect.any(String), header_longitude: expect.any(String) });
    });
    it('auth usa o mesmo código emitido no corpo e botão, sem gerar OTP', () => {
        for (const i of [4, 5]) {
            const p = templateParameters(completeTemplates[i]!, values(i));
            expect(p[0]?.parameters[0]).toEqual({ type: 'text', text: '123456' });
            expect(p[1]).toMatchObject({ sub_type: 'url', parameters: [{ type: 'text', text: '123456' }] });
            expect(validateTemplateValues(completeTemplates[i]!, { body_1: '' }).body_1).toBeTruthy();
        }
        expect(renderTemplatePreview(completeTemplates[5]!, values(5)).textContent).toContain('depende do app');
    });
    it('carrossel serializa índices, mídia e valores por card sem misturá-los', () => {
        const p = templateParameters(completeTemplates[6]!, values(6));
        expect(p[1]?.cards.map((c: any) => c.card_index)).toEqual([0, 1]);
        expect(p[1]?.cards[0].components[0].parameters[0].image.id).toBe('123456789012341');
        expect(p[1]?.cards[1].components[0].parameters[0].image.id).toBe('123456789012342');
        expect(renderTemplatePreview(completeTemplates[6]!, values(6)).querySelectorAll('.template-bubble')).toHaveLength(3);
    });
    it('nomeadas, cupom, URL e oferta preservam o schema e expiração', () => {
        const v = values(7), p = templateParameters(completeTemplates[7]!, v);
        expect(p[1]?.parameters[0]).toEqual({ type: 'text', text: 'Marina', parameter_name: 'nome' });
        expect(p.find(c => c.sub_type === 'copy_code')?.parameters).toEqual([{ type: 'coupon_code', coupon_code: 'AGUAS10' }]);
        expect(p.find(c => c.type === 'limited_time_offer')?.parameters[0].limited_time_offer.expiration_time_ms).toBe(Date.parse(v.limited_time_offer_expiration!));
        expect(validateTemplateValues(completeTemplates[7]!, { ...v, limited_time_offer_expiration: '2000-01-01T00:00:00Z' }).limited_time_offer_expiration).toBeTruthy();
    });
    it('catálogo preserva action JSON; telefone estático não vira parâmetro', () => {
        expect(templateParameters(completeTemplates[8]!, values(8))[0]).toMatchObject({ sub_type: 'catalog', parameters: [{ type: 'action' }] });
        expect(templateParameters(completeTemplates[0]!, values(0)).some(p => p.index === '1')).toBe(false);
    });
    it('corpo aceita texto/moeda/data com fallback fiel e nomes preservados', () => {
        const t = { status: 'APPROVED', components: [{ type: 'BODY', text: 'Total {{valor}} · {{data}}' }] };
        const v = { body_valor: 'R$ 10,50', body_valor__format: 'currency', body_valor__code: 'BRL', body_valor__amount: '10500', body_data: '30 de setembro', body_data__format: 'date_time' };
        expect(templateParameters(t, v)[0]?.parameters).toEqual([{ type: 'currency', currency: { fallback_value: 'R$ 10,50', code: 'BRL', amount_1000: 10500 }, parameter_name: 'valor' }, { type: 'date_time', date_time: { fallback_value: '30 de setembro' }, parameter_name: 'data' }]);
        expect(renderTemplatePreview(t, v).textContent).toContain('R$ 10,50');
        expect(validateTemplateValues(t, { ...v, body_valor__code: 'br', body_valor__amount: '1.5' })).toMatchObject({ body_valor__code: expect.any(String), body_valor__amount: expect.any(String) });
    });
    it('aplica o limite de 20 componentes e 32 KiB em UTF-8 antes do envio', () => { const t = { status: 'APPROVED', components: Array.from({ length: 21 }, () => ({ type: 'BODY', text: '{{1}}' })) }; expect(() => templateParameters(t, { body_1: 'Marina' })).toThrow('20 itens'); const big = { status: 'APPROVED', components: Array.from({ length: 3 }, () => ({ type: 'BODY', text: '{{1}}' })) }; expect(() => templateParameters(big, { body_1: '水'.repeat(4000) })).toThrow('32 KB'); });
    it('não interpola HTML; limita tamanhos e bloqueia catálogo desconhecido', () => {
        expect(renderTemplatePreview(approvedTemplates[0]!, { body_1: '<img src=x onerror=alert(1)>', body_2: '40' }).querySelector('img')).toBeNull();
        expect(validateTemplateValues(approvedTemplates[0]!, { body_1: 'x'.repeat(4097), body_2: '40' }).body_1).toBeTruthy();
        expect(templateUnsupportedReason({ status: 'APPROVED', components: [{ type: 'FUTURE_COMPONENT' }] })).toContain('sem schema');
        expect(templateUnsupportedReason({ ...completeTemplates[0], status: 'PAUSED' })).toContain('não aprovado');
        expect(templateFields(completeTemplates[9]!).map(f => f.key)).toContain('body_nome');
    });
});
it('agenda agrupa os dias; Com Meet não repete o aviso em cada card', async () => {
    const bridge = { call: vi.fn(async (n: string, a: any) => bookingTool(n, a, 'booking')), context: vi.fn(async () => { }) };
    mountBooking(document.body, bridge as any).bootstrap(bookingStage('booking'));
    await vi.waitFor(() => expect(document.querySelectorAll('.booking-day h2').length).toBeGreaterThan(0));
    expect(document.querySelectorAll('.booking-day h2')).toHaveLength(2);
    expect(document.querySelector('.slot-card')?.textContent).not.toContain('sujeito à conexão');
    expect(document.querySelector('.slot-card')?.textContent).not.toContain('Hoje');
});
it.each([['cases', '24 conversas hoje (UTC)'], ['cases-unique', '17 clientes atendidos hoje']])('métrica %s tem a unidade e o fuso corretos', async (scenario, text) => {
    const bridge = { call: vi.fn(async (n: string, a: any) => casesTool(n, a, scenario)), context: vi.fn(async () => { }) };
    mountCases(document.body, bridge as any).bootstrap(casesStage(scenario));
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
    if (scenario === 'cases-unique')
        expect(document.body.textContent).not.toContain('America/Manaus');
});
it('códigos seguem tamanho aceito, sem inventar mínimo OTP ou restringir cupom a ASCII', () => {
    expect(validateTemplateValues(completeTemplates[4]!, { body_1: '1' })).toEqual({});
    expect(validateTemplateValues(completeTemplates[9]!, { ...values(9), button_0_code: 'ÁGUAS 2026' })).toEqual({});
    expect(validateTemplateValues(completeTemplates[9]!, { ...values(9), button_0_code: 'AGUAS\n2026' }).button_0_code).toBeTruthy();
});
const removedReason = 'Este template usa WhatsApp Flows, que não fazem parte do BotoZap. Use outro template aprovado.';
const removedTemplate = { ...approvedTemplates[0], id: '00000000-0000-4000-8000-000000000099', name: 'template_removido', components: [{ type: 'BODY', text: 'Não exibir esta mensagem' }, { type: 'BUTTONS', buttons: [{ type: 'FLOW', text: 'Não exibir este botão' }] }] };
it('WhatsApp Flows sincronizado é bloqueado sem campos, prévia ou parâmetros, também em carrossel', () => {
    const carousel = { ...completeTemplates[6], components: [{ type: 'CAROUSEL', cards: [{ components: [{ type: 'HEADER', format: 'IMAGE' }, ...removedTemplate.components] }, { components: [{ type: 'HEADER', format: 'IMAGE' }] }] }] };
    for (const t of [removedTemplate, carousel, { ...removedTemplate, status: 'PAUSED' }, { ...removedTemplate, components: [{ type: 'HEADER', format: 'UNKNOWN' }, ...removedTemplate.components] }]) {
        expect(templateUnsupportedReason(t)).toBe(removedReason);
        expect(templateFields(t)).toEqual([]);
        expect(() => templateParameters(t, {})).toThrow(removedReason);
        const preview = renderTemplatePreview(t, {});
        expect(preview.querySelectorAll('.template-bubble,.template-client-button')).toHaveLength(0);
        expect(preview.textContent).not.toContain('Não exibir');
    }
});
it('template removido aparece não suportado no catálogo e escolher outro libera a revisão', async () => {
    const call = vi.fn(async (n: string, a: any) => n === 'list_templates' ? { structuredContent: { data: [removedTemplate, approvedTemplates[0]], meta: { total_pages: 1 } } } : templateTool(n, a, 'template'));
    const bridge = { call, context: vi.fn(async () => { }) };
    mountTemplate(document.body, bridge as any, { ...templateStage(), preferred_template_id: removedTemplate.id });
    await vi.waitFor(() => expect(document.body.dataset.state).toBe('Não suportado'));
    expect(document.body.textContent).toContain(removedReason);
    expect(document.querySelector('option')?.textContent).toContain('Não suportado');
    expect(document.querySelectorAll('button,input,.template-bubble')).toHaveLength(0);
    expect(call.mock.calls.some(([n]) => n === 'review_template_variables' || n === 'send_message' || n === 'prepare_send_intent')).toBe(false);
    const selector = document.querySelector('select')!;
    selector.value = approvedTemplates[0]!.id;
    selector.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(document.body.dataset.state).toBe('Rascunho'));
    expect(document.querySelector('button')?.disabled).toBe(false);
});
it('preflight bloqueia a substituição tardia por WhatsApp Flows antes de preparar ou enviar', async () => {
    const bridge = { call: vi.fn(async (n: string, a: any) => n === 'get_template' ? { structuredContent: { data: removedTemplate } } : n === 'get_conversation' ? { structuredContent: { data: templateStage().conversation } } : templateTool(n, a, 'template')), context: vi.fn(async () => { }) };
    mountTemplate(document.body, bridge as any, templateStage());
    await vi.waitFor(() => expect(document.body.dataset.state).toBe('Rascunho'));
    document.querySelector<HTMLButtonElement>('button')!.click();
    [...document.querySelectorAll('button')].find(b => b.textContent === 'Enviar template')!.click();
    await vi.waitFor(() => expect(document.body.dataset.state).toBe('Recusado'));
    expect(document.body.textContent).toContain(removedReason);
    expect(bridge.call.mock.calls.some(([n]) => n === 'send_message' || n === 'prepare_send_intent')).toBe(false);
});
