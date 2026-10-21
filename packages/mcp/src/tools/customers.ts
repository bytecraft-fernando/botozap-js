/** Ferramentas de clientes (customers do dev) e seus links de setup. */
import { z } from "zod";
import type {
  CreateCustomerParams,
  UpdateCustomerParams,
  CreateSetupLinkParams,
  UpdateSetupLinkParams,
} from "@botozap/sdk";
import type { OffsetParams } from "@botozap/sdk";
import { emptyOperationResult, type Register } from "../register.js";
import {
  emptyOperationResultSchema,
  fullCustomerResultSchema,
  listFullCustomersResultSchema,
  listSetupLinksResultSchema,
  setupLinkResultSchema,
} from "../schemas.js";

export function registerCustomerTools(register: Register): void {
  register(
    "list_customers",
    "Lista os clientes (customers) da conta (paginação offset: { data, meta }).",
    {
      // A rota (/v1/customers) só lê `page`/`per_page` (parseOffsetParams).
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    listFullCustomersResultSchema,
    (client, args) => client.customers.list(args as OffsetParams),
  );

  register(
    "get_customer",
    "Busca um cliente pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do cliente (uuid interno).") },
    fullCustomerResultSchema,
    async (client, args) => ({ data: await client.customers.get(String(args.id)) }),
  );

  register(
    "create_customer",
    "Cria um cliente. Informe ao menos `name`. `external_customer_id` é opcional (sua referência externa). No plano Free, que permite 1 Cliente (com canal ou não), o segundo responde 402 free_cap: assine para cadastrar mais. Retorna { data }.",
    {
      name: z.string().describe("Nome do cliente."),
      external_customer_id: z.string().optional().describe("Referência externa opcional."),
    },
    fullCustomerResultSchema,
    async (client, args) => ({
      data: await client.customers.create(args as CreateCustomerParams),
    }),
  );

  register(
    "update_customer",
    "Atualiza um cliente: name, external_customer_id e as regras de recusa e volta do contato. `opt_out_keywords` (Palavras de saída) fazem o contato recusar mensagens quando ele as manda; `opt_in_keywords` (Palavras de volta) fazem o contato voltar a aceitar; `opt_out_confirmation` e `opt_in_confirmation` são os textos que ele recebe. Não existe lista padrão: só valem as palavras cadastradas. Lista enviada substitui a anterior ([] limpa) e campo ausente fica como está; a mesma palavra não pode estar nas duas listas (invalid_request). Retorna { data }.",
    {
      id: z.string().describe("ID do cliente (uuid interno)."),
      name: z.string().optional(),
      external_customer_id: z.string().optional(),
      opt_out_keywords: z
        .array(z.string())
        .max(40)
        .optional()
        .describe("Palavras de saída (até 40, de até 40 caracteres cada); [] limpa."),
      opt_in_keywords: z
        .array(z.string())
        .max(40)
        .optional()
        .describe("Palavras de volta (até 40, de até 40 caracteres cada); [] limpa."),
      opt_out_confirmation: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .describe("Texto enviado ao contato que recusa (até 500 caracteres)."),
      opt_in_confirmation: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .describe("Texto enviado ao contato que volta a aceitar (até 500 caracteres)."),
    },
    fullCustomerResultSchema,
    async (client, args) => {
      const { id, ...body } = args;
      return { data: await client.customers.update(String(id), body as UpdateCustomerParams) };
    },
  );

  register(
    "delete_customer",
    "Exclui um cliente pelo id (uuid interno).",
    { id: z.string().describe("ID do cliente (uuid interno).") },
    emptyOperationResultSchema,
    async (client, args) => {
      await client.customers.delete(String(args.id));
      return emptyOperationResult();
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
    listSetupLinksResultSchema,
    (client, args) => {
      const { customer_id, ...query } = args;
      return client.customers.listSetupLinks(String(customer_id), query as OffsetParams);
    },
  );

  register(
    "create_setup_link",
    "Cria um link de setup para um cliente; envie a `url` devolvida ao cliente. Cada link conecta um canal só: channel 'whatsapp' (padrão; Embedded Signup) ou 'instagram' (o cliente confirma que a conta é profissional e que as mensagens estão liberadas e entra com o Instagram; numa falha, a página oferece voltar para failure_redirect_url com status=cancelled). No Instagram, allowed_connection_types não vale: enviar responde 422 invalid_connection_types, e o link volta com allowed_connection_types [] e url em /instagram/setup/<token>. whatsapp_setup_status vale para os dois canais. Opções: allowed_connection_types ('dedicated'|'coexistence', só WhatsApp) e redirects; language é aceito por compatibilidade e ignorado (a página é sempre em português). Redirects só em estado final: sucesso → success_redirect_url com setup_link_id e status=completed; link esgotado → failure_redirect_url com status=failed; cliente volta num erro recuperável → failure_redirect_url com status=cancelled (o link segue válido). A query da URL é preservada e o token nunca é enviado. URLs precisam ser https, sem usuário/senha, até 2048 caracteres (senão 422 invalid_redirect_url). Retorna { data }.",
    {
      customer_id: z.string().describe("ID do cliente (uuid interno)."),
      channel: z
        .enum(["whatsapp", "instagram"])
        .optional()
        .describe(
          "Canal que o link conecta (padrão: whatsapp). Cada link conecta um canal só.",
        ),
      allowed_connection_types: z
        .array(z.enum(["dedicated", "coexistence"]))
        .optional()
        .describe(
          "Só WhatsApp: modos de conexão permitidos (padrão: dedicated). Não envie com channel 'instagram' (422 invalid_connection_types).",
        ),
      language: z
        .string()
        .optional()
        .describe(
          "Aceito por compatibilidade e ignorado: a página do link é sempre em português (o link volta com language null).",
        ),
      success_redirect_url: z
        .string()
        .optional()
        .describe(
          "URL https (sem usuário/senha, até 2048 caracteres) para onde o cliente vai ao concluir; recebe setup_link_id e status=completed.",
        ),
      failure_redirect_url: z
        .string()
        .optional()
        .describe(
          "URL https (sem usuário/senha, até 2048 caracteres) para link esgotado (status=failed) ou quando o cliente volta num erro recuperável (status=cancelled; o link segue válido); recebe setup_link_id.",
        ),
    },
    setupLinkResultSchema,
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
    setupLinkResultSchema,
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
