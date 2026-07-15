import { BotoZapError } from "./errors.js";
import { Messages } from "./resources/messages.js";
import { Customers } from "./resources/customers.js";
import { Templates } from "./resources/templates.js";
import { Broadcasts } from "./resources/broadcasts.js";
import { Contacts } from "./resources/contacts.js";
import { Conversations } from "./resources/conversations.js";
import { Webhooks } from "./resources/webhooks.js";
import { PhoneNumbers } from "./resources/phone-numbers.js";
import { Flows } from "./resources/flows.js";
import { Media } from "./resources/media.js";
import { Users, ApiLogs, WebhookDeliveries } from "./resources/read-only.js";

export interface BotoZapOptions {
  /** Chave de API da conta (cabeçalho Authorization: Bearer). */
  apiKey: string;
  /** Sobrescreve a URL base. Padrão: https://botozap.com.br/api/v1 */
  baseUrl?: string;
  /** Injeta um fetch (testes, runtimes sem fetch global). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

const DEFAULT_BASE_URL = "https://botozap.com.br/api/v1";

/**
 * Cliente da API da BotoZap.
 *
 * ```ts
 * const boto = new BotoZap({ apiKey: process.env.BOTOZAP_KEY! });
 * await boto.messages.send({ to: "+5531988887777", text: "Olá!" });
 * ```
 */
export class BotoZap {
  readonly messages: Messages;
  readonly customers: Customers;
  readonly templates: Templates;
  readonly broadcasts: Broadcasts;
  readonly contacts: Contacts;
  readonly conversations: Conversations;
  readonly webhooks: Webhooks;
  readonly phoneNumbers: PhoneNumbers;
  readonly flows: Flows;
  readonly media: Media;
  readonly users: Users;
  readonly apiLogs: ApiLogs;
  readonly webhookDeliveries: WebhookDeliveries;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BotoZapOptions) {
    if (!options || !options.apiKey) {
      throw new Error("BotoZap: apiKey é obrigatório.");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

    const resolvedFetch = options.fetch ?? globalThis.fetch;
    if (typeof resolvedFetch !== "function") {
      throw new Error(
        "BotoZap: fetch global não encontrado. Use Node 20.19+ ou passe a opção `fetch`.",
      );
    }
    this.fetchImpl = resolvedFetch;

    this.messages = new Messages(this);
    this.customers = new Customers(this);
    this.templates = new Templates(this);
    this.broadcasts = new Broadcasts(this);
    this.contacts = new Contacts(this);
    this.conversations = new Conversations(this);
    this.webhooks = new Webhooks(this);
    this.phoneNumbers = new PhoneNumbers(this);
    this.flows = new Flows(this);
    this.media = new Media(this);
    this.users = new Users(this);
    this.apiLogs = new ApiLogs(this);
    this.webhookDeliveries = new WebhookDeliveries(this);
  }

  /** Faz uma requisição autenticada e devolve o corpo já parseado. */
  async request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (cause) {
      // `fetch` REJEITA (DNS, conexão recusada, offline, abort) com um TypeError
      // — não é uma resposta HTTP. Se vazasse cru, o chamador teria dois tipos de
      // erro pra tratar (BotoZapError vs. TypeError). Embrulhamos num BotoZapError
      // de rede: um único tipo pra capturar, com `code` distinguindo rede de HTTP.
      // status 0 = não houve resposta HTTP.
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new BotoZapError(
        "network_error",
        `falha de rede ao chamar a API: ${detail}`,
        0,
      );
    }

    const raw = await res.text();
    const data = raw ? safeJson(raw) : undefined;

    if (!res.ok) {
      const envelope = data as
        | { error?: { code?: string; message?: string } }
        | undefined;
      // Expõe os headers da RESPOSTA no erro — num 429 o chamador precisa de
      // `Retry-After`/`X-RateLimit-*` para saber quando reenviar. Só headers da
      // resposta; nada do request (que carrega a apiKey) toca este objeto.
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      throw new BotoZapError(
        envelope?.error?.code ?? "http_error",
        envelope?.error?.message ?? `HTTP ${res.status}`,
        res.status,
        headers,
      );
    }

    return data as T;
  }

  /**
   * Requisição a um endpoint de ITEM (singular). A API embrulha essas respostas
   * em `{ data: <obj> }` (helper `ok`); este método desempacota e devolve a
   * entidade. NÃO é uma heurística "se tem .data desempacota" — o desempacote é
   * o contrato conhecido do endpoint, declarado por quem chama este método (as
   * rotas de LISTA usam `request` e devolvem `{ data, paging|meta }` inteiro; a
   * rota POST /messages responde direto e também usa `request`).
   */
  async requestItem<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const env = await this.request<{ data: T }>(method, path, opts);
    // Contrato: endpoints de ITEM respondem `{ data: <obj> }`. Sem a chave
    // `data`, `(env).data` seria `undefined` SILENCIOSO — o chamador recebe
    // undefined e só quebra lá na frente, longe da causa. Falha alto e claro
    // aqui. (`data: null` explícito PASSA — a chave existe; é 200-sem-envelope
    // que é violação.) status 0 = erro de contrato do cliente, não HTTP.
    if (env == null || typeof env !== "object" || !("data" in env)) {
      throw new BotoZapError(
        "malformed_response",
        "resposta sem envelope data — contrato violado",
        0,
      );
    }
    return (env as { data: T }).data;
  }

  /** Resposta JSON direta que precisa ser um objeto (ex.: POST /messages). */
  async requestObject<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const value = await this.request<unknown>(method, path, opts);
    if (!isObject(value)) {
      throw malformed("resposta deveria ser um objeto JSON");
    }
    return value as T;
  }

  /** Lista paginada por cursor: exige `{ data: [], paging: {} }`. */
  async requestCursorList<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const value = await this.request<unknown>(method, path, opts);
    if (!isObject(value) || !Array.isArray(value.data) || !isObject(value.paging)) {
      throw malformed("resposta sem data[]/paging — contrato de cursor violado");
    }
    return value as T;
  }

  /** Lista paginada por offset: exige `{ data: [], meta: {} }`. */
  async requestOffsetList<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const value = await this.request<unknown>(method, path, opts);
    if (!isObject(value) || !Array.isArray(value.data) || !isObject(value.meta)) {
      throw malformed("resposta sem data[]/meta — contrato de offset violado");
    }
    return value as T;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformed(message: string): BotoZapError {
  return new BotoZapError("malformed_response", message, 0);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
