/**
 * Lectura de archivos (CSV, XLSX, XLS, JSON) a una tabla cruda.
 * Se ejecuta en el navegador: los datos no salen del equipo del usuario.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface RawTable {
  headers: string[];
  rows: Record<string, unknown>[];
}

export type SupportedFormat = "csv" | "xlsx" | "xls" | "json";

export interface LoadedFile {
  format: SupportedFormat;
  /** Hojas disponibles (solo Excel). */
  sheets: string[];
  /** Devuelve la tabla de la hoja indicada (o la única tabla). */
  readTable: (sheet?: string) => RawTable;
}

export const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls,.json";

export function detectFormat(fileName: string): SupportedFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext === "csv" || ext === "xlsx" || ext === "xls" || ext === "json" ? ext : null;
}

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
  return [...set];
}

function flatten(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

function parseCsv(text: string): RawTable {
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  if (res.errors.length && !res.data.length) {
    throw new Error(`No se pudo leer el CSV: ${res.errors[0]?.message ?? "formato inválido"}`);
  }
  const headers = (res.meta.fields ?? []).filter((h) => h !== "");
  return { headers, rows: res.data };
}

function parseJson(text: string): RawTable {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo JSON no es válido.");
  }
  let arr: unknown[] | undefined;
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === "object") {
    arr = Object.values(data).find((v): v is unknown[] => Array.isArray(v));
  }
  if (!arr || arr.length === 0) {
    throw new Error("El JSON debe contener una lista de registros (array de objetos).");
  }
  const rows = arr.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).map(([k, v]) => [k, flatten(v)]),
      );
    }
    return { valor: flatten(item) };
  });
  return { headers: collectHeaders(rows), rows };
}

function readSheet(wb: XLSX.WorkBook, sheet: string): RawTable {
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`La hoja "${sheet}" no existe.`);
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((h, i) =>
    h === null || h === undefined || String(h).trim() === "" ? `columna_${i + 1}` : String(h),
  );
  const rows = matrix
    .slice(1)
    .filter((r) => r.some((v) => v !== null && v !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return { headers, rows };
}

export async function loadFile(file: File): Promise<LoadedFile> {
  const format = detectFormat(file.name);
  if (!format) throw new Error("Formato no soportado. Usa CSV, XLSX, XLS o JSON.");

  if (format === "csv" || format === "json") {
    const text = await file.text();
    const table = format === "csv" ? parseCsv(text) : parseJson(text);
    return { format, sheets: [], readTable: () => table };
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  if (wb.SheetNames.length === 0) throw new Error("El libro no contiene hojas.");
  return {
    format,
    sheets: wb.SheetNames,
    readTable: (sheet) => readSheet(wb, sheet ?? wb.SheetNames[0]!),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
