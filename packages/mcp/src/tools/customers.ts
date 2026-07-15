/** Ferramentas de clientes (customers do dev) e seus links de setup. */
import { z } from "zod";
import type {
  CreateCustomerParams,
  UpdateCustomerParams,
  CreateSetupLinkParams,
  UpdateSetupLinkParams,
} from "@botozap/sdk";
import type { OffsetParams } from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerCustomerTools(register: Register): void {
  register(
    "list_customers",
    "Lista os clientes (customers) da conta (paginação offset: { data, meta }).",
    {
      // A rota (/v1/customers) só lê `page`/`per_page` (parseOffsetParams).
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    (client, args) => client.customers.list(args as OffsetParams),
  );

  register(
    "get_customer",
    "Busca um cliente pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do cliente (uuid interno).") },
    async (client, args) => ({ data: await client.customers.get(String(args.id)) }),
  );

  register(
    "create_customer",
    "Cria um cliente. Informe ao menos `name`. `external_customer_id` é opcional (sua referência externa). Retorna { data }.",
    {
      name: z.string().describe("Nome do cliente."),
      external_customer_id: z.string().optional().describe("Referência externa opcional."),
    },
    async (client, args) => ({
      data: await client.customers.create(args as CreateCustomerParams),
    }),
  );

  register(
    "update_customer",
    "Atualiza um cliente (name, external_customer_id). Retorna { data }.",
    {
      id: z.string().describe("ID do cliente (uuid interno)."),
      name: z.string().optional(),
      external_customer_id: z.string().optional(),
    },
    async (client, args) => {
      const { id, ...body } = args;
      return { data: await client.customers.update(String(id), body as UpdateCustomerParams) };
    },
  );

  register(
    "delete_customer",
    "Exclui um cliente pelo id (uuid interno).",
    { id: z.string().describe("ID do cliente (uuid interno).") },
    async (client, args) => {
      await client.customers.delete(String(args.id));
      return null;
    },
  );

  // ---- Links de setup (Embedded Signup) ----

  register(
    "list_setup_links",
    "Lista os links de setup de um cliente (paginação offset: { data, meta }).",
    {
      customer_id: z.string().describe("ID do cliente (uuid interno)."),
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    (client, args) => {
      const { customer_id, ...query } = args;
      return client.customers.listSetupLinks(String(customer_id), query as OffsetParams);
    },
  );

  register(
    "create_setup_link",
    "Cria um link de setup para um cliente. Opções: allowed_connection_types ('dedicated'|'coexistence'), provision_phone_number, language e redirects. Retorna { data }.",
    {
      customer_id: z.string().describe("ID do cliente (uuid interno)."),
      allowed_connection_types: z
        .array(z.enum(["dedicated", "coexistence"]))
        .optional()
        .describe("Modos de conexão permitidos."),
      provision_phone_number: z.boolean().optional(),
      language: z.string().optional().describe("Idioma (ou 'auto')."),
      success_redirect_url: z.string().optional(),
      failure_redirect_url: z.string().optional(),
    },
    async (client, args) => {
      const { customer_id, ...body } = args;
      return {
        data: await client.customers.createSetupLink(
          String(customer_id),
          body as CreateSetupLinkParams,
        ),
      };
    },
  );

  register(
    "update_setup_link",
    "Atualiza um link de setup (status, expires_at). Retorna { data }.",
    {
      customer_id: z.string().describe("ID do cliente (uuid interno)."),
      link_id: z.string().describe("ID do link de setup."),
      status: z.string().optional().describe("Novo status do link."),
      expires_at: z.string().optional().describe("Nova expiração (ISO 8601)."),
    },
    async (client, args) => {
      const { customer_id, link_id, ...body } = args;
      return {
        data: await client.customers.updateSetupLink(
          String(customer_id),
          String(link_id),
          body as UpdateSetupLinkParams,
        ),
      };
    },
  );
}
