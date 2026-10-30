/** Ferramentas de templates de mensagem. */
import { z } from "zod";
import type { CreateTemplateParams, ListTemplatesParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import {
  fullTemplateResultSchema,
  listFullTemplatesResultSchema,
  templateSyncResultSchema,
} from "../schemas.js";

export function registerTemplateTools(register: Register): void {
  register(
    "list_templates",
    "Lista templates da conta (paginação offset: { data, meta }). Filtros opcionais por status, categoria e conexão WABA.",
    {
      status: z.string().optional().describe("Filtra por status (ex.: APPROVED, PENDING)."),
      category: z.string().optional().describe("Filtra por categoria (case-insensitive)."),
      waba_connection_id: z.string().optional(),
      phone_number_id: z.string().optional().describe("Resolve a conexão do número (Meta)."),
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    listFullTemplatesResultSchema,
    (client, args) => client.templates.list(args as ListTemplatesParams),
  );

  register(
    "get_template",
    "Busca um template pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do template (uuid interno).") },
    fullTemplateResultSchema,
    async (client, args) => ({ data: await client.templates.get(String(args.id)) }),
  );

  register(
    "create_template",
    "Cria um template e o submete à Meta. Informe name, language, category e components (array no formato da Cloud API). Aponte a conexão via waba_connection_id OU phone_number_id. Retorna { data }.",
    {
      name: z.string().describe("Nome do template (snake_case)."),
      language: z.string().describe("Código de idioma (ex.: pt_BR)."),
      category: z.string().describe("Categoria (MARKETING|UTILITY|AUTHENTICATION)."),
      components: z
        .array(z.record(z.string(), z.unknown()))
        .describe("Componentes do template (header/body/footer/buttons)."),
      waba_connection_id: z.string().optional(),
      phone_number_id: z.string().optional().describe("Resolve a conexão do número (Meta)."),
    },
    fullTemplateResultSchema,
    async (client, args) => ({
      data: await client.templates.create(args as unknown as CreateTemplateParams),
    }),
  );

  register(
    "update_template",
    "Marca quais botões de resposta rápida do template são de saída (`opt_out_buttons`, os textos dos botões; [] limpa a marcação). O toque do contato num botão marcado grava a recusa da finalidade do template (marketing ou avisos); botão não marcado não muda nada, qualquer que seja o texto. Anotação do BotoZap: não altera o template na Meta. Texto que não é botão de resposta rápida do template responde invalid_request. Exige scope templates:write. Retorna { data }.",
    {
      id: z.string().describe("ID do template (uuid interno)."),
      opt_out_buttons: z
        .array(z.string())
        .max(10)
        .describe("Textos dos botões de resposta rápida que são de saída (até 10); [] limpa a marcação."),
    },
    fullTemplateResultSchema,
    async (client, args) => ({
      data: await client.templates.update(String(args.id), {
        opt_out_buttons: args.opt_out_buttons as string[],
      }),
    }),
  );

  register(
    "sync_templates",
    "O Sincronizar da tela de Templates: traz da Meta status, categoria, conteúdo e rejection_reason dos templates das conexões ativas (ou só de um Cliente, com customer_id), importa os criados direto no WhatsApp Manager e tira daqui os excluídos lá. Use quando um status parecer parado (ex.: PENDING muito depois do normal): avisos de status da Meta podem se perder, e a listagem traz o estado real. Devolve connections, synced, removed, skipped_without_token (conexões sem autorização, reconecte o número) e automations_outdated. Autorização recusada pela Meta responde 409 reconnect_required. Exige scope templates:write. Retorna { data }.",
    { customer_id: z.string().uuid().optional().describe("Só as conexões deste Cliente (uuid).") },
    templateSyncResultSchema,
    async (client, args) => ({
      data: await client.templates.sync(args.customer_id ? { customer_id: String(args.customer_id) } : {}),
    }),
  );
}
