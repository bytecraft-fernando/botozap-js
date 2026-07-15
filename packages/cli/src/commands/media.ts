import { Command } from "commander";
import { context } from "./shared.js";
import { printJson, printDetail, printLine } from "../output.js";

export function registerMedia(program: Command): void {
  const media = program.command("media").description("Ingestão de mídia");

  media
    .command("ingest")
    .description("Ingere uma mídia a partir de uma URL")
    .requiredOption("--phone-number-id <id>", "número de origem (obrigatório)")
    .requiredOption("--source <url>", "URL pública da mídia (obrigatório)")
    .option("--filename <nome>", "nome do arquivo")
    .option("--mime-type <tipo>", "tipo MIME (ex.: image/jpeg)")
    .option("--delivery <modo>", "modo de entrega")
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
