import type { BotoZap } from "../client.js";
import type { MediaAsset, MediaUploadResult } from "../types.js";

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

  /**
   * Busca os metadados de uma mídia RECEBIDA pelo `media_id` da Cloud API,
   * incluindo `download_url` — uma URL assinada e efêmera que você pode baixar
   * direto (GET), válida até `expires_at`.
   *
   * A mídia é espelhada de forma assíncrona; se você consultar antes de terminar,
   * a rota responde 202 e este método lança `BotoZapError` com
   * `code: "media_not_ready"`. Nesse caso, aguarde e retente — o segundo que faltar
   * está em `err.headers?.["retry-after"]`:
   *
   * ```ts
   * try {
   *   const media = await boto.media.get("wamid_media_id");
   *   // baixe media.download_url direto
   * } catch (err) {
   *   if (err instanceof BotoZapError && err.code === "media_not_ready") {
   *     const wait = Number(err.headers?.["retry-after"] ?? 5);
   *     // retente após `wait` segundos
   *   }
   * }
   * ```
   *
   * Existe também `GET /v1/media/:id/download`, que responde 302 redirecionando
   * para a mesma URL assinada; não há método SDK dedicado porque `download_url`
   * (acima) já entrega essa URL sem o hop de redirect.
   */
  get(id: string): Promise<MediaAsset> {
    return this.client.requestItem<MediaAsset>(
      "GET",
      `/media/${encodeURIComponent(id)}`,
    );
  }
}
