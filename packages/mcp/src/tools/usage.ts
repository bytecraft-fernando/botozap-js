/** Ferramentas de uso e custos da conta. */
import { z } from "zod";
import type { MetaCostsParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import { metaCostsResultSchema } from "../schemas.js";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.");

export function registerUsageTools(register: Register): void {
  register(
    "get_meta_costs",
    "Custo APROXIMADO da Meta (Pricing Analytics, sincronizada 1×/dia por WABA) por moeda, dia e categoria. Moedas nunca são somadas. Custo que a Meta não devolveu vem null (nunca 0) com unavailable/unavailable_reason; estimated_cost soma volume × tarifa publicada onde faltou custo. A fatura da Meta é a autoridade. Sandbox fica de fora. Retorna { data }.",
    {
      customer_id: z
        .string()
        .optional()
        .describe("Recorta pelas WABAs de um Cliente (uuid interno); sem ele, a Conta inteira."),
      from: day.optional().describe("Primeiro dia UTC, inclusivo (YYYY-MM-DD). Padrão: 29 dias antes de `to`."),
      to: day.optional().describe("Último dia UTC, inclusivo (YYYY-MM-DD). Padrão: hoje. Intervalo máximo de 366 dias."),
    },
    metaCostsResultSchema,
    async (client, args) => ({
      data: await client.usage.metaCosts(args as MetaCostsParams),
    }),
  );
}
