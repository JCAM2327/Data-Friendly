/**
 * Perfilado y diagnóstico automático. Funciones puras: no modifican datos,
 * solo describen la tabla y proponen correcciones.
 */
import type { ColumnProfile, ColumnType, DatasetSummary, QualityIssue, QualitySeverity } from "@/lib/types";
import type { RawTable } from "./file-parser";

const NULL_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "—", "?", "undefined"]);
const BOOL_TOKENS = new Set(["true", "false", "verdadero", "falso", "si", "sí", "no", "yes"]);

export function isNullish(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v);
  if (typeof v === "string") return NULL_TOKENS.has(v.trim().toLowerCase());
  return false;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!/^[-+]?[\d.,]+(e[-+]?\d+)?$/i.test(s)) return null;
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Número "sucio": con símbolos de moneda, % o espacios. */
export function toLooseNumber(v: unknown): number | null {
  if (typeof v !== "string") return toNumber(v);
  return toNumber(v.replace(/[€$£%\s]/g, ""));
}

const DATE_RE = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})([ T]\d{1,2}:\d{2}(:\d{2})?)?/;

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string" || !DATE_RE.test(v.trim())) return null;
  const s = v.trim();
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  const d = dmy ? new Date(Number(dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isBool(v: unknown): boolean {
  return typeof v === "boolean" || (typeof v === "string" && BOOL_TOKENS.has(v.trim().toLowerCase()));
}

export function displayValue(v: unknown): string {
  if (isNullish(v)) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function median(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

interface ColumnAnalysis {
  profile: ColumnProfile;
  values: unknown[];
  numericShare: number;
  looseNumericShare: number;
  stringDates: boolean;
  numbers: number[];
}

function analyzeColumn(name: string, raw: unknown[]): ColumnAnalysis {
  const total = raw.length;
  const values = raw.filter((v) => !isNullish(v));
  const count = values.length;
  const nullCount = total - count;

  const numbers: number[] = [];
  let dates = 0;
  let bools = 0;
  let loose = 0;
  let stringDates = false;
  const freq = new Map<string, number>();
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) numbers.push(n);
    else if (toLooseNumber(v) !== null) loose++;
    if (n === null && toDate(v)) {
      dates++;
      if (typeof v === "string") stringDates = true;
    }
    if (isBool(v)) bools++;
    const key = displayValue(v);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const uniqueCount = freq.size;
  const share = (x: number) => (count ? x / count : 0);

  let type: ColumnType;
  if (count === 0) type = "texto";
  else if (share(bools) >= 0.95 && uniqueCount <= 3) type = "booleana";
  else if (share(numbers.length) >= 0.6) type = "numerica";
  else if (share(dates) >= 0.8) type = "fecha";
  else if (uniqueCount <= Math.max(20, count * 0.05)) type = "categorica";
  else type = "texto";

  const sortedFreq = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const firstValues = raw.slice(0, 3).map(displayValue);
  const profile: ColumnProfile = {
    name,
    type,
    count,
    nullCount,
    missingPct: total ? round((nullCount / total) * 100, 2) : 0,
    uniqueCount,
    sample: firstValues.find((v) => v !== "—") ?? "—",
    firstValues,
    mode: sortedFreq[0] && sortedFreq[0][1] > 1 ? sortedFreq[0][0] : undefined,
  };

  if (type === "numerica" && numbers.length) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mean = numbers.reduce((s, x) => s + x, 0) / numbers.length;
    const variance =
      numbers.length > 1 ? numbers.reduce((s, x) => s + (x - mean) ** 2, 0) / (numbers.length - 1) : 0;
    profile.min = String(round(sorted[0]!));
    profile.max = String(round(sorted[sorted.length - 1]!));
    profile.mean = round(mean);
    profile.median = round(median(sorted));
    profile.std = round(Math.sqrt(variance));
  } else if (type === "fecha") {
    const ts = values.map(toDate).filter((d): d is Date => d !== null).map((d) => d.getTime()).sort((a, b) => a - b);
    if (ts.length) {
      profile.min = new Date(ts[0]!).toISOString().slice(0, 10);
      profile.max = new Date(ts[ts.length - 1]!).toISOString().slice(0, 10);
    }
  } else if (count) {
    const lens = values.map((v) => String(v).length);
    profile.min = sortedFreq.map((e) => e[0]).sort()[0];
    profile.max = sortedFreq.map((e) => e[0]).sort().at(-1);
    if (type === "texto") profile.mean = round(lens.reduce((s, x) => s + x, 0) / lens.length, 1);
  }

  if (type === "categorica" || type === "booleana") {
    profile.topCategories = sortedFreq.slice(0, 5).map(([value, c]) => ({ value, count: c }));
  }

  return {
    profile,
    values: raw,
    numericShare: share(numbers.length),
    looseNumericShare: share(numbers.length + loose),
    stringDates,
    numbers,
  };
}

const SEVERITY_WEIGHT: Record<QualitySeverity, number> = { critica: 15, alta: 8, media: 4, baja: 1 };

export function scoreFromIssues(issues: QualityIssue[], missingPct: number, duplicatePct: number): number {
  const penalty =
    issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0) + missingPct * 0.8 + duplicatePct * 1.2;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

function missingSeverity(pct: number): QualitySeverity | null {
  if (pct >= 50) return "critica";
  if (pct >= 20) return "alta";
  if (pct >= 5) return "media";
  return null;
}

export function profileTable(
  table: RawTable,
  meta: { name: string; source: string; sizeLabel: string; sheetName?: string | undefined; isDemo?: boolean | undefined },
): DatasetSummary {
  const { headers, rows } = table;
  const nRows = rows.length;
  const issues: QualityIssue[] = [];
  const push = (i: QualityIssue) => issues.push(i);

  const analyses = headers.map((h) => analyzeColumn(h, rows.map((r) => r[h])));

  // Filas duplicadas
  const seen = new Set<string>();
  let duplicates = 0;
  for (const r of rows) {
    const key = JSON.stringify(headers.map((h) => displayValue(r[h])));
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  }
  if (duplicates > 0) {
    const pct = (duplicates / nRows) * 100;
    push({
      id: "dup-filas",
      title: "Filas duplicadas",
      detail: `${duplicates} fila(s) idénticas a otra (${pct.toFixed(1)}%).`,
      severity: pct >= 10 ? "critica" : pct >= 2 ? "alta" : "media",
      affectedRows: duplicates,
      suggestedFix: "Eliminar duplicados exactos conservando la primera aparición.",
    });
  }

  // Columnas duplicadas
  const colKeys = new Map<string, string>();
  for (const a of analyses) {
    if (a.profile.count === 0) continue;
    const key = JSON.stringify(a.values.map(displayValue));
    const prev = colKeys.get(key);
    if (prev) {
      push({
        id: `dup-col-${a.profile.name}`,
        title: "Columna duplicada",
        detail: `"${a.profile.name}" tiene exactamente los mismos valores que "${prev}".`,
        severity: "media",
        column: a.profile.name,
        affectedRows: nRows,
        suggestedFix: `Eliminar "${a.profile.name}" y conservar "${prev}".`,
      });
    } else colKeys.set(key, a.profile.name);
  }

  for (const a of analyses) {
    const p = a.profile;
    const col = p.name;
    const count = p.count ?? 0;

    // Faltantes
    if (count === 0) {
      push({
        id: `vacia-${col}`,
        title: "Columna completamente vacía",
        detail: "Todos los valores son nulos.",
        severity: "alta",
        column: col,
        affectedRows: nRows,
        suggestedFix: "Eliminar la columna: no aporta información.",
      });
      continue;
    }
    const ms = missingSeverity(p.missingPct);
    if (ms) {
      push({
        id: `nulos-${col}`,
        title: "Demasiados valores faltantes",
        detail: `${p.missingPct}% de nulos (${p.nullCount} registros).`,
        severity: ms,
        column: col,
        affectedRows: p.nullCount ?? 0,
        suggestedFix:
          p.missingPct >= 50
            ? "Valorar eliminar la columna o crear un indicador de ausencia."
            : p.type === "numerica"
              ? "Imputar con la mediana o un modelo; revisar si la ausencia es informativa."
              : "Imputar con la moda o una categoría «Desconocido».",
      });
    }

    // Constante
    if (p.uniqueCount === 1 && nRows > 1) {
      push({
        id: `constante-${col}`,
        title: "Columna constante",
        detail: `Siempre toma el valor "${p.sample}".`,
        severity: "media",
        column: col,
        affectedRows: count,
        suggestedFix: "Eliminar la columna: no tiene variabilidad.",
      });
    }

    // Identificador
    if (p.uniqueCount === nRows && nRows >= 10 && p.type !== "fecha" && (p.type !== "numerica" || a.numbers.every(Number.isInteger))) {
      push({
        id: `id-${col}`,
        title: "Posible identificador",
        detail: "Todos los valores son únicos.",
        severity: "baja",
        column: col,
        affectedRows: 0,
        suggestedFix: "Usar como clave; excluir de los modelos predictivos.",
      });
    }

    // Fecha como texto
    if (p.type === "fecha" && a.stringDates) {
      push({
        id: `fecha-${col}`,
        title: "Posible fecha almacenada como texto",
        detail: `Rango detectado: ${p.min} → ${p.max}.`,
        severity: "baja",
        column: col,
        affectedRows: count,
        suggestedFix: "Convertir a tipo fecha con un formato explícito.",
      });
    }

    // Numérica que parece categórica
    if (p.type === "numerica" && p.uniqueCount <= 10 && nRows >= 50 && p.uniqueCount > 2) {
      push({
        id: `cat-num-${col}`,
        title: "Posible variable categórica codificada",
        detail: `Numérica con solo ${p.uniqueCount} valores distintos.`,
        severity: "baja",
        column: col,
        affectedRows: 0,
        suggestedFix: "Confirmar si son códigos y tratarla como categórica.",
      });
    }

    // Texto que parece numérico
    if (p.type !== "numerica" && p.type !== "fecha" && a.looseNumericShare >= 0.8) {
      push({
        id: `num-texto-${col}`,
        title: "Posible variable numérica como texto",
        detail: "Contiene números con símbolos (moneda, %, espacios).",
        severity: "media",
        column: col,
        affectedRows: count,
        suggestedFix: "Quitar símbolos y convertir a número.",
      });
    }

    // Errores de tipo
    if (p.type === "numerica" && a.numericShare < 1) {
      const bad = count - a.numbers.length;
      push({
        id: `tipo-${col}`,
        title: "Valores con tipo incorrecto",
        detail: `${bad} valor(es) no numéricos en una columna numérica.`,
        severity: bad / count >= 0.1 ? "alta" : "media",
        column: col,
        affectedRows: bad,
        suggestedFix: "Revisar los valores no numéricos y convertirlos o marcarlos como nulos.",
      });
    }

    // Inconsistencias en categorías
    if (p.type === "categorica" || p.type === "texto") {
      const groups = new Map<string, Set<string>>();
      let spaced = 0;
      for (const v of a.values) {
        if (isNullish(v)) continue;
        const s = String(v);
        if (s !== s.trim()) spaced++;
        const norm = s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!groups.has(norm)) groups.set(norm, new Set());
        groups.get(norm)!.add(s);
      }
      const variants = [...groups.values()].filter((g) => g.size > 1);
      if (variants.length || spaced) {
        const affected = a.values.filter((v) => {
          if (isNullish(v)) return false;
          const s = String(v);
          return s !== s.trim() || variants.some((g) => g.has(s));
        }).length;
        const ex = variants[0] ? [...variants[0]].slice(0, 3).map((x) => `"${x}"`).join(", ") : "espacios sobrantes";
        push({
          id: `inconsistente-${col}`,
          title: "Valores inconsistentes",
          detail: `Variantes de escritura del mismo valor (ej.: ${ex}).`,
          severity: "media",
          column: col,
          affectedRows: affected,
          suggestedFix: "Normalizar mayúsculas, acentos y espacios.",
        });
      }
    }

    // Outliers (IQR)
    if (p.type === "numerica" && a.numbers.length >= 10) {
      const sorted = [...a.numbers].sort((x, y) => x - y);
      const q1 = quantile(sorted, 0.25);
      const q3 = quantile(sorted, 0.75);
      const iqr = q3 - q1;
      if (iqr > 0) {
        const lo = q1 - 1.5 * iqr;
        const hi = q3 + 1.5 * iqr;
        const out = a.numbers.filter((x) => x < lo || x > hi).length;
        if (out > 0) {
          const pct = (out / a.numbers.length) * 100;
          push({
            id: `outliers-${col}`,
            title: "Posibles valores atípicos",
            detail: `${out} valor(es) fuera de [${round(lo, 2)}, ${round(hi, 2)}] (${pct.toFixed(1)}%).`,
            severity: pct >= 10 ? "alta" : pct >= 2 ? "media" : "baja",
            column: col,
            affectedRows: out,
            suggestedFix: "Verificar si son errores de captura; recortar (winsorizar) o transformar si procede.",
          });
        }
      }
    }
  }

  const totalCells = nRows * headers.length;
  const nullCells = analyses.reduce((s, a) => s + (a.profile.nullCount ?? 0), 0);
  const missingPct = totalCells ? round((nullCells / totalCells) * 100, 2) : 0;
  const order: Record<QualitySeverity, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
  issues.sort((x, y) => order[x.severity] - order[y.severity]);

  return {
    id: `ds-${Date.now()}`,
    name: meta.name,
    source: meta.source,
    sizeLabel: meta.sizeLabel,
    sheetName: meta.sheetName,
    rows: nRows,
    columns: headers.length,
    missingPct,
    duplicates,
    qualityScore: scoreFromIssues(issues, missingPct, nRows ? (duplicates / nRows) * 100 : 0),
    status: "diagnosticado",
    loadedAt: new Date().toISOString(),
    isDemo: meta.isDemo ?? false,
    columnProfiles: analyses.map((a) => a.profile),
    issues,
    preview: rows.slice(0, 10).map((r) => Object.fromEntries(headers.map((h) => [h, displayValue(r[h])]))),
  };
}
