/** Ferramentas de números de telefone (WABA): listar, ler, rótulo local e saúde. */
import { z } from "zod";
import type { ListPhoneNumbersParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import {
  getPhoneNumberResultSchema,
  listPhoneNumbersResultSchema,
  phoneNumberHealthResultSchema,
} from "../schemas.js";

export function registerPhoneNumberTools(register: Register): void {
  register(
    "list_phone_numbers",
    "Lista os números conectados da conta (paginação offset: { data, meta }; page é 1-based e per_page tem máximo 100). Em cada resultado, `id` é UUID interno do BotoZap e `phone_number_id` é o identificador da Meta. Filtro opcional por cliente.",
    {
      customer_id: z.string().optional().describe("Filtra pelos números de um cliente."),
      page: z.number().int().positive().optional().describe("Página (1-based)."),
      per_page: z.number().int().positive().optional().describe("Itens por página (máx. 100)."),
    },
    listPhoneNumbersResultSchema,
    (client, args) => client.phoneNumbers.list(args as ListPhoneNumbersParams),
  );

  register(
    "get_phone_number",
    "Busca um número pelo UUID interno do BotoZap ou pelo `phone_number_id` da Meta. Retorna { data }.",
    { id: z.string().describe("UUID interno do número ou `phone_number_id` da Meta.") },
    getPhoneNumberResultSchema,
    async (client, args) => ({ data: await client.phoneNumbers.get(String(args.id)) }),
  );

  register(
    "update_phone_number",
    "Atualiza somente o rótulo local (`label`) de um número, selecionado por UUID interno ou `phone_number_id` da Meta. `display_phone_number`, `verified_name` e `quality_rating` vêm da Meta e não são editáveis. Retorna { data }.",
    {
      id: z.string().describe("ID do número (uuid interno) ou phone_number_id da Meta."),
      label: z
        .string()
        .nullable()
        .describe(
          "Nome local: até 100 caracteres após aparar, sem quebras de linha nem caracteres de controle. null ou \"\" limpa.",
        ),
    },
    getPhoneNumberResultSchema,
    async (client, args) => ({
      data: await client.phoneNumbers.update(String(args.id), {
        label: args.label as string | null,
      }),
    }),
  );

  register(
    "phone_number_health",
    "Retorna a prontidão da conexão do número, motivo, próxima ação e verificações do token, usando UUID interno ou `phone_number_id` da Meta. A verificação pode consultar a conexão ativa na Meta e atualizar o estado da última checagem. Retorna { data }.",
    { id: z.string().describe("UUID interno do número ou `phone_number_id` da Meta.") },
    phoneNumberHealthResultSchema,
    async (client, args) => ({ data: await client.phoneNumbers.health(String(args.id)) }),
  );
}
