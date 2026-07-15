/** Ferramentas de números de telefone (WABA): listar, ler e saúde. */
import { z } from "zod";
import type { ListPhoneNumbersParams } from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerPhoneNumberTools(register: Register): void {
  register(
    "list_phone_numbers",
    "Lista os números de telefone conectados da conta (paginação offset: { data, meta }). Filtro opcional por cliente.",
    {
      customer_id: z.string().optional().describe("Filtra pelos números de um cliente."),
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    (client, args) => client.phoneNumbers.list(args as ListPhoneNumbersParams),
  );

  register(
    "get_phone_number",
    "Busca um número pelo id (uuid interno). Retorna { data }.",
    { id: z.string().describe("ID do número (uuid interno).") },
    async (client, args) => ({ data: await client.phoneNumbers.get(String(args.id)) }),
  );

  register(
    "phone_number_health",
    "Retorna a saúde/qualidade de um número (quality rating, status de verificação, limites). Retorna { data }.",
    { id: z.string().describe("ID do número (uuid interno).") },
    async (client, args) => ({ data: await client.phoneNumbers.health(String(args.id)) }),
  );
}
