import {
  ErrorCode,
  McpError,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "../client.js";

export const EVENTS_URI_TEMPLATE = "botozap://events{?after,limit}";
const DEFAULT_LIMIT = 100;

type EventCursor = {
  after: string;
  limit: number;
};

type Subscription = {
  cursor: string;
};

/**
 * Tail de baixa latência ativo somente enquanto o cliente stdio mantém uma
 * assinatura. A notification é apenas um sinal; o payload continua vindo do
 * resource, que relê o stream durável da API pelo cursor informado na URI.
 */
class EventSubscriptions {
  private readonly subscriptions = new Map<string, Subscription>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private polling = false;
  private closed = false;

  constructor(
    private readonly server: McpServer,
    private readonly client: Client,
    private readonly pollIntervalMs: number,
  ) {}

  subscribe(uri: string): void {
    const { after } = parseEventsUri(uri);
    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, { cursor: after });
    }
    this.schedule(0);
  }

  unsubscribe(uri: string): void {
    parseEventsUri(uri);
    this.subscriptions.delete(uri);
    if (this.subscriptions.size === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  close(): void {
    this.closed = true;
    this.subscriptions.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delayMs: number): void {
    if (this.closed || this.polling || this.timer || this.subscriptions.size === 0) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.poll();
    }, delayMs);
    this.timer.unref?.();
  }

  private async poll(): Promise<void> {
    if (this.closed || this.polling || this.subscriptions.size === 0) return;
    this.polling = true;
    try {
      for (const [uri, subscription] of [...this.subscriptions]) {
        try {
          const page = await this.client.events.list({
            after: subscription.cursor,
            limit: DEFAULT_LIMIT,
          });

          // A assinatura pode ter sido cancelada enquanto o fetch estava no ar.
          if (this.closed || this.subscriptions.get(uri) !== subscription) continue;
          if (page.data.length === 0) continue;

          await this.server.server.sendResourceUpdated({ uri });
          subscription.cursor = page.paging.cursor;
        } catch {
          // Falhas transitórias não encerram a sessão MCP. A leitura explícita
          // continua expondo o erro estruturado do SDK ao cliente.
        }
      }
    } finally {
      this.polling = false;
      this.schedule(this.pollIntervalMs);
    }
  }
}

export interface RegisterEventResourcesOptions {
  pollIntervalMs: number;
}

export function registerEventResources(
  server: McpServer,
  client: Client,
  options: RegisterEventResourcesOptions,
): () => void {
  const subscriptions = new EventSubscriptions(
    server,
    client,
    Math.max(1, options.pollIntervalMs),
  );

  server.registerResource(
    "events",
    new ResourceTemplate(EVENTS_URI_TEMPLATE, { list: undefined }),
    {
      title: "Eventos do WhatsApp",
      description:
        "Stream durável de Eventos da Conta e ambiente autenticados, lido em ordem crescente pelo cursor `after`.",
      mimeType: "application/json",
    },
    async (uri) => {
      const params = parseEventsUri(uri.href);
      const page = await client.events.list(params);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(page),
          },
        ],
      };
    },
  );

  server.server.setRequestHandler(
    SubscribeRequestSchema,
    (request) => {
      subscriptions.subscribe(request.params.uri);
      return {};
    },
  );
  server.server.setRequestHandler(
    UnsubscribeRequestSchema,
    (request) => {
      subscriptions.unsubscribe(request.params.uri);
      return {};
    },
  );

  return () => subscriptions.close();
}

function parseEventsUri(uri: string): EventCursor {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw invalidUri();
  }

  const keys = [...parsed.searchParams.keys()];
  const hasUnknownParam = keys.some((key) => key !== "after" && key !== "limit");
  const hasDuplicateParam =
    parsed.searchParams.getAll("after").length > 1 ||
    parsed.searchParams.getAll("limit").length > 1;
  if (
    parsed.protocol !== "botozap:" ||
    parsed.hostname !== "events" ||
    parsed.port !== "" ||
    parsed.pathname !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== "" ||
    hasUnknownParam ||
    hasDuplicateParam
  ) {
    throw invalidUri();
  }

  const after = parsed.searchParams.get("after") ?? "0";
  const afterNumber = Number(after);
  if (!/^\d+$/.test(after) || !Number.isSafeInteger(afterNumber) || afterNumber < 0) {
    throw invalidUri();
  }

  const rawLimit = parsed.searchParams.get("limit");
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (
    (rawLimit !== null && !/^\d+$/.test(rawLimit)) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw invalidUri();
  }

  return { after, limit };
}

function invalidUri(): McpError {
  return new McpError(
    ErrorCode.InvalidParams,
    "URI de Eventos inválida. Use botozap://events?after=<cursor>&limit=<1..100>.",
  );
}
