import { BotoZapError } from "../../errors.js";
import type { BotoZap } from "../../client.js";
import type { AiPreparedUpload, AiArtifactUploadInput } from "./types.js";
const receipts = new WeakMap<
  BotoZap,
  Map<string, { prepared: AiPreparedUpload; uploaded: boolean }>
>();
/** Retry of identical bytes/intent reuses the receipt; completion never starts another import. */
export async function uploadArtifact<T>(
  client: BotoZap,
  input: Record<string, unknown> & {
    file: Blob;
    file_name: string;
    kind: "skill" | "knowledge";
  },
): Promise<T> {
  const { file, file_name, kind } = input;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const sha256 = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const ext = file_name.toLowerCase().split(".").at(-1) ?? "";
  const mime =
    kind === "skill"
      ? "application/zip"
      : (
          {
            pdf: "application/pdf",
            txt: "text/plain",
            md: "text/markdown",
            csv: "text/csv",
          } as Record<string, string>
        )[ext] ||
        file.type ||
        "application/octet-stream";
  const metadata: AiArtifactUploadInput = {
    customer_id: String(input.customer_id),
    kind,
    file_name,
    mime_type: mime,
    byte_size: file.size,
    sha256,
    ...(kind === "knowledge"
      ? { name: String(input.name ?? "") }
      : {
          ...(input.id
            ? {
                skill_id: String(input.id),
                expected_revision: String(input.expected_revision ?? ""),
              }
            : {}),
        }),
  };
  const key = JSON.stringify(metadata);
  let map = receipts.get(client);
  if (!map) {
    map = new Map();
    receipts.set(client, map);
  }
  let receipt = map.get(key);
  if (
    !receipt ||
    (!receipt.uploaded && Date.parse(receipt.prepared.expires_at) <= Date.now())
  ) {
    const prepared = await client.ai.uploads.prepare(metadata);
    receipt = { prepared, uploaded: false };
    map.set(key, receipt);
    if (map.size > 20) map.delete(map.keys().next().value!);
  }
  if (typeof input.onUploadPrepared === "function")
    await input.onUploadPrepared({ upload_id: receipt.prepared.upload_id });
  if (!receipt.uploaded) {
    await client.putArtifact(
      receipt.prepared.upload_url,
      receipt.prepared.headers["Content-Type"],
      file,
    );
    receipt.uploaded = true;
  }
  try {
    const result = await client.ai.uploads.complete({
      customer_id: metadata.customer_id,
      id: receipt.prepared.upload_id,
    });
    map.delete(key);
    return result as T;
  } catch (error) {
    if (error instanceof BotoZapError && error.code === "upload_expired")
      map.delete(key);
    throw error;
  }
}
