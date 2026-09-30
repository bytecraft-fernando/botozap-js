import type { Bridge } from '../panel.js';
import { templateFields, templateParameters, validateTemplateValues, isAuthentication, templateUnsupportedReason } from '../../src/template-preview.js';
import { renderTemplatePreview } from './template-renderer.js';
import { shell, node, button, field, call, ScreenError, skeleton, type Row } from './screen-kit.js';
export function mountTemplate(root: HTMLElement, bridge: Bridge, initial?: Row) {
    const ui = shell(root, 'Fora da janela', 'Uma mensagem aprovada, com contexto');
    skeleton(ui.content);
    let context: Row, templates: Row[] = [], selected: Row, values: Record<string, string> = {}, frozen = false, sending = false, key = '', definition = '', mode = 'draft';
    let destination = '';
    const preview = node('section', '', 'screen-preview');
    preview.setAttribute('aria-label', 'Prévia do template para o cliente');
    const selector = document.createElement('select');
    selector.id = 'approved-template';
    const label = node('label', 'Template aprovado');
    label.setAttribute('for', selector.id);
    const fields = node('div', '', 'template-fields');
    const metadata = node('dl', '', 'screen-metadata');
    const validation = node('p', '', 'template-validation');
    validation.setAttribute('role', 'status');
    validation.setAttribute('aria-live', 'polite');
    function renderPreview() { preview.replaceChildren(renderTemplatePreview(selected, values, context.media_metadata ?? {})); }
    function canSend() { return !frozen && !Object.keys(validateTemplateValues(selected, values)).length; }
    function validate() { const errors = validateTemplateValues(selected, values); validation.textContent = Object.values(errors)[0] ?? ''; for (const f of templateFields(selected)) {
        const input = fields.querySelector<HTMLInputElement>(`#variable-${f.key}`);
        if (input) {
            input.setAttribute('aria-invalid', String(!!errors[f.key]));
            input.setAttribute('aria-describedby', `error-${f.key}`);
            fields.querySelector(`#error-${f.key}`)!.textContent = errors[f.key] ?? '';
        }
    } }
    function renderActions() {
        ui.actions.replaceChildren();
        if (frozen)
            return;
        if (mode === 'confirming') {
            ui.actions.append(button('Editar', () => { mode = 'draft'; ui.state('Rascunho'); renderActions(); }), button('Enviar template', () => void send(), true));
        }
        else {
            const review = button('Revisar envio', () => { if (!canSend())
                return; mode = 'confirming'; fields.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(i => i.disabled = true); selector.disabled = true; ui.state('Confirmando', 'Confira De, Para e a prévia; Enviar template enviará esta mensagem ao cliente.'); renderActions(); if (root.dataset.mode === 'fullscreen')
                ui.actions.scrollIntoView({ block: 'center' }); }, true);
            review.disabled = !canSend();
            ui.actions.append(review);
        }
        if (mode === 'draft') {
            fields.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(i => i.disabled = false);
            selector.disabled = false;
        }
    }
    async function selectTemplate() {
        selected = templates.find(t => t.id === selector.value)!;
        if (!selected)
            return;
        key = '';
        mode = 'draft';
        definition = JSON.stringify([selected.name, selected.language, selected.components]);
        values = {};
        fields.replaceChildren();
        const reason = templateUnsupportedReason(selected);
        if (reason) { preview.replaceChildren(); ui.actions.replaceChildren(); ui.state('Não suportado', reason); return; }
        const name = context.conversation.contact?.name?.split(' ')[0] ?? '';
        for (const f of templateFields(selected)) {
            values[f.key] = context.suggested_values?.[selected.id]?.[f.key] ?? (f.section === 'body' && f.kind === 'text' && ['1', 'name', 'nome', 'customer_name'].includes(f.variable) && f.card === undefined ? name : f.kind === 'otp' || f.kind === 'media' || f.kind === 'media_id' ? '' : String(f.example ?? ''));
            const input = field(`${f.label}${f.required ? '' : ' (opcional)'}`, values[f.key], `variable-${f.key}`);
            input.input.maxLength = f.max;
            input.input.required = f.required;
            input.input.autocomplete = 'off';
            if (f.kind === 'media')
                input.input.type = 'password';
            if (['latitude', 'longitude'].includes(f.kind))
                input.input.inputMode = 'decimal';
            if (f.kind === 'media_id')
                input.input.inputMode = 'numeric';
            if (f.kind === 'expiry')
                input.input.placeholder = '2026-10-01T18:00:00-04:00';
            const error = node('small', '', 'field-error');
            error.id = `error-${f.key}`;
            input.wrapper.append(error);
            input.input.oninput = () => { if (frozen)
                return; values[f.key] = input.input.value; key = ''; renderPreview(); validate(); renderActions(); };
            fields.append(input.wrapper);
            if (f.kind === 'text' && f.section === 'body') {
                const advanced = node('details', '', 'template-parameter-format');
                advanced.append(node('summary', 'Tipo do parâmetro (opcional)'));
                const format = document.createElement('select');
                format.id = `variable-${f.key}__format`;
                const l = node('label', `Formato · ${f.label}`);
                l.setAttribute('for', format.id);
                for (const [v, title] of [['text', 'Texto'], ['currency', 'Moeda'], ['date_time', 'Data e hora']]) {
                    const o = document.createElement('option');
                    o.value = v;
                    o.textContent = title;
                    format.append(o);
                }
                values[f.key + '__format'] = 'text';
                const extra = node('div');
                extra.hidden = true;
                advanced.append(l, format, extra);
                format.onchange = () => {
                    if (frozen)
                        return;
                    values[f.key + '__format'] = format.value;
                    extra.replaceChildren();
                    extra.hidden = format.value !== 'currency';
                    if (format.value === 'currency')
                        for (const [suffix, title, initial] of [['code', 'Código ISO da moeda', 'BRL'], ['amount', 'Valor em milésimos (R$ 10 = 10000)', '']]) {
                            const valueKey = f.key + '__' + suffix;
                            values[valueKey] ??= initial;
                            const control = field(title, values[valueKey], `variable-${valueKey}`);
                            control.input.inputMode = suffix === 'amount' ? 'numeric' : 'text';
                            control.input.oninput = () => { values[valueKey] = control.input.value; key = ''; renderPreview(); validate(); renderActions(); };
                            extra.append(control.wrapper);
                        }
                    key = '';
                    renderPreview();
                    validate();
                    renderActions();
                };
                fields.append(advanced);
            }
        }
        fields.append(validation);
        if (isAuthentication(selected))
            fields.prepend(node('p', 'Use um código emitido pelo seu sistema. O BotoZap não gera nem valida o código de autenticação.', 'template-help'));
        if (templateFields(selected).some(f => f.kind === 'media'))
            fields.append(node('p', 'Mídia: informe URL HTTPS pública ou media_id de upload existente. A prévia não baixa arquivos; URLs ficam protegidas.', 'template-help'));
        renderPreview();
        validate();
        renderActions();
        ui.state('Rascunho', 'Valores sugeridos. Confira antes de enviar; template aprovado não elimina a necessidade de revisar o conteúdo.');
        const selectedId = selected.id;
        const suggested = JSON.stringify(values);
        try {
            const result = await call(bridge, 'review_template_variables', { template_id: selectedId, variables: values });
            if (selected.id !== selectedId || mode !== 'draft' || frozen || JSON.stringify(values) !== suggested)
                return;
            if (result.supported && result.action === 'accept') {
                values = { ...values, ...result.variables };
                fields.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(input => input.value = values[input.id.replace('variable-', '')] ?? (input.tagName === 'SELECT' ? 'text' : ''));
                renderPreview();
                validate();
                renderActions();
                ui.state('Rascunho', 'Valores revisados no formulário do ChatGPT. Confira a prévia antes do envio.');
            }
        }
        catch { /* Own accessible form remains available when native elicitation is unsupported. */ }
    }
    async function send() {
        if (sending || frozen || mode !== 'confirming' || !canSend())
            return;
        sending = true;
        frozen = true;
        ui.state('Enviando', 'Enviando uma única tentativa…');
        renderActions();
        let attempted = false;
        try {
            const current = (await call(bridge, 'get_conversation', { id: context.conversation.id })).data;
            if (JSON.stringify([current.id, current.contact_id, current.phone_number_id, current.contact?.wa_id, current.contact?.phone]) !== destination)
                throw new ScreenError('O destinatário ou a origem mudou. Reabra a revisão.', 'rejected');
            const fresh = (await call(bridge, 'get_template', { id: selected.id })).data;
            const freshReason = templateUnsupportedReason(fresh);
            if (freshReason) throw new ScreenError(freshReason, 'rejected');
            if (JSON.stringify([fresh.name, fresh.language, fresh.components]) !== definition || context.number?.waba_connection_id && fresh.waba_connection_id !== context.number.waba_connection_id)
                throw new ScreenError('O template mudou ou não está aprovado para este número. Reabra a revisão.', 'rejected');
            if (!key)
                key = (await call(bridge, 'prepare_send_intent', {})).idempotency_key;
            const payload = { to: current.contact?.wa_id || current.contact?.phone, from: current.phone_number_id, type: 'template', template: { name: fresh.name, language: { code: fresh.language }, components: templateParameters(fresh, values) }, idempotency_key: key };
            attempted = true;
            const receipt = await call(bridge, 'send_message', payload);
            if (!receipt.id && !receipt.wamid)
                throw new ScreenError('Recibo incompleto. Confira o histórico.');
            ui.state('Aceito', 'Template aceito pelo BotoZap; isso não confirma entrega ou leitura.');
        }
        catch (error) {
            const e = error as ScreenError;
            if (!attempted || e.outcome === 'rejected') {
                frozen = false;
                mode = 'draft';
                if (!attempted)
                    key = '';
                ui.state('Recusado', `${e.message} Revise os dados antes de uma nova confirmação.`);
                renderActions();
            }
            else
                ui.state('Incerto', 'Não foi possível confirmar o envio. Confira o histórico no painel BotoZap; repetir está bloqueado e a chave desta tentativa foi preservada.');
        }
        finally {
            sending = false;
            void bridge.context({ conversation_id: context.conversation.id, template_id: selected.id, state: root.dataset.state }).catch(() => { });
        }
    }
    async function load(data: Row) {
        context = data;
        destination = JSON.stringify([data.conversation.id, data.conversation.contact_id, data.conversation.phone_number_id, data.conversation.contact?.wa_id, data.conversation.contact?.phone]);
        skeleton(ui.content);
        try {
            if (!data.number)
                Object.assign(data, await call(bridge, 'stage_review_template', { conversation_id: data.conversation.id }));
            destination = JSON.stringify([data.conversation.id, data.conversation.contact_id, data.conversation.phone_number_id, data.conversation.contact?.wa_id, data.conversation.contact?.phone]);
            templates = [];
            let page = 1, total = 1;
            do {
                const result = await call(bridge, 'list_templates', { status: 'APPROVED', phone_number_id: data.conversation.phone_number_id, per_page: 100, page });
                templates.push(...result.data.filter((t: Row) => String(t.status).toUpperCase() === 'APPROVED'));
                total = result.meta.total_pages;
                page++;
            } while (page <= total && page <= 10);
            if (!templates.length) {
                ui.state('Sem templates', 'Nenhum template aprovado com prévia suportada neste número. Revise os templates no painel BotoZap.');
                ui.content.replaceChildren();
                return;
            }
            selector.replaceChildren(...templates.map(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = `${t.name} · ${t.language}${templateUnsupportedReason(t) ? ' · Não suportado' : ''}`; return o; }));
            selector.value = templates.some(t => t.id === data.preferred_template_id) ? data.preferred_template_id : templates[0]?.id;
            selector.onchange = () => void selectTemplate();
            for (const [name, value] of [['De', data.number?.display_phone_number || data.conversation.display_phone_number || 'Número de origem'], ['Para', `${data.conversation.contact?.name ?? 'Contato'} · ${data.conversation.contact?.phone ?? data.conversation.contact?.wa_id ?? ''}`]])
                metadata.append(node('dt', name), node('dd', value));
            const editor = node('div', '', 'template-editor');
            editor.append(fields, preview);
            ui.content.replaceChildren(metadata, label, selector, editor);
            await selectTemplate();
        }
        catch (error) {
            ui.content.replaceChildren();
            ui.state('Erro', (error as Error).message);
        }
    }
    if (initial)
        void load(initial);
    return { ...ui, bootstrap(result: Row) { if (result.isError) {
            ui.state('Erro', 'Não foi possível abrir os templates. Confira seu acesso.');
            return;
        } void load(result.structuredContent); } };
}
