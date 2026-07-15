import type { BotoZap } from "../client.js";
import type { MediaUploadResult } from "../types.js";

/** Corpo do `POST /v1/media` — espelha o contrato real da rota. */
export interface UploadMediaParams {
  /** URL http(s) de origem do arquivo. A BotoZap baixa (com guard SSRF) e sobe pra Cloud API. */
  source: string;
  /** phone_number_id (da Meta) do número de origem. Obrigatório. */
  phone_number_id: string;
  /** Nome do arquivo (default: derivado da URL). */
  filename?: string;
  /** MIME type (default: Content-Type do download). */
  mime_type?: string;
  /** Pipeline de upload: `meta_media` (default) ou `meta_resumable_asset`. */
  delivery?: "meta_media" | "meta_resumable_asset";
  [key: string]: unknown;
}

/** Mídia: sobe um arquivo e devolve um media_id usável em mensagens. */
export class Media {
  constructor(private readonly client: BotoZap) {}

  upload(params: UploadMediaParams): Promise<MediaUploadResult> {
    return this.client.requestItem<MediaUploadResult>("POST", "/media", {
      body: params,
    });
  }
}
