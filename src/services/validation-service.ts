/**
 * Motor de Data Quality y validación. Funciones puras: todo se calcula
 * a partir de la tabla real; nada es ficticio.
 */
import type { DatasetSummary } from "@/lib/types";
import type { RawTable } from "./file-parser";
import { isNullish, toDate, toNumber, toLooseNumber } from "./profiling-service";

export type RuleKind = "min" | "max" | "range" | "not_null" | "unique" | "date_order";

export interface ValidationRule {
  id: string;
  kind: RuleKind;
  column: string;
  column2?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  critical: boolean;
}

export interface RuleResult {
  rule: ValidationRule;
  label: string;
  evaluated: number;
  failed: number;
  compliance: number;
  passed: boolean;
  sampleRows: number[];
}

export const ruleKindLabels: Record<RuleKind, string> = {
  min: "Valor mínimo (≥)",
  max: "Valor máximo (≤)",
  range: "Dentro de un rango",
  not_null: "Campo obligatorio (no nulo)",
  unique: "Identificador único",
  date_order: "Fecha inicio ≤ fecha final",
};

export function describeRule(r: ValidationRule): string {
  switch (r.kind) {
    case "min": return `${r.column} >= ${r.min ?? 0}`;
    case "max": return `${r.column} <= ${r.max ?? 0}`;
    case "range": return `${r.column} entre ${r.min ?? 0} y ${r.max ?? 0}`;
    case "not_null": return `${r.column} no nulo`;
    case "unique": return `${r.column} único`;
    case "date_order": return `${r.column} <= ${r.column2 ?? "?"}`;
  }
}

export function evaluateRule(t: RawTable, rule: ValidationRule): RuleResult {
  const failedRows: number[] = [];
  let evaluated = 0;
  const col = rule.column;
  if (rule.kind === "unique") {
    const seen = new Map<string, number>();
    t.rows.forEach((r) => {
      const v = r[col];
      if (isNullish(v)) return;
      const k = String(v).trim();
      seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    t.rows.forEach((r, i) => {
      const v = r[col];
      if (isNullish(v)) return;
      evaluated++;
      if ((seen.get(String(v).trim()) ?? 0) > 1) failedRows.push(i);
    });
  } else if (rule.kind === "not_null") {
    t.rows.forEach((r, i) => {
      evaluated++;
      if (isNullish(r[col])) failedRows.push(i);
    });
  } else if (rule.kind === "date_order") {
    t.rows.forEach((r, i) => {
      const a = toDate(r[col]);
      const b = rule.column2 ? toDate(r[rule.column2]) : null;
      if (!a || !b) return;
      evaluated++;
      if (a.getTime() > b.getTime()) failedRows.push(i);
    });
  } else {
    t.rows.forEach((r, i) => {
      const v = r[col];
      if (isNullish(v)) return;
      evaluated++;
      const n = toNumber(v) ?? toLooseNumber(v);
      if (n === null) return void failedRows.push(i);
      const lo = rule.kind === "max" ? -Infinity : (rule.min ?? 0);
      const hi = rule.kind === "min" ? Infinity : (rule.max ?? 0);
      if (n < lo || n > hi) failedRows.push(i);
    });
  }
  const failed = failedRows.length;
  const compliance = evaluated ? ((evaluated - failed) / evaluated) * 100 : 100;
  return {
    rule,
    label: describeRule(rule),
    evaluated,
    failed,
    compliance: Math.round(compliance * 10) / 10,
    passed: failed === 0,
    sampleRows: failedRows.slice(0, 5),
  };
}

/** Propone reglas iniciales por nombre de columna y tipo detectado. */
export function suggestRules(ds: DatasetSummary): ValidationRule[] {
  const out: ValidationRule[] = [];
  let n = 0;
  const id = () => `auto-${n++}`;
  const dates: string[] = [];
  for (const c of ds.columnProfiles) {
    const name = c.name.toLowerCase();
    if (c.type === "fecha") dates.push(c.name);
    if (/(precio|price|importe|venta|sales|monto|amount|cantidad|unidades|qty|quantity|descuento|total)/.test(name)) {
      out.push({ id: id(), kind: "min", column: c.name, min: 0, critical: true });
    }
    if (/(^edad$|^age$|edad_|_edad)/.test(name)) {
      out.push({ id: id(), kind: "range", column: c.name, min: 0, max: 120, critical: true });
    }
    if (/(^id|_id$|^id_|codigo|code)/.test(name)) {
      out.push({ id: id(), kind: "unique", column: c.name, critical: true });
      out.push({ id: id(), kind: "not_null", column: c.name, critical: true });
    }
  }
  const start = dates.find((d) => /(inicio|start|desde|alta)/i.test(d));
  const end = dates.find((d) => /(fin|end|hasta|baja)/i.test(d));
  if (start && end) out.push({ id: id(), kind: "date_order", column: start, column2: end, critical: true });
  return out;
}

export interface Dimension {
  key: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export type Readiness = "listo" | "revision" | "no_recomendado";

export const readinessLabel: Record<Readiness, string> = {
  listo: "Listo para análisis",
  revision: "Requiere revisión",
  no_recomendado: "No recomendado para análisis todavía",
};

export interface QualityAssessment {
  dimensions: Dimension[];
  score: number;
  readiness: Readiness;
  blockers: string[];
  warnings: string[];
  results: RuleResult[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

export function assessQuality(t: RawTable, ds: DatasetSummary, rules: ValidationRule[]): QualityAssessment {
  const rows = t.rows.length;
  const cols = t.headers.length;
  const cells = rows * cols || 1;
  const results = rules.filter((r) => t.headers.includes(r.column)).map((r) => evaluateRule(t, r));

  // 1. Completitud: % de celdas no nulas
  let nulls = 0;
  for (const r of t.rows) for (const h of t.headers) if (isNullish(r[h])) nulls++;
  const completeness = clamp(100 - (nulls / cells) * 100);

  // 2. Unicidad: filas no duplicadas
  const uniqueness = rows ? clamp(100 - (ds.duplicates / rows) * 100) : 100;

  // 3. Consistencia: columnas sin problemas de formato/categorías inconsistentes
  const consistencyIssues = ds.issues.filter((i) => /inconsist|formato|espacio|categor/i.test(`${i.id} ${i.title}`));
  const affectedC = consistencyIssues.reduce((s, i) => s + i.affectedRows, 0);
  const consistency = clamp(100 - (affectedC / cells) * 100 * Math.max(1, cols / 2));

  // 4. Validez: valores que encajan con el tipo detectado + reglas de rango
  let typeBad = 0, typeEval = 0;
  for (const c of ds.columnProfiles) {
    if (c.type !== "numerica" && c.type !== "fecha") continue;
    for (const r of t.rows) {
      const v = r[c.name];
      if (isNullish(v)) continue;
      typeEval++;
      const ok = c.type === "numerica" ? toNumber(v) !== null : toDate(v) !== null;
      if (!ok) typeBad++;
    }
  }
  const rangeRes = results.filter((r) => ["min", "max", "range"].includes(r.rule.kind));
  const rangeEval = rangeRes.reduce((s, r) => s + r.evaluated, 0);
  const rangeBad = rangeRes.reduce((s, r) => s + r.failed, 0);
  const validity = typeEval + rangeEval ? clamp(100 - ((typeBad + rangeBad) / (typeEval + rangeEval)) * 100) : 100;

  // 5. Integridad: obligatorios y claves únicas
  const intRes = results.filter((r) => r.rule.kind === "not_null" || r.rule.kind === "unique");
  const intEval = intRes.reduce((s, r) => s + r.evaluated, 0);
  const integrity = intEval ? clamp(100 - (intRes.reduce((s, r) => s + r.failed, 0) / intEval) * 100) : 100;

  // 6. Coherencia entre variables: reglas cruzadas (fechas)
  const cohRes = results.filter((r) => r.rule.kind === "date_order");
  const cohEval = cohRes.reduce((s, r) => s + r.evaluated, 0);
  const coherence = cohEval ? clamp(100 - (cohRes.reduce((s, r) => s + r.failed, 0) / cohEval) * 100) : 100;

  const dimensions: Dimension[] = [
    { key: "completitud", label: "Completitud", score: r1(completeness), weight: 0.25, detail: `${nulls} celda(s) nulas de ${rows * cols}` },
    { key: "unicidad", label: "Unicidad", score: r1(uniqueness), weight: 0.15, detail: `${ds.duplicates} fila(s) duplicadas` },
    { key: "consistencia", label: "Consistencia", score: r1(consistency), weight: 0.15, detail: `${consistencyIssues.length} problema(s) de formato o categorías` },
    { key: "validez", label: "Validez", score: r1(validity), weight: 0.2, detail: `${typeBad} valor(es) con tipo incorrecto · ${rangeBad} fuera de rango` },
    { key: "integridad", label: "Integridad", score: r1(integrity), weight: 0.15, detail: intEval ? `${intRes.reduce((s, r) => s + r.failed, 0)} incumplimiento(s) en obligatorios/únicos` : "Sin reglas de integridad definidas" },
    { key: "coherencia", label: "Coherencia entre variables", score: r1(coherence), weight: 0.1, detail: cohEval ? `${cohRes.reduce((s, r) => s + r.failed, 0)} registro(s) con fechas invertidas` : "Sin reglas cruzadas definidas" },
  ];
  const score = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0));

  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const d of dimensions) {
    if (d.score < 80) blockers.push(`${d.label} en ${d.score}% (mínimo 80%): ${d.detail}.`);
    else if (d.score < 95) warnings.push(`${d.label} en ${d.score}%: ${d.detail}.`);
  }
  for (const r of results.filter((x) => !x.passed)) {
    const msg = `Regla "${r.label}" incumplida en ${r.failed} registro(s) (${r.compliance}% de cumplimiento).`;
    (r.rule.critical ? blockers : warnings).push(msg);
  }
  for (const i of ds.issues.filter((x) => x.severity === "critica")) blockers.push(`Problema crítico: ${i.title}${i.column ? ` (${i.column})` : ""}.`);
  if (rows < 30) warnings.push(`Solo ${rows} filas: muestra pequeña para análisis fiables.`);

  const readiness: Readiness =
    blockers.length === 0 && score >= 85 ? "listo"
    : score < 60 || blockers.length > 2 ? "no_recomendado" : "revision";
  return { dimensions, score, readiness, blockers, warnings, results };
}
