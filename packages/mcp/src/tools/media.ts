/** Ferramenta de ingest de mídia a partir de uma URL. */
import { z } from "zod";
import type { UploadMediaParams } from "@botozap/sdk";
import type { Register } from "../register.js";

export function registerMediaTools(register: Register): void {
  register(
    "ingest_media",
    "Faz o ingest de uma mídia a partir de uma URL para a Meta. delivery='meta_media' (default) retorna um media_id usável em mensagens; delivery='meta_resumable_asset' retorna um handle reutilizável (ex.: header de template). Retorna { data }.",
    {
      phone_number_id: z.string().describe("phone_number_id (Meta) dono da mídia."),
      source: z.string().describe("URL de origem da mídia (https)."),
      filename: z.string().optional(),
      mime_type: z.string().optional().describe("Force o mime (ex.: image/png); senão é inferido."),
      delivery: z
        .enum(["meta_media", "meta_resumable_asset"])
        .optional()
        .describe("Forma de entrega à Meta (default meta_media)."),
    },
    async (client, args) => ({
      data: await client.media.upload(args as unknown as UploadMediaParams),
    }),
  );
}
