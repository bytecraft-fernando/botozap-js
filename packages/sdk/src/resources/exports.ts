import type { BotoZap } from "../client.js";

/** Formato do arquivo exportado. */
export type ExportFormat = "json" | "csv";

/**
 * Estado do pedido: `pending` (na fila), `processing` (gerando), `ready`
 * (pronto para baixar), `failed` (veja `error`) ou `expired` (passou o prazo de
 * 7 dias e o arquivo foi apagado). Valores novos podem surgir.
 */
export type ExportStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "expired"
  | (string & {});

/** Abrangência do pedido: a Conta inteira ou um Cliente. */
export type ExportScope =
  | { type: "account"; customer_id: null; customer_name: null }
  | { type: "customer"; customer_id: string; customer_name: string | null };

/** Link de download assinado; só vem em `exports.get`, com o pedido pronto. */
export interface ExportDownload {
  /** URL assinada do zip, com um arquivo por tipo de dado. */
  url: string;
  /** Validade do link, em segundos (poucos minutos). Peça de novo para receber outro. */
  expires_in: number;
}

/** Pedido de exportação de dados da Conta. */
export interface AccountExport {
  id: string;
  status: ExportStatus;
  format: ExportFormat;
  scope: ExportScope;
  /** Quem pediu (nome da pessoa, "Aplicativo conectado" ou "API (chave …)"). */
  requested_by: string;
  /** Por onde foi pedido: `painel` ou `api`. */
  requested_via: "painel" | "api" | (string & {});
  /** ISO 8601. */
  created_at: string;
  /** Quando terminou; `null` enquanto não terminou. */
  finished_at: string | null;
  /** Quando o arquivo é apagado (7 dias depois de pronto); `null` antes de pronto. */
  expires_at: string | null;
  size_bytes: number | null;
  /** Quantidade de registros por tipo; `null` antes de pronto. */
  counts: Record<string, number> | null;
  /** Só em `failed`: `export_failed`, `export_too_large`, `storage_unavailable`, `scope_not_found` ou `account_deleting`. */
  error: { code: string; message: string } | null;
  /** Link de download: só em `exports.get`, com o pedido pronto e dentro do prazo. */
  download: ExportDownload | null;
}

/** Corpo de `exports.create`. */
export interface CreateExportParams {
  /** Exporta só este Cliente; sem ele, a Conta inteira. */
  customer_id?: string;
  /** `json` (padrão) ou `csv`. */
  format?: ExportFormat;
}

/**
 * Exportação de dados (`/v1/exports`), pedida pela API ou pelo painel. O arquivo
 * é gerado em fila, fica 7 dias e vem num zip com um arquivo por tipo de dado.
 */
export class Exports {
  constructor(private readonly client: BotoZap) {}

  /**
   * Pede a exportação completa da Conta, ou de um Cliente (`customer_id`). Scope
   * `exports:write`. Responde 202 com o pedido novo; pedido igual enquanto o
   * anterior ainda está na fila devolve o mesmo (200). Funciona com a Conta em
   * somente leitura por exclusão: é o que se faz antes da exclusão começar. Cliente
   * inexistente é 404 `not_found`; exclusão já iniciada, 409
   * `account_deletion_in_progress`; muitos pedidos seguidos, 429 `rate_limited`.
   */
  create(params: CreateExportParams = {}): Promise<AccountExport> {
    return this.client.requestItem<AccountExport>("POST", "/exports", {
      body: params,
    });
  }

  /**
   * Últimos pedidos da Conta (até 50), do mais novo ao mais antigo, sem o link de
   * download. Scope `exports:read`.
   */
  list(): Promise<AccountExport[]> {
    return this.client.requestItem<AccountExport[]>("GET", "/exports");
  }

  /**
   * Estado de um pedido e, quando pronto e dentro do prazo, `download` com um
   * link assinado de poucos minutos: cada consulta gera um novo. Scope
   * `exports:read`. Pedido de outra Conta é 404 `not_found`.
   */
  get(id: string): Promise<AccountExport> {
    return this.client.requestItem<AccountExport>(
      "GET",
      `/exports/${encodeURIComponent(id)}`,
    );
  }
}
