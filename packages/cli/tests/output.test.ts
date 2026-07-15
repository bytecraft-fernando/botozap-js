/**
 * Renderização de saída dos comandos (`human` vs `json`) com o SDK MOCKADO.
 *
 * Aqui não há rede nem servidor: injetamos um cliente falso no lugar do
 * `BotoZap` para exercitar só a camada de apresentação da CLI — tabela + rodapé
 * (cursor E offset), detalhe de item e as respostas 204 ("removido" / {deleted}).
 * O `BotoZapError` real é preservado (para instanceof no handler).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { registerContacts } from "../src/commands/contacts.js";
import { registerCustomers } from "../src/commands/customers.js";
import { run } from "./helpers.js";

// Cliente falso mutável, injetado no lugar do `new BotoZap(...)`.
const hoisted = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));

vi.mock("@botozap/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@botozap/sdk")>();
  return { ...actual, BotoZap: vi.fn(() => hoisted.client) };
});

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_KEY_ENV = process.env.BOTOZAP_API_KEY;
let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "botozap-cli-out-"));
  process.env.HOME = home;
  process.env.BOTOZAP_API_KEY = "bz_live_test"; // evita ConfigError no createClient
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  if (ORIGINAL_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = ORIGINAL_HOME;
  if (ORIGINAL_KEY_ENV === undefined) delete process.env.BOTOZAP_API_KEY;
  else process.env.BOTOZAP_API_KEY = ORIGINAL_KEY_ENV;
  vi.clearAllMocks();
});

describe("lista por cursor (contacts list)", () => {
  const page = {
    data: [
      {
        id: "ct_1",
        wa_id: "5511999999999",
        profile_name: "Fulano",
        username: "fulano",
        customer_id: "cus_1",
      },
    ],
    paging: { cursors: { before: null, after: "cur_next" }, next: "cur_next", previous: null },
  };

  it("human: cabeçalho, linha e rodapé de cursor (--after)", async () => {
    hoisted.client = { contacts: { list: vi.fn().mockResolvedValue(page) } };
    const { stdout, error } = await run(registerContacts, ["contacts", "list"]);
    expect(error).toBeUndefined();
    expect(stdout).toContain("WA_ID");
    expect(stdout).toContain("5511999999999");
    expect(stdout).toContain("Fulano");
    expect(stdout).toContain("próxima: --after cur_next");
  });

  it("json: envelope {data,paging} re-parseável", async () => {
    hoisted.client = { contacts: { list: vi.fn().mockResolvedValue(page) } };
    const { stdout, error } = await run(registerContacts, [
      "contacts",
      "list",
      "-o",
      "json",
    ]);
    expect(error).toBeUndefined();
    const parsed = JSON.parse(stdout);
    expect(parsed.data[0].id).toBe("ct_1");
    expect(parsed.paging.next).toBe("cur_next");
  });

  it("human: lista vazia imprime `(nenhum resultado)`", async () => {
    hoisted.client = {
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: [],
          paging: { cursors: { before: null, after: null }, next: null, previous: null },
        }),
      },
    };
    const { stdout } = await run(registerContacts, ["contacts", "list"]);
    expect(stdout).toContain("(nenhum resultado)");
    expect(stdout).not.toContain("próxima:");
  });
});

describe("lista por offset (customers list)", () => {
  const page = {
    data: [
      { id: "cus_1", name: "Acme", external_customer_id: "ext_1", created_at: "2026-01-01" },
    ],
    meta: { page: 1, total_pages: 3, total_count: 42 },
  };

  it("human: tabela + rodapé de offset (página x/y, total)", async () => {
    hoisted.client = { customers: { list: vi.fn().mockResolvedValue(page) } };
    const { stdout, error } = await run(registerCustomers, ["customers", "list"]);
    expect(error).toBeUndefined();
    expect(stdout).toContain("Acme");
    expect(stdout).toContain("página 1/3");
    expect(stdout).toContain("42 no total");
  });

  it("json: envelope {data,meta} re-parseável", async () => {
    hoisted.client = { customers: { list: vi.fn().mockResolvedValue(page) } };
    const { stdout } = await run(registerCustomers, [
      "customers",
      "list",
      "-o",
      "json",
    ]);
    const parsed = JSON.parse(stdout);
    expect(parsed.meta.total_count).toBe(42);
  });
});

describe("detalhe de item (contacts get)", () => {
  const item = { id: "ct_1", wa_id: "5511999999999", profile_name: "Fulano" };

  it("human: pares chave/valor (printDetail)", async () => {
    hoisted.client = { contacts: { get: vi.fn().mockResolvedValue(item) } };
    const { stdout, error } = await run(registerContacts, [
      "contacts",
      "get",
      "ct_1",
    ]);
    expect(error).toBeUndefined();
    expect(stdout).toMatch(/id\s+ct_1/);
    expect(stdout).toMatch(/wa_id\s+5511999999999/);
  });

  it("json: objeto re-parseável", async () => {
    hoisted.client = { contacts: { get: vi.fn().mockResolvedValue(item) } };
    const { stdout } = await run(registerContacts, [
      "contacts",
      "get",
      "ct_1",
      "-o",
      "json",
    ]);
    expect(JSON.parse(stdout)).toEqual(item);
  });
});

describe("resposta 204 (contacts delete)", () => {
  it("human: imprime `Contato removido.`", async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    hoisted.client = { contacts: { delete: del } };
    const { stdout, error } = await run(registerContacts, [
      "contacts",
      "delete",
      "ct_1",
    ]);
    expect(error).toBeUndefined();
    expect(del).toHaveBeenCalledWith("ct_1");
    expect(stdout).toContain("Contato removido.");
  });

  it("json: `{ deleted: true }`", async () => {
    hoisted.client = {
      contacts: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    const { stdout } = await run(registerContacts, [
      "contacts",
      "delete",
      "ct_1",
      "-o",
      "json",
    ]);
    expect(JSON.parse(stdout)).toEqual({ deleted: true });
  });
});
