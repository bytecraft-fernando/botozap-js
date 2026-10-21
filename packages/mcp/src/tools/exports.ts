/** Ferramentas de exportação de dados da Conta (`/v1/exports`). */
import { z } from "zod";
import type { CreateExportParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import { exportResultSchema, listExportsResultSchema } from "../schemas.js";

export function registerExportTools(register: Register): void {
  register(
    "create_export",
    "Pede a exportação completa dos dados da Conta, ou de um Cliente (`customer_id`). O arquivo é gerado em fila, fica 7 dias e vem num zip com um arquivo por tipo de dado, em json (padrão) ou csv. Pedido igual enquanto o anterior ainda está na fila devolve o mesmo pedido. Depois acompanhe com get_export até status 'ready' e use `download.url`. Funciona mesmo com a Conta em somente leitura por exclusão. Recusas: not_found (Cliente), account_deletion_in_progress (a exclusão já começou), rate_limited. Exige scope exports:write (só chave de API). Retorna { data } com o pedido.",
    {
      customer_id: z
        .string()
        .uuid()
        .optional()
        .describe("Exporta só este Cliente (uuid interno); sem ele, a Conta inteira."),
      format: z.enum(["json", "csv"]).optional().describe("json (padrão) ou csv."),
    },
    exportResultSchema,
    async (client, args) => ({
      data: await client.exports.create(args as CreateExportParams),
    }),
  );

  register(
    "list_exports",
    "Lista os últimos pedidos de exportação da Conta (até 50), do mais novo ao mais antigo, sem o link de download (use get_export). Exige scope exports:read (só chave de API). Retorna { data: [...] }.",
    {},
    listExportsResultSchema,
    async (client) => ({ data: await client.exports.list() }),
  );

  register(
    "get_export",
    "Estado de um pedido de exportação e, quando está pronto (status 'ready') e dentro do prazo, `download.url`: um link assinado que vale poucos minutos (`download.expires_in`, em segundos); cada consulta gera um link novo. O link dá acesso aos dados da Conta: não o repasse nem o registre. Exige scope exports:read (só chave de API). Retorna { data }.",
    { id: z.string().uuid().describe("UUID do pedido de exportação (veja list_exports).") },
    exportResultSchema,
    async (client, args) => ({ data: await client.exports.get(String(args.id)) }),
  );
}
