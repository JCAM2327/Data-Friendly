/**
 * Análisis exploratorio (EDA). Funciones puras sobre la tabla de trabajo.
 * Todo se deriva de los datos reales: sin resultados inventados.
 */
import type { DatasetSummary } from "@/lib/types";
import type { RawTable } from "./file-parser";
import { isNullish, toDate, toLooseNumber } from "./profiling-service";

const r = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function q(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export interface NumericStats {
  column: string;
  n: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  iqr: number;
  skew: number;
  outliers: number;
  histogram: { bin: string; count: number }[];
}

export interface CategoricalStats {
  column: string;
  n: number;
  cardinality: number;
  top: { value: string; count: number; pct: number }[];
  dominantPct: number;
}

export interface Correlation {
  a: string;
  b: string;
  r: number;
}

export interface TimeSeries {
  dateColumn: string;
  valueColumn: string | null;
  points: { period: string; value: number }[];
  trendPct: number | null;
}

export interface EdaResult {
  numeric: NumericStats[];
  categorical: CategoricalStats[];
  correlations: Correlation[];
  matrixColumns: string[];
  matrix: number[][];
  strongPairs: Correlation[];
  scatter: { a: string; b: string; points: { x: number; y: number }[] }[];
  series: TimeSeries[];
  insights: string[];
  questions: string[];
  recommendations: { title: string; reason: string }[];
}

const numValues = (t: RawTable, c: string) => {
  const out: (number | null)[] = [];
  for (const row of t.rows) out.push(isNullish(row[c]) ? null : toLooseNumber(row[c]));
  return out;
};

function numericStats(column: string, raw: (number | null)[]): NumericStats | null {
  const v = raw.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length < 2) return null;
  const n = v.length;
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  const p25 = q(v, 0.25), p75 = q(v, 0.75), iqr = p75 - p25;
  const lo = p25 - 1.5 * iqr, hi = p75 + 1.5 * iqr;
  const skew = std ? v.reduce((s, x) => s + ((x - mean) / std) ** 3, 0) / n : 0;
  const bins = Math.min(20, Math.max(5, Math.ceil(Math.log2(n) + 1)));
  const min = v[0]!, max = v[n - 1]!;
  const w = (max - min) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  for (const x of v) counts[Math.min(bins - 1, Math.floor((x - min) / w))]!++;
  return {
    column, n, mean: r(mean), median: r(q(v, 0.5)), min: r(min), max: r(max), std: r(std),
    p5: r(q(v, 0.05)), p25: r(p25), p75: r(p75), p95: r(q(v, 0.95)), iqr: r(iqr), skew: r(skew),
    outliers: v.filter((x) => x < lo || x > hi).length,
    histogram: counts.map((count, i) => ({ bin: `${r(min + i * w, 1)}`, count })),
  };
}

function categoricalStats(t: RawTable, column: string): CategoricalStats | null {
  const m = new Map<string, number>();
  let n = 0;
  for (const row of t.rows) {
    const v = row[column];
    if (isNullish(v)) continue;
    n++;
    const k = String(v).trim();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  if (!n) return null;
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([value, count]) => ({ value, count, pct: r((count / n) * 100, 1) }));
  return { column, n, cardinality: m.size, top, dominantPct: top[0]?.pct ?? 0 };
}

function pearson(a: (number | null)[], b: (number | null)[]): number | null {
  const xs: number[] = [], ys: number[] = [];
  a.forEach((x, i) => { const y = b[i]; if (x !== null && y !== null && y !== undefined) { xs.push(x); ys.push(y); } });
  if (xs.length < 5) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  xs.forEach((x, i) => { const ex = x - mx, ey = ys[i]! - my; num += ex * ey; dx += ex * ex; dy += ey * ey; });
  return dx && dy ? r(num / Math.sqrt(dx * dy)) : null;
}

const METRIC_RE = /(venta|sales|importe|precio|price|monto|amount|total|ingreso|revenue|cantidad|unidades|qty)/i;
const ENTITY_RE = /(producto|product|categor|cliente|customer|pais|country|region|canal|channel|tienda|store|marca|brand|segment)/i;

export function runEda(t: RawTable, ds: DatasetSummary): EdaResult {
  const profiles = ds.columnProfiles;
  const idLike = new Set(profiles.filter((p) =>
    /(^id($|_)|_id$|codigo|code)/i.test(p.name) ||
    (p.type !== 'numerica' && p.type !== 'fecha' && p.uniqueCount >= ds.rows * 0.95 && ds.rows > 20)
  ).map((p) => p.name));
  const numCols = profiles.filter((p) => p.type === "numerica" && !idLike.has(p.name)).map((p) => p.name);
  const catCols = profiles.filter((p) => (p.type === "categorica" || p.type === "booleana") && !idLike.has(p.name)).map((p) => p.name);
  const dateCols = profiles.filter((p) => p.type === "fecha").map((p) => p.name);

  const numData = new Map(numCols.map((c) => [c, numValues(t, c)]));
  const numeric = numCols.map((c) => numericStats(c, numData.get(c)!)).filter((x): x is NumericStats => !!x);
  const categorical = catCols.map((c) => categoricalStats(t, c)).filter((x): x is CategoricalStats => !!x);

  // Correlaciones
  const matrixColumns = numeric.map((n) => n.column).slice(0, 12);
  const correlations: Correlation[] = [];
  const matrix = matrixColumns.map((a, i) => matrixColumns.map((b, j) => {
    if (i === j) return 1;
    const v = pearson(numData.get(a)!, numData.get(b)!) ?? 0;
    if (j > i) correlations.push({ a, b, r: v });
    return v;
  }));
  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  const strongPairs = correlations.filter((c) => Math.abs(c.r) >= 0.7);
  const scatter = correlations.slice(0, 3).filter((c) => Math.abs(c.r) >= 0.3).map((c) => {
    const A = numData.get(c.a)!, B = numData.get(c.b)!;
    const points: { x: number; y: number }[] = [];
    A.forEach((x, i) => { const y = B[i]; if (x !== null && y != null) points.push({ x, y }); });
    return { a: c.a, b: c.b, points: points.slice(0, 1000) };
  });

  // Series temporales (agregado mensual)
  const metric = numCols.find((c) => METRIC_RE.test(c)) ?? numCols[0] ?? null;
  const series: TimeSeries[] = dateCols.slice(0, 2).map((dc) => {
    const agg = new Map<string, number>();
    t.rows.forEach((row, i) => {
      const d = toDate(row[dc]);
      if (!d) return;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const val = metric ? (numData.get(metric)![i] ?? 0) : 1;
      agg.set(k, (agg.get(k) ?? 0) + val);
    });
    const points = [...agg.entries()].sort().map(([period, value]) => ({ period, value: r(value) }));
    let trendPct: number | null = null;
    if (points.length >= 4) {
      const h = Math.floor(points.length / 2);
      const a = points.slice(0, h).reduce((s, p) => s + p.value, 0) / h;
      const b = points.slice(-h).reduce((s, p) => s + p.value, 0) / h;
      trendPct = a ? r(((b - a) / Math.abs(a)) * 100, 1) : null;
    }
    return { dateColumn: dc, valueColumn: metric, points, trendPct };
  }).filter((s) => s.points.length >= 2);

  // Hallazgos
  const insights: string[] = [];
  for (const s of strongPairs.slice(0, 5)) insights.push(`${s.a} y ${s.b} están altamente relacionadas (r = ${s.r}).`);
  for (const n of numeric) {
    if (Math.abs(n.skew) >= 1) insights.push(`${n.column} tiene una distribución ${n.skew > 0 ? "sesgada a la derecha" : "sesgada a la izquierda"} (asimetría ${n.skew}).`);
    if (n.outliers / n.n > 0.05) insights.push(`${n.column} presenta ${n.outliers} valores atípicos según IQR (${r((n.outliers / n.n) * 100, 1)}%).`);
  }
  for (const c of categorical) if (c.dominantPct >= 50 && c.cardinality > 1) insights.push(`En ${c.column} domina "${c.top[0]!.value}" con el ${c.dominantPct}% de los registros.`);
  for (const s of series) if (s.trendPct !== null && Math.abs(s.trendPct) >= 10)
    insights.push(`${s.valueColumn ? `${s.valueColumn} agregado` : "El número de registros"} por ${s.dateColumn} muestra una tendencia ${s.trendPct > 0 ? "creciente" : "decreciente"} (${s.trendPct > 0 ? "+" : ""}${s.trendPct}% entre la primera y la segunda mitad).`);

  // Preguntas dinámicas
  const questions: string[] = [];
  const entities = catCols.filter((c) => ENTITY_RE.test(c));
  const metrics = numCols.filter((c) => METRIC_RE.test(c));
  for (const e of (entities.length ? entities : catCols).slice(0, 3)) {
    if (metrics[0]) questions.push(`¿Qué ${e} genera más ${metrics[0]}?`);
    questions.push(`¿Cuál es el valor más frecuente de ${e} y cuánto pesa sobre el total?`);
  }
  if (series[0]) questions.push(`¿Cómo evolucionó ${series[0].valueColumn ?? "el volumen de registros"} a lo largo de ${series[0].dateColumn}?`);
  if (matrixColumns.length >= 2) questions.push(`¿Qué variables presentan mayor correlación?${correlations[0] ? ` (destaca ${correlations[0].a} ~ ${correlations[0].b})` : ""}`);
  if (metrics[0] && catCols[0] && series[0]) questions.push(`¿La evolución de ${metrics[0]} es igual en todos los valores de ${catCols[0]}?`);
  for (const n of numeric.filter((x) => x.outliers > 0).slice(0, 2)) questions.push(`¿Qué explica los ${n.outliers} valores atípicos de ${n.column}?`);

  // Recomendaciones
  const recommendations: { title: string; reason: string }[] = [];
  if (series.length) recommendations.push({ title: "Análisis de series temporales", reason: `Hay ${series[0]!.points.length} periodos mensuales en ${series[0]!.dateColumn}; permite estudiar estacionalidad y pronóstico.` });
  if (metrics[0] && numCols.length >= 2) recommendations.push({ title: "Regresión", reason: `${metrics[0]} es una métrica continua y hay ${numCols.length - 1} variable(s) numérica(s) más que podrían explicarla.` });
  if (catCols.length && metrics[0]) recommendations.push({ title: "Comparación entre grupos (ANOVA / Kruskal-Wallis)", reason: `Comparar ${metrics[0]} entre las categorías de ${catCols[0]} (${categorical[0]?.cardinality ?? "?"} grupos).` });
  if (strongPairs.length) recommendations.push({ title: "Reducción de dimensionalidad o selección de variables", reason: `${strongPairs.length} par(es) con |r| ≥ 0,7 indican redundancia (multicolinealidad).` });
  if (numCols.length >= 3) recommendations.push({ title: "Clustering / segmentación", reason: `${numCols.length} variables numéricas permiten agrupar registros con perfiles similares.` });
  if (catCols.length >= 2) recommendations.push({ title: "Tablas de contingencia y Chi-cuadrado", reason: `Estudiar la asociación entre ${catCols[0]} y ${catCols[1]}.` });
  if (numeric.some((n) => Math.abs(n.skew) >= 1)) recommendations.push({ title: "Transformación de variables", reason: "Algunas distribuciones son muy asimétricas; una transformación logarítmica o de rangos mejoraría modelos lineales." });
  if (!recommendations.length) recommendations.push({ title: "Ampliar el dataset", reason: "Hay pocas variables numéricas o categóricas útiles para análisis más profundos." });

  return { numeric, categorical, correlations, matrixColumns, matrix, strongPairs, scatter, series, insights, questions, recommendations };
}
