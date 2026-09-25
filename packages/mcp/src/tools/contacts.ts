/** Ferramentas de contatos (end users do WhatsApp): CRUD. */
import { z } from "zod";
import type { ListContactsParams, CreateContactParams } from "@botozap/sdk";
import { emptyOperationResult, type Register } from "../register.js";
import {
  contactResultSchema,
  emptyOperationResultSchema,
  listContactsResultSchema,
} from "../schemas.js";

/** Limites finais (20 × 40) são validados pelo servidor após aparar e remover repetidas. */
const tagList = z.array(z.string().max(200)).max(200);

/** O servidor apara e valida 1–200 caracteres; null ou "" não grava nome. */
const displayName = z
  .string()
  .nullable()
  .describe(
    "Nome que a empresa dá ao Contato (1–200 caracteres). null ou \"\" limpa. Independe de profile_name, que vem do canal.",
  );

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
    listContactsResultSchema,
    (client, args) => client.contacts.list(args as ListContactsParams),
  );

  register(
    "get_contact",
    "Busca um contato pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do contato (uuid interno).") },
    contactResultSchema,
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
      display_name: displayName.optional(),
      phone: z.string().optional(),
      user_id: z.string().optional().describe("BSUID do usuário."),
      username: z.string().optional(),
      parent_user_id: z.string().optional(),
      tags: tagList.optional().describe(
        "Até 20 tags de 1–40 caracteres; repetidas (sem diferenciar maiúsculas) são removidas.",
      ),
    },
    contactResultSchema,
    async (client, args) => ({
      data: await client.contacts.create(args as CreateContactParams),
    }),
  );

  register(
    "update_contact",
    "Atualiza um contato (campos editáveis: profile_name, display_name, username, tags). `display_name: null` limpa o nome dado pela empresa. `tags` substitui a lista inteira; `add_tags`/`remove_tags` alteram a lista atual. Não combine `tags` com `add_tags`/`remove_tags`. Retorna { data }.",
    {
      id: z.string().describe("ID do contato (uuid interno)."),
      profile_name: z.string().optional(),
      display_name: displayName.optional(),
      username: z.string().optional(),
      tags: tagList.optional().describe("Substitui todas as tags (até 20 × 40 caracteres)."),
      add_tags: tagList.optional().describe("Acrescenta tags à lista atual."),
      remove_tags: tagList.optional().describe("Remove tags da lista atual (sem diferenciar maiúsculas)."),
    },
    contactResultSchema,
    async (client, args) => {
      const { id, ...body } = args;
      return { data: await client.contacts.update(String(id), body) };
    },
  );

  register(
    "delete_contact",
    "Exclui um contato pelo id (uuid interno).",
    { id: z.string().describe("ID do contato (uuid interno).") },
    emptyOperationResultSchema,
    async (client, args) => {
      // A rota responde 204 (sem corpo); preservamos o retorno `null` do MCP
      // legado (JSON.stringify(null) === "null").
      await client.contacts.delete(String(args.id));
      return emptyOperationResult();
    },
  );
}
