import { Command } from "commander";
import { context } from "./shared.js";
import { printJson, printDetail, printLine } from "../output.js";

export function registerMedia(program: Command): void {
  const media = program
    .command("media")
    .description("Ingestão de mídia no WhatsApp (para enviar mídia, inclusive no Instagram, use `messages send-media`)");

  media
    .command("ingest")
    .description(
      "Ingere uma mídia a partir de uma URL e a sobe para a Meta pelo Número do WhatsApp (não envia mensagem; o Instagram não usa ingestão: envie por `messages send-media --link`)",
    )
    .requiredOption("--phone-number-id <id>", "phone_number_id (Meta) do Número do WhatsApp dono da mídia (obrigatório)")
    .requiredOption("--source <url>", "URL pública da mídia (obrigatório)")
    .option("--filename <nome>", "nome do arquivo")
    .option("--mime-type <tipo>", "tipo MIME (ex.: image/jpeg)")
    .option("--delivery <modo>", "meta_media (padrão; media_id) | meta_resumable_asset (handle para template)")
    .action(async (opts, cmd: Command) => {
      const { client, format } = context(cmd);
      const data = await client.media.upload({
        phone_number_id: opts.phoneNumberId,
        source: opts.source,
        filename: opts.filename,
        mime_type: opts.mimeType,
        // A rota valida o valor; aqui só repassamos a string do flag.
        delivery: opts.delivery as
          | "meta_media"
          | "meta_resumable_asset"
          | undefined,
      });
      if (format === "json") return printJson(data);
      printLine("Mídia ingerida.");
      printDetail(data as unknown as Record<string, unknown>);
    });
}
