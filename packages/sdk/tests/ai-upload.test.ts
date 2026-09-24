import { expect, it, vi } from "vitest";
import { BotoZap } from "../src/index.js";
const id = "11111111-1111-4111-8111-111111111111",
  url = "https://bucket.example.test/signed?signature=secret";
const prepared = {
  upload_id: id,
  upload_url: url,
  headers: { "Content-Type": "application/zip" },
  expires_at: "2999-01-01T00:00:00Z",
};
const input = {
  customer_id: id,
  id,
  expected_revision: "9007199254740993",
  file: new Blob([new Uint8Array([80, 75, 0, 255])]),
  file_name: "skill.zip",
};
function setup(fail: "put" | "complete" | "expired" | null = null) {
  let failed = false;
  const fetch = vi.fn<typeof globalThis.fetch>(async (target, options) => {
    if (String(target).endsWith("/ai/uploads"))
      return Response.json({ data: prepared });
    if (String(target) === url) {
      if (fail === "put" && !failed) {
        failed = true;
        throw new Error(url);
      }
      return new Response(null, { status: 200 });
    }
    if (String(target).endsWith("/complete")) {
      if ((fail === "complete" || fail === "expired") && !failed) {
        failed = true;
        return Response.json(
          {
            error: {
              code: fail === "expired" ? "upload_expired" : "unavailable",
              message: "Tente novamente",
            },
          },
          { status: 503 },
        );
      }
      return Response.json({ data: { id, name: "Skill" } });
    }
    throw new Error("Unexpected request");
  });
  return {
    fetch,
    client: new BotoZap({
      apiKey: "bz_live_fake",
      baseUrl: "https://api.example.test/v1",
      fetch,
    }),
  };
}
it("hashes exact bytes and puts directly without API credentials or redirects", async () => {
  const { client, fetch } = setup();
  await expect(client.ai.skills.importZip(input)).resolves.toMatchObject({
    id,
  });
  expect(fetch).toHaveBeenCalledTimes(3);
  const body = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
  expect(body).toMatchObject({
    skill_id: id,
    expected_revision: input.expected_revision,
    byte_size: 4,
    kind: "skill",
    mime_type: "application/zip",
  });
  expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(body).not.toHaveProperty("file");
  const put = fetch.mock.calls[1]![1]!;
  expect(put).toMatchObject({
    method: "PUT",
    headers: { "Content-Type": "application/zip" },
    credentials: "omit",
    redirect: "error",
  });
  expect(put.headers).not.toHaveProperty("Authorization");
  expect(new Uint8Array(await (put.body as Blob).arrayBuffer())).toEqual(
    new Uint8Array([80, 75, 0, 255]),
  );
});
it("keeps upload receipt after completion failure and retries only completion", async () => {
  const { client, fetch } = setup("complete");
  await expect(client.ai.skills.importZip(input)).rejects.toMatchObject({
    code: "unavailable",
  });
  await client.ai.skills.importZip(input);
  expect(fetch.mock.calls.map((c) => String(c[0]))).toEqual([
    "https://api.example.test/v1/ai/uploads",
    url,
    `https://api.example.test/v1/ai/uploads/${id}/complete`,
    `https://api.example.test/v1/ai/uploads/${id}/complete`,
  ]);
});
it("retries PUT using same receipt after ambiguous transport, without leaking signed URL in error", async () => {
  const { client, fetch } = setup("put");
  await expect(client.ai.skills.importZip(input)).rejects.toMatchObject({
    code: "upload_transport_error",
    message: expect.not.stringContaining("signature"),
  });
  await client.ai.skills.importZip(input);
  expect(fetch.mock.calls.map((c) => String(c[0]))).toEqual([
    "https://api.example.test/v1/ai/uploads",
    url,
    url,
    `https://api.example.test/v1/ai/uploads/${id}/complete`,
  ]);
});
it("prepares again only after explicit expired response, not merely expired URL after PUT", async () => {
  const { client, fetch } = setup("expired");
  await expect(client.ai.skills.importZip(input)).rejects.toMatchObject({
    code: "upload_expired",
  });
  await client.ai.skills.importZip(input);
  expect(
    fetch.mock.calls.filter((c) => String(c[0]).endsWith("/ai/uploads")),
  ).toHaveLength(2);
});
it("supports 10MiB knowledge directly and rejects oversized skill before HTTP", async () => {
  const { client, fetch } = setup();
  expect(() =>
    client.ai.skills.importZip({
      ...input,
      file: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]),
    }),
  ).toThrow();
  expect(fetch).not.toHaveBeenCalled();
  await client.ai.knowledge.upload({
    customer_id: id,
    name: "Manual",
    file_name: "manual.txt",
    file: new Blob([new Uint8Array(10 * 1024 * 1024)]),
  });
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).byte_size).toBe(
    10 * 1024 * 1024,
  );
});
it("never forwards API auth to insecure or credential-bearing upload URL", async () => {
  const { client, fetch } = setup();
  await expect(
    client.putArtifact("http://bucket.test", "text/plain", new Blob(["a"])),
  ).rejects.toMatchObject({ code: "invalid_upload_url" });
  expect(fetch).not.toHaveBeenCalled();
});
it("exposes safe receipt before bytes so caller can persist completion across processes", async () => {
  const { client, fetch } = setup();
  const onUploadPrepared = vi.fn((receipt) => {
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(receipt).toEqual({ upload_id: id });
  });
  await client.ai.skills.importZip({ ...input, onUploadPrepared });
  expect(onUploadPrepared).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).not.toHaveProperty(
    "onUploadPrepared",
  );
});
it("allows explicit completion of durable receipt without putting bytes again", async () => {
  const { client, fetch } = setup();
  await client.ai.uploads.complete({ customer_id: id, id });
  expect(fetch).toHaveBeenCalledOnce();
  expect(String(fetch.mock.calls[0]![0])).toContain(
    `/ai/uploads/${id}/complete`,
  );
});
