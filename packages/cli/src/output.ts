import pc from "picocolors";
import type { CursorPaging, OffsetMeta } from "@botozap/sdk";

export type OutputFormat = "human" | "json";

/** Resolve o formato a partir do valor da flag `-o/--output`. */
export function resolveFormat(value: string | undefined): OutputFormat {
  return value === "json" ? "json" : "human";
}

/** Imprime JSON cru (indentado) — modo `--output json` para scripting. */
export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

/** Mensagem informativa simples (stderr não; vai pro stdout). */
export function printLine(line: string): void {
  process.stdout.write(line + "\n");
}

export function dim(text: string): string {
  return pc.dim(text);
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function truncate(text: string, max = 48): string {
  const flat = text.replace(/\s+/g, " ");
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

export interface Column {
  /** Cabeçalho exibido. */
  header: string;
  /** Chave a extrair do registro (suporta caminho com ponto, ex.: "language.code"). */
  key: string;
  /** Transformação opcional do valor. */
  format?: (value: unknown, row: Record<string, unknown>) => string;
  /** Largura máxima da célula (trunca com …). */
  max?: number;
}

function pick(row: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return row[key];
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, row);
}

/** Tabela compacta de largura fixa para o modo `human`. */
export function printTable(
  rows: Record<string, unknown>[],
  columns: Column[],
): void {
  if (rows.length === 0) {
    printLine(dim("(nenhum resultado)"));
    return;
  }

  const cells: string[][] = rows.map((row) =>
    columns.map((col) => {
      const raw = pick(row, col.key);
      const str = col.format ? col.format(raw, row) : valueToString(raw);
      return truncate(str, col.max ?? 48);
    }),
  );

  const widths = columns.map((col, i) => {
    const headerLen = col.header.length;
    const maxCell = cells.reduce((w, r) => Math.max(w, (r[i] ?? "").length), 0);
    return Math.max(headerLen, maxCell);
  });

  const headerLine = columns
    .map((col, i) => pc.bold(col.header.padEnd(widths[i] ?? 0)))
    .join("  ");
  printLine(headerLine);

  for (const row of cells) {
    printLine(row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  "));
  }
}

/** Pares chave/valor para detalhe de um único recurso (modo `human`). */
export function printDetail(
  obj: Record<string, unknown>,
  keys?: string[],
): void {
  const entries = keys
    ? keys.map((k) => [k, pick(obj, k)] as const)
    : Object.entries(obj);
  const width = Math.max(...entries.map(([k]) => k.length));
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    printLine(`${pc.bold(key.padEnd(width))}  ${valueToString(value)}`);
  }
}

/** Rodapé de paginação por cursor. */
export function printCursorFooter(paging?: CursorPaging): void {
  if (!paging) return;
  const after = paging.cursors?.after;
  const before = paging.cursors?.before;
  const parts: string[] = [];
  if (after) parts.push(`próxima: --after ${after}`);
  if (before) parts.push(`anterior: --before ${before}`);
  if (parts.length) printLine(dim(parts.join("   ")));
}

/** Rodapé de paginação por offset. */
export function printOffsetFooter(meta?: OffsetMeta): void {
  if (!meta) return;
  const { page, total_pages, total_count } = meta;
  const bits: string[] = [];
  if (page !== undefined && total_pages !== undefined) {
    bits.push(`página ${page}/${total_pages}`);
  }
  if (total_count !== undefined) bits.push(`${total_count} no total`);
  if (bits.length) printLine(dim(bits.join("   ")));
}
