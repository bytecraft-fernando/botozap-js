import { describe, expect, expectTypeOf, it } from "vitest";
import { BotoZap, type SendMediaParams } from "../src/index.js";

const API_KEY = "bz_live_media_sdk_test";
const BASE_URL = "https://api.test/v1";

describe("SDK — messages.sendMedia", () => {
  it("envia imagem com caption pelo endpoint canônico de mensagens", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const boto = new BotoZap({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: (async (input, init) => {
        requests.push({
          url: String(input),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        return new Response(
          JSON.stringify({
            id: "10000000-0000-4000-8000-000000000001",
            wamid: "wamid.media.image",
            to: "5511999999999",
            status: "sent",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const result = await boto.messages.sendMedia({
      to: "+5511999999999",
      from: "1279498075235551",
      type: "image",
      link: "https://cdn.example.test/foto.jpg",
      caption: "Foto do pedido",
    });

    expect(result.wamid).toBe("wamid.media.image");
    expect(requests).toEqual([
      {
        url: `${BASE_URL}/messages`,
        body: {
          to: "+5511999999999",
          from: "1279498075235551",
          type: "image",
          image: {
            link: "https://cdn.example.test/foto.jpg",
            caption: "Foto do pedido",
          },
        },
      },
    ]);
  });

  it("envia áudio somente com link", async () => {
    let body: unknown;
    const boto = new BotoZap({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: (async (_input, init) => {
        body = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(
          JSON.stringify({
            id: "10000000-0000-4000-8000-000000000002",
            wamid: "wamid.media.audio",
            to: "5511999999999",
            status: "sent",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await boto.messages.sendMedia({
      to: "+5511999999999",
      type: "audio",
      link: "https://cdn.example.test/audio.ogg",
    });

    expect(body).toEqual({
      to: "+5511999999999",
      type: "audio",
      audio: { link: "https://cdn.example.test/audio.ogg" },
    });
  });

  it("envia documento com caption e filename", async () => {
    let body: unknown;
    const boto = new BotoZap({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: (async (_input, init) => {
        body = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(
          JSON.stringify({
            id: "10000000-0000-4000-8000-000000000003",
            wamid: "wamid.media.document",
            to: "5511999999999",
            status: "sent",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await boto.messages.sendMedia({
      to: "+5511999999999",
      type: "document",
      link: "https://cdn.example.test/fatura.pdf",
      caption: "Fatura do mês",
      filename: "fatura-agosto.pdf",
    });

    expect(body).toEqual({
      to: "+5511999999999",
      type: "document",
      document: {
        link: "https://cdn.example.test/fatura.pdf",
        caption: "Fatura do mês",
        filename: "fatura-agosto.pdf",
      },
    });
  });

  it("envia vídeo com caption", async () => {
    let body: unknown;
    const boto = new BotoZap({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: (async (_input, init) => {
        body = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(
          JSON.stringify({
            id: "10000000-0000-4000-8000-000000000004",
            wamid: "wamid.media.video",
            to: "5511999999999",
            status: "sent",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await boto.messages.sendMedia({
      to: "+5511999999999",
      type: "video",
      link: "https://cdn.example.test/demo.mp4",
      caption: "Demonstração",
    });

    expect(body).toEqual({
      to: "+5511999999999",
      type: "video",
      video: {
        link: "https://cdn.example.test/demo.mp4",
        caption: "Demonstração",
      },
    });
  });

  it("omite campos opcionais ausentes", async () => {
    let body: unknown;
    const boto = new BotoZap({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: (async (_input, init) => {
        body = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(
          JSON.stringify({
            id: "10000000-0000-4000-8000-000000000005",
            wamid: "wamid.media.document.minimal",
            to: "5511999999999",
            status: "sent",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await boto.messages.sendMedia({
      to: "+5511999999999",
      type: "document",
      link: "https://cdn.example.test/fatura.pdf",
    });

    expect(body).toEqual({
      to: "+5511999999999",
      type: "document",
      document: { link: "https://cdn.example.test/fatura.pdf" },
    });
  });

  it("tipa as variantes sem caption em áudio nem filename fora de documento", () => {
    type Image = Extract<SendMediaParams, { type: "image" }>;
    type Video = Extract<SendMediaParams, { type: "video" }>;
    type Audio = Extract<SendMediaParams, { type: "audio" }>;
    type Document = Extract<SendMediaParams, { type: "document" }>;

    expectTypeOf<Image>().toEqualTypeOf<{
      to: string;
      type: "image";
      link: string;
      caption?: string;
      from?: string;
    }>();
    expectTypeOf<Video>().toEqualTypeOf<{
      to: string;
      type: "video";
      link: string;
      caption?: string;
      from?: string;
    }>();
    expectTypeOf<Audio>().toEqualTypeOf<{
      to: string;
      type: "audio";
      link: string;
      from?: string;
    }>();
    expectTypeOf<Document>().toEqualTypeOf<{
      to: string;
      type: "document";
      link: string;
      caption?: string;
      filename?: string;
      from?: string;
    }>();
  });
});
