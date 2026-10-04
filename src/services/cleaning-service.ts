/**
 * Motor de limpieza. Funciones puras: reciben una tabla y devuelven una
 * NUEVA tabla con el resultado. Nunca mutan la entrada, de modo que el
 * dataset original siempre se conserva.
 */
import type { ColumnProfile } from "@/lib/types";
import type { RawTable } from "./file-parser";
import { displayValue, isNullish, toDate, toLooseNumber, toNumber } from "./profiling-service";

export interface OpResult {
  table: RawTable;
  affected: number;
  result: string;
  warnings: string[];
  samples: { before: string; after: string }[];
}

type Row = Record<string, unknown>;

function mapColumn(
  t: RawTable,
  col: string,
  fn: (v: unknown, row: Row) => unknown,
): { table: RawTable; affected: number; samples: OpResult["samples"] } {
  let affected = 0;
  const samples: OpResult["samples"] = [];
  const rows = t.rows.map((r) => {
    const before = r[col];
    const after = fn(before, r);
    if (after === before || (isNullish(after) && isNullish(before)) || displayValue(after) === displayValue(before) && typeof after === typeof before) return r;
    affected++;
    if (samples.length < 6) samples.push({ before: displayValue(before), after: displayValue(after) });
    return { ...r, [col]: after };
  });
  return { table: { headers: t.headers, rows }, affected, samples };
}

const done = (
  table: RawTable,
  affected: number,
  result: string,
  extra: Partial<Pick<OpResult, "warnings" | "samples">> = {},
): OpResult => ({ table, affected, result, warnings: extra.warnings ?? [], samples: extra.samples ?? [] });

/* ---------------- Duplicados ---------------- */

/** Índices de filas que repiten a una anterior (según columnas o todas). */
export function findDuplicates(t: RawTable, cols: string[]): number[] {
  const keyCols = cols.length ? cols : t.headers;
  const seen = new Set<string>();
  const dups: number[] = [];
  t.rows.forEach((r, i) => {
    const k = JSON.stringify(keyCols.map((c) => displayValue(r[c])));
    if (seen.has(k)) dups.push(i);
    else seen.add(k);
  });
  return dups;
}

export function removeRows(t: RawTable, indices: number[], label: string): OpResult {
  const set = new Set(indices);
  const rows = t.rows.filter((_, i) => !set.has(i));
  return done({ headers: t.headers, rows }, set.size, `${set.size} ${label} eliminada(s); quedan ${rows.length} filas`);
}

/* ---------------- Valores faltantes ---------------- */

export type MissingStrategy =
  | "eliminar_filas"
  | "eliminar_columna"
  | "media"
  | "mediana"
  | "moda"
  | "personalizado"
  | "mantener";

export const missingLabels: Record<MissingStrategy, string> = {
  eliminar_filas: "Eliminar filas",
  eliminar_columna: "Eliminar columna",
  media: "Media",
  mediana: "Mediana",
  moda: "Moda",
  personalizado: "Valor personalizado",
  mantener: "Mantener NULL",
};

export function recommendMissing(p: ColumnProfile, totalRows: number): { strategy: MissingStrategy; reason: string } {
  if (p.missingPct >= 50) return { strategy: "eliminar_columna", reason: "Más de la mitad de los valores faltan." };
  if ((p.nullCount ?? 0) / Math.max(totalRows, 1) < 0.02)
    return { strategy: "eliminar_filas", reason: "Muy pocas filas afectadas (<2%)." };
  if (p.type === "numerica") {
    const skew = p.mean !== undefined && p.median !== undefined && p.std ? Math.abs(p.mean - p.median) / p.std : 0;
    return skew > 0.2
      ? { strategy: "mediana", reason: "Numérica con distribución asimétrica u outliers: la mediana es robusta." }
      : { strategy: "media", reason: "Numérica con distribución aproximadamente simétrica." };
  }
  if (p.type === "fecha") return { strategy: "mantener", reason: "Imputar fechas puede introducir sesgo temporal." };
  if (p.type === "texto") return { strategy: "personalizado", reason: "Texto libre: usar un valor como «Desconocido»." };
  return { strategy: "moda", reason: "Categórica/booleana: la moda conserva la distribución." };
}

export function applyMissing(t: RawTable, col: string, strategy: MissingStrategy, custom: string): OpResult {
  const nulls = t.rows.filter((r) => isNullish(r[col])).length;
  if (strategy === "mantener") return done(t, 0, "Valores nulos conservados");
  if (strategy === "eliminar_filas") {
    const idx = t.rows.flatMap((r, i) => (isNullish(r[col]) ? [i] : []));
    return removeRows(t, idx, "fila(s) con nulos");
  }
  if (strategy === "eliminar_columna") {
    const headers = t.headers.filter((h) => h !== col);
    const rows = t.rows.map(({ [col]: _drop, ...rest }) => rest);
    return done({ headers, rows }, t.rows.length, `Columna "${col}" eliminada`);
  }
  const present = t.rows.map((r) => r[col]).filter((v) => !isNullish(v));
  let fill: unknown;
  const warnings: string[] = [];
  if (strategy === "media" || strategy === "mediana") {
    const nums = present.map(toNumber).filter((n): n is number => n !== null).sort((a, b) => a - b);
    if (!nums.length) return done(t, 0, "Sin valores numéricos para calcular", { warnings: ["La columna no contiene números."] });
    if (nums.length < present.length) warnings.push(`${present.length - nums.length} valor(es) no numéricos se ignoraron en el cálculo.`);
    fill =
      strategy === "media"
        ? Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 100) / 100
        : nums.length % 2
          ? nums[(nums.length - 1) / 2]
          : (nums[nums.length / 2 - 1]! + nums[nums.length / 2]!) / 2;
  } else if (strategy === "moda") {
    const freq = new Map<string, { v: unknown; c: number }>();
    for (const v of present) {
      const k = displayValue(v);
      const e = freq.get(k);
      if (e) e.c++;
      else freq.set(k, { v, c: 1 });
    }
    fill = [...freq.values()].sort((a, b) => b.c - a.c)[0]?.v;
  } else {
    if (custom.trim() === "") return done(t, 0, "Sin valor", { warnings: ["Escribe un valor personalizado."] });
    fill = custom;
  }
  const m = mapColumn(t, col, (v) => (isNullish(v) ? fill : v));
  return done(m.table, nulls, `${nulls} nulo(s) reemplazados por ${displayValue(fill)}`, { warnings, samples: m.samples });
}

/* ---------------- Texto ---------------- */

export type TextOp = "trim" | "collapse" | "lower" | "upper" | "capitalize" | "strip";

export const textOpLabels: Record<TextOp, string> = {
  trim: "Eliminar espacios iniciales/finales",
  collapse: "Normalizar espacios múltiples",
  lower: "Minúsculas",
  upper: "Mayúsculas",
  capitalize: "Capitalización",
  strip: "Eliminar caracteres innecesarios",
};

export function applyText(t: RawTable, col: string, ops: TextOp[]): OpResult {
  const m = mapColumn(t, col, (v) => {
    if (typeof v !== "string") return v;
    let s = v;
    if (ops.includes("strip")) s = s.replace(/[^\p{L}\p{N}\s\-_.,@/:'()&]/gu, "");
    if (ops.includes("collapse")) s = s.replace(/\s+/g, " ");
    if (ops.includes("trim")) s = s.trim();
    if (ops.includes("lower")) s = s.toLowerCase();
    if (ops.includes("upper")) s = s.toUpperCase();
    if (ops.includes("capitalize")) s = s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b: string) => a + b.toUpperCase());
    return s;
  });
  return done(m.table, m.affected, `${m.affected} valor(es) estandarizados`, { samples: m.samples });
}

/* ---------------- Fechas ---------------- */

export interface DateAnalysis {
  formats: { label: string; count: number }[];
  ambiguous: number;
  unparseable: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
const XYZ = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/;

function fmtIso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function analyzeDates(t: RawTable, col: string): DateAnalysis {
  const counts = new Map<string, number>();
  let ambiguous = 0;
  let unparseable = 0;
  const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const r of t.rows) {
    const v = r[col];
    if (isNullish(v)) continue;
    if (v instanceof Date) { add("Fecha nativa"); continue; }
    const s = String(v).trim();
    if (ISO.test(s)) add("YYYY-MM-DD");
    else if (YMD.test(s)) add("YYYY/MM/DD");
    else {
      const x = s.match(XYZ);
      if (x) {
        const a = Number(x[1]), b = Number(x[2]);
        if (a <= 12 && b <= 12 && a !== b) { ambiguous++; add("DD/MM o MM/DD (ambiguo)"); }
        else if (a > 12) add("DD/MM/YYYY");
        else if (b > 12) add("MM/DD/YYYY");
        else add("DD/MM/YYYY");
      } else unparseable++;
    }
  }
  return { formats: [...counts.entries()].map(([label, count]) => ({ label, count })), ambiguous, unparseable };
}

export function convertDates(t: RawTable, col: string, order: "dmy" | "mdy", includeAmbiguous: boolean): OpResult {
  let skipped = 0;
  let failed = 0;
  const m = mapColumn(t, col, (v) => {
    if (isNullish(v)) return v;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (ISO.test(s)) return s;
    const y = s.match(YMD);
    if (y) return fmtIso(Number(y[1]), Number(y[2]), Number(y[3])) ?? (failed++, v);
    const x = s.match(XYZ);
    if (!x) { failed++; return v; }
    let a = Number(x[1]), b = Number(x[2]);
    const yy = x[3]!.length === 2 ? 2000 + Number(x[3]) : Number(x[3]);
    const amb = a <= 12 && b <= 12 && a !== b;
    if (amb && !includeAmbiguous) { skipped++; return v; }
    const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : order === "dmy" ? [a, b] : [b, a];
    a = d; b = mo;
    return fmtIso(yy, b, a) ?? (failed++, v);
  });
  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} fecha(s) ambiguas NO se modificaron. Activa la opción para convertirlas asumiendo el orden elegido.`);
  if (includeAmbiguous) warnings.push("Las fechas ambiguas se interpretarán con el orden seleccionado. Verifica que sea correcto.");
  if (failed) warnings.push(`${failed} valor(es) no se reconocieron como fecha y se dejaron igual.`);
  return done(m.table, m.affected, `${m.affected} fecha(s) convertidas a YYYY-MM-DD`, { warnings, samples: m.samples });
}

/* ---------------- Categorías equivalentes ---------------- */

export interface CategoryGroup {
  canonical: string;
  variants: { value: string; count: number }[];
}

const normKey = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

export function proposeCategoryGroups(t: RawTable, col: string): CategoryGroup[] {
  const freq = new Map<string, number>();
  for (const r of t.rows) {
    const v = r[col];
    if (isNullish(v)) continue;
    const s = String(v);
    freq.set(s, (freq.get(s) ?? 0) + 1);
  }
  if (freq.size > 500) return [];
  // Agrupar por clave normalizada y luego unir claves casi iguales.
  const byKey = new Map<string, { value: string; count: number }[]>();
  for (const [value, count] of freq) {
    const k = normKey(value);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push({ value, count });
  }
  const keys = [...byKey.keys()].sort((a, b) => sum(byKey.get(b)!) - sum(byKey.get(a)!));
  const merged: { value: string; count: number }[][] = [];
  const used = new Set<string>();
  for (const k of keys) {
    if (used.has(k)) continue;
    used.add(k);
    const group = [...byKey.get(k)!];
    for (const k2 of keys) {
      if (used.has(k2) || k.length < 4) continue;
      if (lev(k, k2) <= (k.length >= 8 ? 2 : 1)) {
        used.add(k2);
        group.push(...byKey.get(k2)!);
      }
    }
    if (group.length > 1) merged.push(group.sort((a, b) => b.count - a.count));
  }
  return merged.map((g) => ({ canonical: g[0]!.value.trim(), variants: g }));
}

function sum(g: { count: number }[]) {
  return g.reduce((s, x) => s + x.count, 0);
}

export function applyCategoryMapping(t: RawTable, col: string, mapping: Record<string, string>): OpResult {
  const m = mapColumn(t, col, (v) => (typeof v === "string" && mapping[v] !== undefined ? mapping[v] : v));
  return done(m.table, m.affected, `${m.affected} valor(es) unificados en ${new Set(Object.values(mapping)).size} categoría(s)`, {
    samples: m.samples,
  });
}

/* ---------------- Tipos ---------------- */

export type TypeTarget = "numero" | "fecha" | "decimal" | "entero";

export const typeTargetLabels: Record<TypeTarget, string> = {
  numero: "Texto → número",
  fecha: "Texto → fecha",
  decimal: "Entero → decimal",
  entero: "Decimal → entero (si es seguro)",
};

export function convertType(t: RawTable, col: string, target: TypeTarget): OpResult {
  let failed = 0;
  const bad: string[] = [];
  const fail = (v: unknown) => {
    failed++;
    if (bad.length < 5) bad.push(displayValue(v));
    return v;
  };
  const m = mapColumn(t, col, (v) => {
    if (isNullish(v)) return v;
    if (target === "numero" || target === "decimal") {
      const n = toLooseNumber(v);
      return n === null ? fail(v) : target === "decimal" ? Number(n.toFixed(Math.max(1, (String(n).split(".")[1] ?? "").length))) : n;
    }
    if (target === "fecha") {
      const d = toDate(v);
      return d ? d.toISOString().slice(0, 10) : fail(v);
    }
    const n = toLooseNumber(v);
    if (n === null) return fail(v);
    return Number.isInteger(n) ? Math.trunc(n) : fail(v);
  });
  const warnings: string[] = [];
  if (failed) {
    warnings.push(
      target === "entero"
        ? `${failed} valor(es) tienen decimales o no son números y no se convirtieron (ej.: ${bad.join(", ")}). Conversión no totalmente segura.`
        : `${failed} valor(es) no pudieron convertirse y se dejaron igual (ej.: ${bad.join(", ")}).`,
    );
  }
  return done(m.table, m.affected, `${m.affected} valor(es) convertidos · ${failed} sin convertir`, { warnings, samples: m.samples });
}

/* ---------------- Outliers ---------------- */

export type OutlierMethod = "iqr" | "zscore";
export type OutlierAction = "mantener" | "eliminar" | "reemplazar" | "marcar";

export const outlierActionLabels: Record<OutlierAction, string> = {
  mantener: "Mantener",
  eliminar: "Eliminar filas",
  reemplazar: "Reemplazar por la mediana",
  marcar: "Marcar para revisión",
};

export interface OutlierDetection {
  indices: number[];
  lower: number;
  upper: number;
  median: number;
}

export function detectOutliers(t: RawTable, col: string, method: OutlierMethod): OutlierDetection {
  const pairs = t.rows.flatMap((r, i) => {
    const n = toNumber(r[col]);
    return n === null ? [] : [{ i, n }];
  });
  const sorted = pairs.map((p) => p.n).sort((a, b) => a - b);
  if (sorted.length < 4) return { indices: [], lower: 0, upper: 0, median: 0 };
  const q = (p: number) => {
    const pos = (sorted.length - 1) * p;
    const lo = Math.floor(pos);
    return sorted[lo]! + (sorted[Math.ceil(pos)]! - sorted[lo]!) * (pos - lo);
  };
  const median = q(0.5);
  let lower: number, upper: number;
  if (method === "iqr") {
    const iqr = q(0.75) - q(0.25);
    lower = q(0.25) - 1.5 * iqr;
    upper = q(0.75) + 1.5 * iqr;
  } else {
    const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length;
    const std = Math.sqrt(sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / (sorted.length - 1));
    lower = mean - 3 * std;
    upper = mean + 3 * std;
  }
  return {
    indices: pairs.filter((p) => p.n < lower || p.n > upper).map((p) => p.i),
    lower: Math.round(lower * 100) / 100,
    upper: Math.round(upper * 100) / 100,
    median,
  };
}

export function applyOutliers(t: RawTable, col: string, det: OutlierDetection, action: OutlierAction): OpResult {
  const set = new Set(det.indices);
  if (action === "mantener") return done(t, 0, "Outliers conservados sin cambios");
  if (action === "eliminar") return removeRows(t, det.indices, "fila(s) con outliers");
  if (action === "reemplazar") {
    const rows = t.rows.map((r, i) => (set.has(i) ? { ...r, [col]: det.median } : r));
    return done({ headers: t.headers, rows }, set.size, `${set.size} outlier(s) reemplazados por la mediana (${det.median})`);
  }
  const flag = `${col}_revisar`;
  const headers = t.headers.includes(flag) ? t.headers : [...t.headers, flag];
  const rows = t.rows.map((r, i) => ({ ...r, [flag]: set.has(i) ? "sí" : "no" }));
  return done({ headers, rows }, set.size, `${set.size} registro(s) marcados en la columna "${flag}"`);
}
