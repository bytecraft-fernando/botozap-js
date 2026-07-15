/** Ferramentas de templates de mensagem. */
import { z } from "zod";
import type { CreateTemplateParams, ListTemplatesParams } from "@botozap/sdk";
import type { Register } from "../register.js";

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
    (client, args) => client.templates.list(args as ListTemplatesParams),
  );

  register(
    "get_template",
    "Busca um template pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do template (uuid interno).") },
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
    async (client, args) => ({
      data: await client.templates.create(args as unknown as CreateTemplateParams),
    }),
  );
}
