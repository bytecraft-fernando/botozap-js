/** Ferramentas diversas: logs de API e usuários da conta. */
import { z } from "zod";
import type { ListApiLogsParams } from "@botozap/sdk";
import type { OffsetParams } from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerMiscTools(register: Register): void {
  register(
    "list_api_logs",
    "Lista os logs de requisições à API pública da conta (auditoria). Paginação por cursor: { data, paging }.",
    {
      // Filtros reais da rota (/v1/api_logs): source, method e status_code.
      source: z.string().optional().describe("Origem do log (ex.: api)."),
      method: z.string().optional().describe("Método HTTP (normalizado p/ maiúsculas)."),
      status_code: z.number().int().optional().describe("Código HTTP exato (inteiro)."),
      limit: z.number().int().positive().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    },
    (client, args) => client.apiLogs.list(args as ListApiLogsParams),
  );

  register(
    "list_users",
    "Lista os usuários (membros) da conta. Paginação offset: { data, meta }.",
    {
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    (client, args) => client.users.list(args as OffsetParams),
  );
}
