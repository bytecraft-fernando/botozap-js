/** Ferramentas de envio e ingest de mídia a partir de uma URL. */
import { z } from "zod";
import type { UploadMediaParams } from "@botozap/sdk";
import type { Register } from "../register.js";
import {
  mediaUploadResultSchema,
  sendMessageResultSchema,
} from "../schemas.js";

const MEDIA_LINK_MAX = 2048;
const MEDIA_CAPTION_MAX = 1024;
const MEDIA_FILENAME_MAX = 240;

const sendMediaShape = {
  to: z
    .string()
    .describe("Destinatário: telefone E.164 (ex.: 5511999999999) ou wa_id."),
  from: z
    .string()
    .optional()
    .describe("ID Meta ou UUID interno do Número de origem (obrigatório se a conta tem >1 número)."),
  type: z
    .enum(["image", "video", "audio", "document"])
    .describe("Tipo da mídia a enviar."),
  link: z
    .string()
    .trim()
    .max(MEDIA_LINK_MAX)
    .url()
    .regex(/^https:\/\//)
    .describe("URL https pública do arquivo; o BotoZap delega o download à Meta."),
  caption: z
    .string()
    .trim()
    .min(1)
    .max(MEDIA_CAPTION_MAX)
    .optional()
    .describe("Legenda para image, video ou document; audio não aceita."),
  filename: z
    .string()
    .max(MEDIA_FILENAME_MAX)
    .optional()
    .describe("Nome do arquivo; aceito somente quando type='document'."),
} as const;

const commonMediaShape = {
  to: sendMediaShape.to,
  from: sendMediaShape.from,
  link: sendMediaShape.link,
} as const;
const noCaption = z
  .never({ invalid_type_error: "type='audio' não aceita caption." })
  .optional();
const noFilename = z
  .never({
    invalid_type_error: "filename é aceito somente quando type='document'.",
  })
  .optional();

/**
 * Union forte usada pelo handler: cada discriminante aceita somente seus
 * campos. O MCP SDK 1.29 não anuncia union/effect na raiz (degrada para `{}`),
 * então o raw shape documentado acima continua no registerTool e esta union
 * valida as regras cruzadas antes de qualquer request, preservando isError
 * estruturado.
 */
export const sendMediaSchema = z.discriminatedUnion("type", [
  z.object({
    ...commonMediaShape,
    type: z.literal("image"),
    caption: sendMediaShape.caption,
    filename: noFilename,
  }),
  z.object({
    ...commonMediaShape,
    type: z.literal("video"),
    caption: sendMediaShape.caption,
    filename: noFilename,
  }),
  z.object({
    ...commonMediaShape,
    type: z.literal("audio"),
    caption: noCaption,
    filename: noFilename,
  }),
  z.object({
    ...commonMediaShape,
    type: z.literal("document"),
    caption: sendMediaShape.caption,
    filename: sendMediaShape.filename,
  }),
]);

export function registerMediaTools(register: Register): void {
  register(
    "send_media_message",
    "Envia image, video, audio ou document por URL https pelo endpoint canônico de mensagens. image/video/document aceitam caption; audio não. filename é exclusivo de document. O processo MCP não baixa o arquivo. Retorna { id, wamid, to, status }.",
    sendMediaShape,
    sendMessageResultSchema,
    (client, args) => {
      const parsed = sendMediaSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
      }
      return client.messages.sendMedia(parsed.data);
    },
  );

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
    mediaUploadResultSchema,
    async (client, args) => ({
      data: await client.media.upload(args as unknown as UploadMediaParams),
    }),
  );
}
