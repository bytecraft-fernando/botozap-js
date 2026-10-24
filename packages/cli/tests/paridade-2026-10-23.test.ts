/**
 * Paridade com a API de 23/10/2026 na CLI: "digitando…" e marcar como lida,
 * modelos prontos de Régua, diagnóstico do agente,
 * responder citando, mensagem de voz e configurações do número do WhatsApp.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerAi } from "../src/commands/ai.js";
import { registerAttendance } from "../src/commands/attendance.js";
import { registerConversations } from "../src/commands/conversations.js";
import { registerMessages } from "../src/commands/messages.js";
import { registerNumbers } from "../src/commands/numbers.js";
import { buildProgram, run } from "./helpers.js";

const fetch = vi.fn();
const base = ["--api-key", "bz_live_fake", "--api-url", "https://example.test/v1"];
const json = [...base, "-o", "json"];
const ID = "c0000000-0000-4000-8000-000000000001";

function request(index = 0) {
  const [url, init] = fetch.mock.calls[index]!;
  const parsed = new URL(String(url));
  const raw = init?.body;
  return {
    method: init?.method as string | undefined,
    path: parsed.pathname.replace(/^\/v1/, ""),
    query: Object.fromEntries(parsed.searchParams),
    body: raw instanceof FormData ? raw : raw ? JSON.parse(String(raw)) : undefined,
  };
}

const sent = { id: "m2", wamid: "wamid.2", to: "5511999999999", status: "sent" };

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("conversations typing e read", () => {
  it("typing faz POST e avisa quando foi repetido", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { conversation_id: ID, channel: "whatsapp", typing: true, repeated: true } }));
    const result = await run(registerConversations, ["conversations", "typing", ID, ...base]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "POST", path: `/conversations/${ID}/typing`, body: undefined });
    expect(result.stdout).toContain("já estava valendo");
  });

  it("typing sem mensagem recebida propaga no_inbound_message", async () => {
    fetch.mockImplementation(async () => Response.json({ error: { code: "no_inbound_message", message: "sem mensagem" } }, { status: 409 }));
    const result = await run(registerConversations, ["conversations", "typing", ID, ...base]);
    expect(result.error).toMatchObject({ code: "no_inbound_message", status: 409 });
  });

  it("read faz POST e devolve last_read_at", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { conversation_id: ID, last_read_at: "2026-10-23T12:00:00.000Z" } }));
    const result = await run(registerConversations, ["conversations", "read", ID, ...json]);
    expect(request()).toMatchObject({ method: "POST", path: `/conversations/${ID}/read` });
    expect(JSON.parse(result.stdout)).toEqual({ conversation_id: ID, last_read_at: "2026-10-23T12:00:00.000Z" });
  });
});

describe("journeys catalog e enable-model", () => {
  it("catalog lista os modelos com a key", async () => {
    fetch.mockImplementation(async () =>
      Response.json({ data: [{ key: "boas_vindas", name: "Boas-vindas", trigger: { kind: "stage_entered" }, category: "UTILITY", template_name: "bz_boas_vindas" }] }),
    );
    const result = await run(registerAttendance, ["journeys", "catalog", ...base]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "GET", path: "/journeys/catalog" });
    expect(result.stdout).toContain("boas_vindas");
    expect(result.stdout).toContain("stage_entered");
  });

  it("enable-model manda customer_id e o número e explica o resultado", async () => {
    fetch.mockImplementation(async () =>
      Response.json({ data: { journey_id: "j1", created: true, template_submitted: true, resubmitted: false, active: false } }, { status: 201 }),
    );
    const result = await run(registerAttendance, [
      "journeys", "enable-model", "boas_vindas", "--customer-id", ID, "--phone-number-id", "1234567890", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toEqual({
      method: "POST",
      path: "/journeys/catalog/boas_vindas/enable",
      query: {},
      body: { customer_id: ID, phone_number_id: "1234567890" },
    });
    expect(result.stdout).toContain("liga sozinha na aprovação");
  });

  it("enable-model exige --customer-id", async () => {
    const result = await run(registerAttendance, ["journeys", "enable-model", "boas_vindas", ...base]);
    expect(result.error).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ai agents diagnostic", () => {
  it("existe e lê GET /ai/agents/{id}/diagnostic", async () => {
    const program = buildProgram(registerAi);
    const agents = program.commands.find((c) => c.name() === "ai")?.commands.find((c) => c.name() === "agents");
    expect(agents?.commands.map((c) => c.name())).toContain("diagnostic");
    const dir = await mkdtemp(join(tmpdir(), "bz-diag-"));
    try {
      const file = join(dir, "in.json");
      await writeFile(file, JSON.stringify({ customer_id: ID, id: ID }));
      fetch.mockImplementation(async () => Response.json({ data: { agent_id: ID, ready: true, checks: [] } }));
      const result = await run(registerAi, ["ai", "agents", "diagnostic", "--input-file", file, ...json]);
      expect(result.error).toBeUndefined();
      expect(request()).toMatchObject({ method: "GET", path: `/ai/agents/${ID}/diagnostic`, query: { customer_id: ID } });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("messages: responder citando e voz", () => {
  it("send-interactive manda --reply-to e a ajuda não oferece o pedido de localização", async () => {
    const program = buildProgram(registerMessages);
    const help = program.commands.find((c) => c.name() === "messages")?.commands.find((c) => c.name() === "send-interactive")?.description();
    expect(help).not.toContain("location_request_message");
    fetch.mockImplementation(async () => Response.json(sent, { status: 201 }));
    const interactive = { type: "button", body: { text: "Confirma?" }, action: { buttons: [{ type: "reply", reply: { id: "sim", title: "Sim" } }] } };
    const result = await run(registerMessages, [
      "messages", "send-interactive", "--to", "5511999999999", "--json", JSON.stringify(interactive), "--reply-to", "wamid.1", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request().body).toMatchObject({ type: "interactive", interactive, reply_to: { message_id: "wamid.1" } });
  });

  it("send --reply-to e o recibo mostra a citada", async () => {
    fetch.mockImplementation(async () => Response.json({ ...sent, reply_to: { message_id: "m1", external_id: "wamid.1" } }, { status: 201 }));
    const result = await run(registerMessages, ["messages", "send", "--to", "5511999999999", "--text", "Sim", "--reply-to", "m1", ...base]);
    expect(result.error).toBeUndefined();
    expect(request().body).toMatchObject({ text: { body: "Sim" }, reply_to: { message_id: "m1" } });
    expect(result.stdout).toContain("reply_to");
  });

  it("send com --input recusa --reply-to (vai no próprio JSON)", async () => {
    const result = await run(registerMessages, ["messages", "send", "--stdin", "--reply-to", "m1", ...base]);
    expect(String((result.error as Error).message)).toContain("reply_to no próprio JSON");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("send-media --voice só com audio e manda audio.voice", async () => {
    fetch.mockImplementation(async () => Response.json(sent, { status: 201 }));
    const refused = await run(registerMessages, ["messages", "send-media", "--to", "5511999999999", "--type", "image", "--link", "https://x.test/a.png", "--voice", ...base]);
    expect(String((refused.error as Error).message)).toContain("--voice só é aceito com --type audio");
    expect(fetch).not.toHaveBeenCalled();
    const result = await run(registerMessages, [
      "messages", "send-media", "--to", "5511999999999", "--type", "audio", "--link", "https://x.test/v.ogg", "--voice", "--reply-to", "m1", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual({ to: "5511999999999", type: "audio", audio: { link: "https://x.test/v.ogg", voice: true }, reply_to: { message_id: "m1" } });
  });

  it("send-location --reply-to", async () => {
    fetch.mockImplementation(async () => Response.json(sent, { status: 201 }));
    await run(registerMessages, ["messages", "send-location", "--to", "5511999999999", "--latitude", "-3.1", "--longitude", "-60", "--reply-to", "m1", ...base]);
    expect(request().body).toMatchObject({ type: "location", reply_to: { message_id: "m1" } });
  });
});

describe("numbers: perfil, perguntas, QR e bloqueados", () => {
  const profile = { about: "Oi", address: null, description: null, email: null, websites: [], vertical: "RETAIL", profile_picture_url: null, editable: false };

  it("profile get avisa da coexistência", async () => {
    fetch.mockImplementation(async () => Response.json({ data: profile }));
    const result = await run(registerNumbers, ["numbers", "profile", "get", "p1", ...base]);
    expect(request()).toMatchObject({ method: "GET", path: "/phone_numbers/p1/profile" });
    expect(result.stdout).toContain("coexistência");
  });

  it("profile update manda só os campos informados", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { ...profile, editable: true } }));
    const result = await run(registerNumbers, [
      "numbers", "profile", "update", "p1", "--about", "Novo", "--website", "https://a.test", "--vertical", "retail", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request()).toMatchObject({ method: "PATCH", path: "/phone_numbers/p1/profile", body: { about: "Novo", websites: ["https://a.test"], vertical: "RETAIL" } });
  });

  it("profile update sem campos não chama a API", async () => {
    const result = await run(registerNumbers, ["numbers", "profile", "update", "p1", ...base]);
    expect(String((result.error as Error).message)).toContain("ao menos um campo");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("profile photo manda multipart com a foto", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bz-photo-"));
    try {
      const file = join(dir, "logo.png");
      await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      fetch.mockImplementation(async () => Response.json({ data: { ...profile, editable: true } }));
      const result = await run(registerNumbers, ["numbers", "profile", "photo", "p1", file, ...base]);
      expect(result.error).toBeUndefined();
      const sentFile = (request().body as FormData).get("file") as File;
      expect(request()).toMatchObject({ method: "POST", path: "/phone_numbers/p1/profile/photo" });
      expect(sentFile.type).toBe("image/png");
      expect(sentFile.name).toBe("logo.png");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prompts update troca perguntas e comandos; clear usa DELETE", async () => {
    fetch.mockImplementation(async () => Response.json({ data: { prompts: ["Ver horários"], commands: [{ command_name: "cardapio", command_description: "Cardápio" }] } }));
    const result = await run(registerNumbers, [
      "numbers", "prompts", "update", "p1", "--prompt", "Ver horários", "--command", "/cardapio=Cardápio", ...base,
    ]);
    expect(result.error).toBeUndefined();
    expect(request().body).toEqual({ prompts: ["Ver horários"], commands: [{ command_name: "/cardapio", command_description: "Cardápio" }] });
    await run(registerNumbers, ["numbers", "prompts", "clear", "p1", ...base]);
    expect(request(1)).toMatchObject({ method: "DELETE", path: "/phone_numbers/p1/conversational-automation" });
  });

  it("qr create, get com formato e delete com confirmação", async () => {
    fetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ data: { code: "ABC123", prefilled_message: "Oi", deep_link_url: "https://wa.me/message/ABC123" } }, { status: 201 }),
    );
    await run(registerNumbers, ["numbers", "qr", "create", "p1", "--message", "Oi", "--format", "svg", ...base]);
    expect(request()).toMatchObject({ method: "POST", path: "/phone_numbers/p1/qr-codes", body: { prefilled_message: "Oi", image_format: "SVG" } });
    await run(registerNumbers, ["numbers", "qr", "get", "p1", "ABC123", "--format", "PNG", ...base]);
    expect(request(1)).toMatchObject({ method: "GET", path: "/phone_numbers/p1/qr-codes/ABC123", query: { image_format: "PNG" } });
    const deleted = await run(registerNumbers, ["numbers", "qr", "delete", "p1", "ABC123", "--yes", ...json]);
    expect(request(2)).toMatchObject({ method: "DELETE", path: "/phone_numbers/p1/qr-codes/ABC123" });
    expect(JSON.parse(deleted.stdout)).toEqual({ deleted: true });
  });

  it("qr delete sem --yes e sem terminal não chama a API", async () => {
    const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const result = await run(registerNumbers, ["numbers", "qr", "delete", "p1", "ABC123", ...base]).finally(() => {
      if (original) Object.defineProperty(process.stdin, "isTTY", original);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
    });
    expect(String((result.error as Error).message)).toContain("--yes");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocked list, block e unblock", async () => {
    fetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "GET"
        ? Response.json({ data: [{ wa_id: "5511999999999", contact_id: null, name: null }], paging: { cursors: { before: null, after: "QVFI" }, next: null, previous: null } })
        : Response.json({ data: { blocked: init?.method === "POST", wa_id: "5511999999999", contact_id: null } }),
    );
    const listed = await run(registerNumbers, ["numbers", "blocked", "list", "p1", "--after", "QVFH", ...base]);
    expect(request()).toMatchObject({ method: "GET", path: "/phone_numbers/p1/blocked-users", query: { after: "QVFH" } });
    expect(listed.stdout).toContain("--after QVFI");
    await run(registerNumbers, ["numbers", "blocked", "block", "p1", "--user", "+5511999999999", ...base]);
    expect(request(1)).toMatchObject({ method: "POST", body: { user: "+5511999999999" } });
    await run(registerNumbers, ["numbers", "blocked", "unblock", "p1", "5511999999999", ...base]);
    expect(request(2)).toMatchObject({ method: "DELETE", path: "/phone_numbers/p1/blocked-users/5511999999999" });
    const both = await run(registerNumbers, ["numbers", "blocked", "block", "p1", "--user", "+55", "--contact-id", ID, ...base]);
    expect(String((both.error as Error).message)).toContain("--contact-id OU --user");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
