import './template.css';
import { templateFieldName, technicalTemplateField, templateModelSummary } from './template-language.js';
import type { Bridge } from '../panel.js';
import { templateFields, templateParameters, validateTemplateValues, templateUnsupportedReason } from '../../src/template-preview.js';
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
    const edit = document.createElement('details'); edit.className = 'template-edit'; edit.append(node('summary', 'Editar campos'), fields);
    const notices = node('div', '', 'template-missing'); notices.setAttribute('aria-live','polite');
    function modelContext() { if (selected && !templateUnsupportedReason(selected)) void bridge.context({ ...templateModelSummary(selected, values, context.conversation.id, context.media_metadata), preview: preview.textContent, review_state: frozen ? root.dataset.state : mode }).catch(() => {}); }
    const metadata = node('dl', '', 'screen-metadata');
    const validation = node('p', '', 'template-validation');
    validation.setAttribute('role', 'status');
    validation.setAttribute('aria-live', 'polite');
    function renderPreview() { preview.replaceChildren(renderTemplatePreview(selected, values, context.media_metadata ?? {})); }
    function canSend() { return !frozen && !Object.keys(validateTemplateValues(selected, values)).length; }
    function validate() { const errors = validateTemplateValues(selected, values); validation.textContent = ''; notices.replaceChildren(); for (const k of Object.keys(errors)) { const f = templateFields(selected).find(f => f.key === k || k === f.key.replace(/media(_id)?$/, 'media')); const text = f ? `${values[f.key]?.trim() ? 'Confira' : 'Falta'} ${templateFieldName(selected,f).toLowerCase()}${f.card === undefined ? '' : ` do card ${f.card+1}`}` : 'Confira os dados da mensagem'; const shortcut = button(text, () => { edit.open = true; const input = root.querySelector<HTMLInputElement>(`#variable-${f?.key ?? k}`); for (let parent = input?.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.setAttribute('open',''); input?.focus(); }); shortcut.title = text; notices.append(shortcut); } for (const f of templateFields(selected)) {
        const input = root.querySelector<HTMLInputElement>(`#variable-${f.key}`);
        if (input) {
            input.setAttribute('aria-invalid', String(!!errors[f.key]));
            input.setAttribute('aria-describedby', `error-${f.key}`);
            root.querySelector(`#error-${f.key}`)!.textContent = errors[f.key] ? (values[f.key]?.trim() ? errors[f.key]!.replace(f.label.toLowerCase(), templateFieldName(selected,f).toLowerCase()) : `Preencha ${templateFieldName(selected,f).toLowerCase()}.`) : '';
        }
    } }
    function renderActions() {
        ui.actions.replaceChildren();
        modelContext();
        if (frozen)
            return;
        if (mode === 'confirming') {
            ui.actions.append(button('Editar', () => { mode = 'draft'; ui.state('Rascunho'); renderActions(); }), button('Enviar template', () => void send(), true));
        }
        else {
            const review = button('Revisar envio', () => { if (!canSend())
                return; mode = 'confirming'; root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select[id^=variable-]').forEach(i => i.disabled = true); selector.disabled = true; ui.state('Confirmando', 'Confira De, Para e a prévia; Enviar template enviará esta mensagem ao cliente.'); renderActions(); if (root.dataset.mode === 'fullscreen')
                ui.actions.scrollIntoView({ block: 'center' }); }, true);
            review.disabled = !canSend();
            ui.actions.append(review);
        }
        if (mode === 'draft') {
            root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select[id^=variable-]').forEach(i => i.disabled = false);
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
        fields.replaceChildren(); edit.open = false;
        root.querySelector('.template-auth-code')?.remove();
        const reason = templateUnsupportedReason(selected);
        if (reason) { preview.replaceChildren(); notices.replaceChildren(); edit.hidden = true; ui.actions.replaceChildren(); ui.state('Não suportado', reason); return; }
        const name = context.conversation.contact?.name?.split(' ')[0] ?? '';
        const groups = new Map<string, { simple: HTMLElement; advanced: HTMLDetailsElement }>();
        for (const f of templateFields(selected)) {
            const groupId = f.card === undefined ? 'Mensagem' : `Card ${f.card + 1}`;
            if (!groups.has(groupId)) { const simple = node('section', '', 'template-field-group'); const advanced = document.createElement('details'); advanced.className = 'template-advanced'; advanced.append(node('summary','Avançado')); simple.append(node('h2', groupId), advanced); fields.append(simple); groups.set(groupId,{simple,advanced}); }
            const group = groups.get(groupId)!;
            values[f.key] = context.suggested_values?.[selected.id]?.[f.key] ?? (f.section === 'body' && f.kind === 'text' && ['1', 'name', 'nome', 'customer_name'].includes(f.variable) && f.card === undefined ? name : f.kind === 'otp' || f.kind === 'media' || f.kind === 'media_id' ? '' : String(f.example ?? ''));
            const human = templateFieldName(selected, f);
            const title = f.kind === 'media_id' ? 'Identificador do arquivo existente' : f.kind === 'media' ? 'Endereço HTTPS público do arquivo' : human;
            const input = field(`${title}${f.required ? '' : ' (opcional)'}`, values[f.key], `variable-${f.key}`);
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
                return; values[f.key] = input.input.value; key = ''; renderPreview(); validate(); renderActions(); modelContext(); };
            if (f.kind === 'otp') { const auth = node('section','','template-auth-code'); auth.append(node('p','Use um código emitido pelo sistema do negócio. O BotoZap não gera nem valida esse código.','template-help'),input.wrapper); preview.after(auth); }
            else if (technicalTemplateField(f)) group.advanced.append(input.wrapper); else group.simple.insertBefore(input.wrapper,group.advanced);
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
                            control.input.oninput = () => { values[valueKey] = control.input.value; key = ''; renderPreview(); validate(); renderActions(); modelContext(); };
                            extra.append(control.wrapper);
                        }
                    key = '';
                    renderPreview();
                    validate();
                    renderActions(); modelContext();
                };
                group.advanced.append(advanced);
            }
        }
        for (const group of groups.values()) if (group.simple.children.length === 2 && group.advanced.children.length === 1) group.simple.remove();
        edit.hidden = !fields.children.length;
        fields.append(validation);

        if (templateFields(selected).some(f => f.kind === 'media'))
            fields.append(node('p', 'Mídia: informe URL HTTPS pública ou media_id de upload existente. A prévia não baixa arquivos; URLs ficam protegidas.', 'template-help'));
        renderPreview();
        validate();
        renderActions();
        modelContext();
        ui.state('Rascunho', 'Valores sugeridos. Confira antes de enviar; template aprovado não elimina a necessidade de revisar o conteúdo.');

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
            metadata.replaceChildren();
            for (const [name, value] of [['De', data.number?.display_phone_number || data.conversation.display_phone_number || 'Número de origem'], ['Para', `${data.conversation.contact?.name ?? 'Contato'} · ${data.conversation.contact?.phone ?? data.conversation.contact?.wa_id ?? ''}`]])
                metadata.append(node('dt', name), node('dd', value));
            const editor = node('div', '', 'template-editor');
            editor.append(preview, notices, node('p','Peça ajustes na conversa ou edite os campos.','template-help'), edit);
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
    return { ...ui, bootstrap(result: Row) {
        const incoming = result.structuredContent;
        if (context && incoming?.conversation?.id === context.conversation.id && incoming.suggested_values && selected) {
            if (frozen || mode !== 'draft' || templateUnsupportedReason(selected)) return;
            if (incoming.preferred_template_id && incoming.preferred_template_id !== selected.id) { void load(incoming); return; }
            values = { ...values, ...incoming.suggested_values[selected.id] }; key = '';
            context.media_metadata = incoming.media_metadata ?? context.media_metadata;
            root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select[id^=variable-]').forEach(input => { input.value = values[input.id.replace('variable-','')] ?? ''; });
            renderPreview(); validate(); renderActions(); modelContext(); ui.state('Rascunho','Prévia atualizada. Confira antes de enviar.'); return;
        } if (result.isError) {
            ui.state('Erro', 'Não foi possível abrir os templates. Confira seu acesso.');
            return;
        } void load(result.structuredContent); } };
}
