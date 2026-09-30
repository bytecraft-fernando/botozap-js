import { quantity } from '../ui-helpers.js';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
export type DemoHost = 'chatgpt' | 'generic' | 'none';
export const hostLabel = (host: DemoHost) => host === 'chatgpt' ? 'ChatGPT' : host === 'generic' ? 'MCP Apps' : 'Assistente · sem UI';
export function hostStyles(host: DemoHost, theme: 'light' | 'dark'): McpUiHostContext['styles'] {
    if (host === 'chatgpt')
        return { variables: { '--color-background-inverse': '#a71d5d', '--color-text-inverse': '#ffffff' } as any };
    const dark = theme === 'dark';
    return { variables: { '--color-background-primary': dark ? '#252421' : '#faf8f3', '--color-background-secondary': dark ? '#302f2b' : '#f0ece3', '--color-background-tertiary': dark ? '#37352e' : '#e8e3d8', '--color-text-primary': dark ? '#f6f2e9' : '#302c24', '--color-text-secondary': dark ? '#c3bdb0' : '#625b4e', '--color-border-primary': dark ? '#605c50' : '#c9c1b2', '--color-ring-primary': dark ? '#e8d1a4' : '#5a4527', '--color-background-inverse': dark ? '#e8d1a4' : '#5a4527', '--color-text-inverse': dark ? '#252421' : '#ffffff', '--font-sans': 'Georgia, serif', '--border-radius-lg': '12px' } as any };
}
export function plainToolResponse(kind: string, result: Record<string, any>, tool: string) {
    if (result.isError)
        return `Não foi possível consultar ${tool}. Peça uma nova consulta ao assistente.`;
    const data = result.structuredContent;
    if (kind === 'carousel')
        return `${quantity(data?.data?.length ?? 0, 'pendência', 'pendências')} no Ateliê das Águas.\n` + (data?.data ?? []).map((row: any) => `${row.title}: ${row.next_step ?? row.reason_label ?? 'Confira a conversa.'}`).join('\n');
    if (tool === 'stage_review_reply')
        return `get_conversation: ${data?.conversation?.contact?.name ?? 'Contato'} · WhatsApp\nNúmero de origem: ${data?.conversation?.display_phone_number ?? 'não informado'}\n\nRascunho do assistente (sem UI):\n${data?.draft?.text ?? ''}\n\nRevise o destinatário e confirme o envio com o assistente; nada foi enviado.`;
    const baseTool = tool === 'open_review_panel' ? 'list_radar' : tool === 'open_agent_cases' ? 'ai_cases_list' : tool === 'stage_appointment_booking' ? 'get_appointment_availability' : tool === 'stage_review_template' ? 'list_templates' : tool;
    return `Resultado de ${baseTool} (dados estruturados disponíveis):\n${JSON.stringify(data?.cases ?? data?.availability ?? data, null, 2)}`;
}
