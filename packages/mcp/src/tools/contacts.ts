/** Ferramentas de contatos (end users do WhatsApp): CRUD. */
import { z } from "zod";
import type { ListContactsParams, CreateContactParams } from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerContactTools(register: Register): void {
  register(
    "list_contacts",
    "Lista contatos da conta (paginação por cursor: { data, paging }). Filtros opcionais por cliente, presença de cliente, busca parcial em nome/wa_id e janela de criação.",
    {
      customer_id: z.string().optional().describe("Filtra pelos números do cliente (derivado)."),
      has_customer: z
        .boolean()
        .optional()
        .describe("Nesta base todo contato tem cliente: false → vazio, true → no-op."),
      profile_name_contains: z.string().optional().describe("Busca parcial (ilike) no nome de perfil."),
      wa_id_contains: z.string().optional().describe("Busca parcial (ilike) no wa_id."),
      created_after: z.string().optional().describe("Criados em ou após esta data (ISO 8601)."),
      created_before: z.string().optional().describe("Criados em ou antes desta data (ISO 8601)."),
      limit: z.number().int().positive().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    },
    (client, args) => client.contacts.list(args as ListContactsParams),
  );

  register(
    "get_contact",
    "Busca um contato pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do contato (uuid interno).") },
    async (client, args) => ({ data: await client.contacts.get(String(args.id)) }),
  );

  register(
    "create_contact",
    "Cria um contato. O contato é sempre atado a um phone_number e único por (phone_number_id, wa_id). `wa_id` (BSUID ou E.164) é a chave canônica. Informe phone_number_id (Meta) OU customer_id para resolver o número.",
    {
      wa_id: z.string().describe("Identidade canônica: BSUID (BR.1A2B...) ou dígitos E.164."),
      phone_number_id: z.string().optional().describe("phone_number_id (Meta) ao qual atar."),
      customer_id: z.string().optional().describe("Cliente cujo número será usado."),
      profile_name: z.string().optional(),
      phone: z.string().optional(),
      user_id: z.string().optional().describe("BSUID do usuário."),
      username: z.string().optional(),
      parent_user_id: z.string().optional(),
    },
    async (client, args) => ({
      data: await client.contacts.create(args as CreateContactParams),
    }),
  );

  register(
    "update_contact",
    "Atualiza um contato (campos editáveis: profile_name, username). Retorna { data }.",
    {
      id: z.string().describe("ID do contato (uuid interno)."),
      profile_name: z.string().optional(),
      username: z.string().optional(),
    },
    async (client, args) => {
      const { id, ...body } = args;
      return { data: await client.contacts.update(String(id), body) };
    },
  );

  register(
    "delete_contact",
    "Exclui um contato pelo id (uuid interno).",
    { id: z.string().describe("ID do contato (uuid interno).") },
    async (client, args) => {
      // A rota responde 204 (sem corpo); preservamos o retorno `null` do MCP
      // legado (JSON.stringify(null) === "null").
      await client.contacts.delete(String(args.id));
      return null;
    },
  );
}
