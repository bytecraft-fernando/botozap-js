/**
 * Paridade com a API de 23/10/2026: "digitando…" e marcar como lida, modelos
 * prontos de Régua, diagnóstico do agente, responder citando, voz e
 * configurações do número do WhatsApp (perfil, foto, perguntas e comandos,
 * QR codes e bloqueados).
 */
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  AI_OPERATIONS,
  BotoZap,
  BotoZapError,
  type AiAgentDiagnostic,
  type AiToolId,
  type BlockedUser,
  type BotoZapErrorCode,
  type ConversationalAutomation,
  type ConversationReadResult,
  type ConversationTypingResult,
  type CursorList,
  type JourneyCatalogItem,
  type JourneyModelEnableResult,
  type Message,
  type SendResult,
  type WhatsAppBusinessProfile,
  type WhatsAppQrCode,
} from "../src/index.js";

const CONV = "c0000000-0000-4000-8000-000000000001";
const CUSTOMER = "c0000000-0000-4000-8000-0000000000c1";
const AGENT = "c0000000-0000-4000-8000-0000000000a1";

function setup(response: () => Response) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  const client = new BotoZap({ apiKey: "bz_live_secret_for_test", baseUrl: "https://example.test/v1", fetch });
  const call = (i = 0) => {
    const init = fetch.mock.calls[i]?.[1] as RequestInit | undefined;
    const raw = init?.body;
    return {
      url: fetch.mock.calls[i]?.[0] as string,
      method: init?.method,
      body: raw === undefined || raw instanceof FormData ? raw : JSON.parse(String(raw)),
    };
  };
  return { client, fetch, call };
}

const refusal = (status: number, code: string, message = "recusa") => () =>
  Response.json({ error: { code, message } }, { status });

describe("conversations.typing e markRead", () => {
  it("typing faz POST sem corpo em /conversations/{id}/typing", async () => {
    const payload = { conversation_id: CONV, channel: "whatsapp", typing: true, repeated: false } as const;
    const { client, call } = setup(() => Response.json({ data: payload }));
    const result = await client.conversations.typing(CONV);
    expect(result).toEqual(payload);
    expectTypeOf(result).toEqualTypeOf<ConversationTypingResult>();
    expect(call()).toEqual({ method: "POST", url: `https://example.test/v1/conversations/${CONV}/typing`, body: undefined });
  });

  it("typing sem mensagem recebida vira no_inbound_message (409)", async () => {
    const { client } = setup(refusal(409, "no_inbound_message"));
    const error = await client.conversations.typing(CONV).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BotoZapError);
    expect(error).toMatchObject({ code: "no_inbound_message", status: 409 });
    const code: BotoZapErrorCode = "no_inbound_message";
    expect(code).toBe("no_inbound_message");
  });

  it("markRead faz POST sem corpo em /conversations/{id}/read e devolve last_read_at", async () => {
    const payload = { conversation_id: CONV, last_read_at: "2026-10-23T12:00:00.000Z" };
    const { client, call } = setup(() => Response.json({ data: payload }));
    const result = await client.conversations.markRead(CONV);
    expect(result).toEqual(payload);
    expectTypeOf(result).toEqualTypeOf<ConversationReadResult>();
    expect(call()).toEqual({ method: "POST", url: `https://example.test/v1/conversations/${CONV}/read`, body: undefined });
  });
});

describe("journeys.catalog e enableModel", () => {
  const item: JourneyCatalogItem = {
    key: "boas_vindas",
    name: "Boas-vindas",
    description: "Dá boas-vindas ao contato novo.",
    segments: ["geral"],
    trigger: { kind: "stage_entered", stageKey: "novo", waitDays: 0 },
    category: "UTILITY",
    template_name: "bz_boas_vindas",
    template_language: "pt_BR",
    body: "Oi {{1}}, seja bem-vindo.",
    variable_map: { "1": "contact.name" },
    examples: { "1": "Maria" },
  };

  it("catalog lê GET /journeys/catalog como lista em data", async () => {
    const { client, call } = setup(() => Response.json({ data: [item] }));
    const result = await client.journeys.catalog();
    expect(result).toEqual([item]);
    expectTypeOf(result).toEqualTypeOf<JourneyCatalogItem[]>();
    expect(call()).toMatchObject({ method: "GET", url: "https://example.test/v1/journeys/catalog" });
  });

  it("enableModel faz POST com customer_id e o número, e aceita 201", async () => {
    const payload: JourneyModelEnableResult = { journey_id: "j1", created: true, template_submitted: true, resubmitted: false, active: false };
    const { client, call } = setup(() => Response.json({ data: payload }, { status: 201 }));
    const result = await client.journeys.enableModel("boas vindas", { customer_id: CUSTOMER, phone_number_id: "1234567890" });
    expect(result).toEqual(payload);
    expect(call()).toEqual({
      method: "POST",
      url: "https://example.test/v1/journeys/catalog/boas%20vindas/enable",
      body: { customer_id: CUSTOMER, phone_number_id: "1234567890" },
    });
  });

  it("enableModel com Régua existente devolve created false (200)", async () => {
    const { client } = setup(() => Response.json({ data: { journey_id: "j1", created: false, template_submitted: true, resubmitted: true, active: false } }));
    await expect(client.journeys.enableModel("boas_vindas", { customer_id: CUSTOMER })).resolves.toMatchObject({ created: false, resubmitted: true });
  });

  it("enableModel com recusa da Meta vira meta_error", async () => {
    const { client } = setup(refusal(422, "meta_error", "A Meta recusou"));
    await expect(client.journeys.enableModel("boas_vindas", { customer_id: CUSTOMER })).rejects.toMatchObject({ code: "meta_error", status: 422 });
  });
});

describe("ai.agents.diagnostic", () => {
  it("é uma operação declarada e lê GET /ai/agents/{id}/diagnostic com customer_id na query", async () => {
    expect(AI_OPERATIONS.some((op) => op.group === "agents" && op.name === "diagnostic" && op.method === "GET" && op.path === "/ai/agents/:id/diagnostic")).toBe(true);
    const payload: AiAgentDiagnostic = {
      agent_id: AGENT,
      version_id: null,
      version_number: null,
      version_status: null,
      ready: false,
      checks: [{ id: "audio", title: "Áudios recebidos", status: "warning", detail: "x", blocking: false, action: { href: "/ia/provedores", label: "Abrir" } }],
      generation_proof: { status: "never", at: null, detail: "" },
    };
    const { client, call } = setup(() => Response.json({ data: payload }));
    const result = await client.ai.agents.diagnostic({ customer_id: CUSTOMER, id: AGENT });
    expect(result).toEqual(payload);
    expectTypeOf(result).toEqualTypeOf<AiAgentDiagnostic>();
    const url = new URL(call().url);
    expect(call().method).toBe("GET");
    expect(url.pathname).toBe(`/v1/ai/agents/${AGENT}/diagnostic`);
    expect(url.searchParams.get("customer_id")).toBe(CUSTOMER);
  });

  it("AiToolId aceita conversations.reply_options", () => {
    const tool: AiToolId = "conversations.reply_options";
    expect(tool).toBe("conversations.reply_options");
  });
});

describe("configurações do número do WhatsApp", () => {
  const PHONE = "p0000000-0000-4000-8000-000000000001";
  const profile: WhatsAppBusinessProfile = {
    about: "Atendemos de segunda a sábado",
    address: null,
    description: null,
    email: "contato@loja.com.br",
    websites: ["https://loja.com.br"],
    vertical: "RETAIL",
    profile_picture_url: null,
    editable: true,
  };

  it("getProfile e updateProfile", async () => {
    const { client, call } = setup(() => Response.json({ data: profile }));
    expect(await client.phoneNumbers.getProfile(PHONE)).toEqual(profile);
    await client.phoneNumbers.updateProfile(PHONE, { about: "Novo", websites: [] });
    expect(call(0)).toMatchObject({ method: "GET", url: `https://example.test/v1/phone_numbers/${PHONE}/profile` });
    expect(call(1)).toEqual({ method: "PATCH", url: `https://example.test/v1/phone_numbers/${PHONE}/profile`, body: { about: "Novo", websites: [] } });
  });

  it("updateProfile em coexistência vira coexistence_not_supported", async () => {
    const { client } = setup(refusal(409, "coexistence_not_supported"));
    await expect(client.phoneNumbers.updateProfile(PHONE, { about: "x" })).rejects.toMatchObject({ code: "coexistence_not_supported", status: 409 });
  });

  it("uploadProfilePhoto manda multipart com o campo file, sem Content-Type JSON", async () => {
    const { client, fetch, call } = setup(() => Response.json({ data: profile }));
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]);
    await client.phoneNumbers.uploadProfilePhoto(PHONE, { file: png, mime_type: "image/png" });
    const sent = call();
    expect(sent).toMatchObject({ method: "POST", url: `https://example.test/v1/phone_numbers/${PHONE}/profile/photo` });
    expect(sent.body).toBeInstanceOf(FormData);
    const file = (sent.body as FormData).get("file") as File;
    expect(file.type).toBe("image/png");
    expect(file.name).toBe("foto.png");
    expect(file.size).toBe(4);
    const headers = (fetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("perguntas prontas e comandos: get, update parcial e clear", async () => {
    const config: ConversationalAutomation = { prompts: ["Ver horários"], commands: [{ command_name: "cardapio", command_description: "Cardápio do dia" }] };
    const { client, call } = setup(() => Response.json({ data: config }));
    expect(await client.phoneNumbers.getConversationalAutomation(PHONE)).toEqual(config);
    await client.phoneNumbers.updateConversationalAutomation(PHONE, { prompts: [] });
    await client.phoneNumbers.clearConversationalAutomation(PHONE);
    const path = `https://example.test/v1/phone_numbers/${PHONE}/conversational-automation`;
    expect(call(0)).toMatchObject({ method: "GET", url: path });
    expect(call(1)).toEqual({ method: "PATCH", url: path, body: { prompts: [] } });
    expect(call(2)).toEqual({ method: "DELETE", url: path, body: undefined });
  });

  it("QR codes: list, create, get com formato, update e delete 204", async () => {
    const qr: WhatsAppQrCode = { code: "4O4YGZEG3RIVE1", prefilled_message: "Oi!", deep_link_url: "https://wa.me/message/4O4YGZEG3RIVE1" };
    let n = 0;
    const { client, call } = setup(() => (++n === 5 ? new Response(null, { status: 204 }) : Response.json({ data: n === 1 ? [qr] : qr }, { status: n === 2 ? 201 : 200 })));
    expect(await client.phoneNumbers.qrCodes.list(PHONE)).toEqual([qr]);
    await client.phoneNumbers.qrCodes.create(PHONE, { prefilled_message: "Oi!", image_format: "SVG" });
    await client.phoneNumbers.qrCodes.get(PHONE, qr.code, { image_format: "SVG" });
    await client.phoneNumbers.qrCodes.update(PHONE, qr.code, { prefilled_message: "Olá!" });
    await expect(client.phoneNumbers.qrCodes.delete(PHONE, qr.code)).resolves.toBeUndefined();
    const base = `https://example.test/v1/phone_numbers/${PHONE}/qr-codes`;
    expect(call(0)).toMatchObject({ method: "GET", url: base });
    expect(call(1)).toEqual({ method: "POST", url: base, body: { prefilled_message: "Oi!", image_format: "SVG" } });
    expect(call(2)).toMatchObject({ method: "GET", url: `${base}/${qr.code}?image_format=SVG` });
    expect(call(3)).toEqual({ method: "PATCH", url: `${base}/${qr.code}`, body: { prefilled_message: "Olá!" } });
    expect(call(4)).toMatchObject({ method: "DELETE", url: `${base}/${qr.code}` });
  });

  it("bloqueados: list com cursor, block por contact_id e unblock pelo wa_id", async () => {
    const page: CursorList<BlockedUser> = {
      data: [{ wa_id: "5511999999999", contact_id: "k1", name: "Maria" }],
      paging: { cursors: { before: null, after: "QVFI" }, next: null, previous: null },
    };
    let n = 0;
    const { client, call } = setup(() =>
      Response.json(++n === 1 ? page : n === 2 ? { data: { blocked: true, wa_id: "5511999999999", contact_id: "k1" } } : { data: { blocked: false, wa_id: "5511999999999" } }),
    );
    expect(await client.phoneNumbers.blockedUsers.list(PHONE, { after: "QVFH" })).toEqual(page);
    expect(await client.phoneNumbers.blockedUsers.block(PHONE, { contact_id: "k1" })).toMatchObject({ blocked: true });
    expect(await client.phoneNumbers.blockedUsers.unblock(PHONE, "+55 11 99999-9999")).toMatchObject({ blocked: false });
    const base = `https://example.test/v1/phone_numbers/${PHONE}/blocked-users`;
    expect(call(0)).toMatchObject({ method: "GET", url: `${base}?after=QVFH` });
    expect(call(1)).toEqual({ method: "POST", url: base, body: { contact_id: "k1" } });
    expect(call(2)).toMatchObject({ method: "DELETE", url: `${base}/%2B55%2011%2099999-9999` });
  });

  it("bloquear fora da janela de 24 h vira block_window_closed", async () => {
    const { client } = setup(refusal(422, "block_window_closed"));
    await expect(client.phoneNumbers.blockedUsers.block(PHONE, { user: "+5511999999999" })).rejects.toMatchObject({ code: "block_window_closed", status: 422 });
  });
});

describe("responder citando e mensagem de voz", () => {
  const sent = { id: "m2", wamid: "wamid.2", to: "5511999999999", status: "sent", reply_to: { message_id: "m1", external_id: "wamid.1" } };
  const reply = { message_id: "wamid.1" };

  it("reply_to vai em texto, template, mídia, interactive e localização", async () => {
    const { client, call } = setup(() => Response.json(sent, { status: 201 }));
    const result = await client.messages.send({ to: "5511999999999", text: "Sim", reply_to: reply });
    expectTypeOf(result).toEqualTypeOf<SendResult>();
    expect(result.reply_to).toEqual({ message_id: "m1", external_id: "wamid.1" });
    await client.messages.sendTemplate({ to: "5511999999999", template: { name: "t", language: { code: "pt_BR" } }, reply_to: reply });
    await client.messages.sendMedia({ to: "5511999999999", type: "image", link: "https://x.test/a.png", reply_to: reply });
    await client.messages.sendInteractive({
      to: "5511999999999",
      interactive: { type: "button", body: { text: "Confirma?" }, action: { buttons: [{ type: "reply", reply: { id: "sim", title: "Sim" } }] } },
      reply_to: reply,
    });
    await client.messages.sendLocation({ to: "5511999999999", latitude: -3.1, longitude: -60, reply_to: reply });
    for (let i = 0; i < 5; i++) expect(call(i).body.reply_to, String(i)).toEqual(reply);
  });

  it("sem reply_to o corpo não ganha o campo (comportamento anterior)", async () => {
    const { client, call } = setup(() => Response.json({ ...sent, reply_to: undefined }, { status: 201 }));
    await client.messages.send({ to: "5511999999999", text: "Oi" });
    expect(call().body).not.toHaveProperty("reply_to");
  });

  it("áudio com voice: true sai em audio.voice", async () => {
    const { client, call } = setup(() => Response.json(sent, { status: 201 }));
    await client.messages.sendMedia({ to: "5511999999999", type: "audio", link: "https://x.test/v.ogg", voice: true });
    expect(call().body).toEqual({ to: "5511999999999", type: "audio", audio: { link: "https://x.test/v.ogg", voice: true } });
  });

  it("voz com link que não é Ogg/Opus vira invalid_voice", async () => {
    const { client } = setup(refusal(422, "invalid_voice"));
    await expect(client.messages.sendMedia({ to: "5511999999999", type: "audio", link: "https://x.test/v.mp3", voice: true })).rejects.toMatchObject({ code: "invalid_voice" });
  });

  it("conversations.reply repassa reply_to ao envio", async () => {
    let n = 0;
    const { client, call } = setup(() =>
      ++n === 1
        ? Response.json({ data: { id: CONV, channel: "whatsapp", phone_number_id: "p1", contact: { wa_id: "5511999999999" } } })
        : Response.json(sent, { status: 201 }),
    );
    await client.conversations.reply(CONV, { text: "Sim", reply_to: reply });
    expect(call(1).body).toMatchObject({ text: { body: "Sim" }, reply_to: reply, from: "p1" });
  });

  it("citada fora da conversa vira reply_target_not_found", async () => {
    const { client } = setup(refusal(422, "reply_target_not_found"));
    await expect(client.messages.send({ to: "5511999999999", text: "x", reply_to: reply })).rejects.toMatchObject({ code: "reply_target_not_found", status: 422 });
  });

  it("Message traz reply_to, played_at e transcription", async () => {
    const message: Message = {
      id: "m3",
      reply_to: { message_id: null, external_id: "wamid.0" },
      played_at: "2026-10-23T12:00:00.000Z",
      transcription: null,
    };
    const { client } = setup(() => Response.json({ data: message }));
    const result = await client.messages.get("m3");
    expect(result.reply_to).toEqual({ message_id: null, external_id: "wamid.0" });
    expect(result.played_at).toBe("2026-10-23T12:00:00.000Z");
  });
});
