/**
 * Servicios de IA/ML. Aislado del frontend: aquí se conectarán los
 * modelos y el motor de recomendación. Las sugerencias se derivan del
 * perfilado, del EDA y de la validación del dataset real (sin resultados
 * inventados).
 */
import type { DatasetSummary, MlRecommendation } from "@/lib/types";
import type { RawTable } from "./file-parser";
import type { EdaResult } from "./eda-service";
import { assessQuality, suggestRules, type QualityAssessment, type Readiness } from "./validation-service";

export interface MlPlan {
  recommendations: MlRecommendation[];
  assessment: QualityAssessment;
  readiness: Readiness;
  targetCandidates: { column: string; kind: "clasificacion" | "regresion"; reason: string }[];
  blockers: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Candidatas a variable objetivo: categóricas de baja cardinalidad y métricas numéricas. */
export function targetCandidates(ds: DatasetSummary): MlPlan["targetCandidates"] {
  const out: MlPlan["targetCandidates"] = [];
  for (const c of ds.columnProfiles) {
    const name = c.name.toLowerCase();
    if (/(^id|_id$|^id_|codigo|code)/.test(name)) continue;
    if ((c.type === "categorica" || c.type === "booleana") && c.uniqueCount >= 2 && c.uniqueCount <= 20) {
      out.push({
        column: c.name,
        kind: "clasificacion",
        reason: `${c.uniqueCount} clases distintas: apta como objetivo de clasificación.`,
      });
    }
    if (c.type === "numerica" && c.uniqueCount > 20) {
      out.push({
        column: c.name,
        kind: "regresion",
        reason: "Variable numérica continua: apta como objetivo de regresión.",
      });
    }
  }
  return out.slice(0, 8);
}

export function buildMlPlan(ds: DatasetSummary, t: RawTable, eda: EdaResult): MlPlan {
  const assessment = assessQuality(t, ds, suggestRules(ds));
  const recs: MlRecommendation[] = [];
  const targets = targetCandidates(ds);
  const clsTargets = targets.filter((x) => x.kind === "clasificacion");
  const regTargets = targets.filter((x) => x.kind === "regresion");
  const numCount = eda.numeric.length;
  const hasSkew = eda.numeric.some((n) => Math.abs(n.skew) >= 1);
  const hasOutliers = eda.numeric.some((n) => n.outliers > 0);
  const prep: string[] = [];
  if (hasSkew) prep.push("Aplicar transformaciones (logarítmica o de rangos) a las variables muy asimétricas.");
  if (hasOutliers) prep.push("Revisar los valores atípicos detectados en el EDA antes de entrenar.");
  if (eda.strongPairs.length) prep.push("Resolver la multicolinealidad (selección de variables o PCA).");
  if (ds.missingPct > 0) prep.push("Imputar o eliminar los valores faltantes restantes.");

  if (clsTargets.length) {
    const target = clsTargets[0]!;
    recs.push({
      id: "clasificacion",
      technique: "Clasificación supervisada (árboles, regresión logística, gradient boosting)",
      family: "supervisado",
      suggestedTarget: target.column,
      rationale: `${target.column} tiene ${ds.columnProfiles.find((c) => c.name === target.column)?.uniqueCount ?? "?"} clases y puede actuar como variable objetivo.`,
      requirement: "Definir la columna objetivo, balancear clases y hacer partición train/test.",
      fitScore: clamp(60 + clsTargets.length * 8 + (assessment.readiness === "listo" ? 20 : 0)),
      preparation: prep,
    });
  }
  if (regTargets.length) {
    const target = regTargets[0]!;
    recs.push({
      id: "regresion",
      technique: "Regresión (lineal, ridge/lasso, gradient boosting)",
      family: "supervisado",
      suggestedTarget: target.column,
      rationale: `${target.column} es una métrica continua con ${numCount - 1 >= 0 ? Math.max(0, numCount - 1) : 0} variable(s) numérica(s) más que podrían explicarla.`,
      requirement: "Tratar valores faltantes y revisar la multicolinealidad antes del entrenamiento.",
      fitScore: clamp(55 + numCount * 8 + (eda.strongPairs.length ? -10 : 0)),
      preparation: prep,
    });
  }
  if (numCount >= 2) {
    recs.push({
      id: "clustering",
      technique: "Clustering (K-Means, DBSCAN)",
      family: "no_supervisado",
      rationale: `Hay ${numCount} variables numéricas que permiten segmentar registros sin etiquetas.`,
      requirement: "Escalar las variables y decidir el número de grupos (método del codo / silueta).",
      fitScore: clamp(40 + numCount * 10),
      preparation: prep,
    });
  }
  if (eda.series.length) {
    const s = eda.series[0]!;
    recs.push({
      id: "series",
      technique: "Pronóstico de series temporales (medias móviles, ARIMA, Prophet)",
      family: "series_temporales",
      suggestedTarget: s.valueColumn ?? undefined,
      rationale: `${s.dateColumn} aporta ${s.points.length} periodos mensuales${s.trendPct !== null ? ` con tendencia ${s.trendPct > 0 ? "creciente" : "decreciente"} (${s.trendPct}%)` : ""}.`,
      requirement: "Fijar la frecuencia temporal, completar huecos y separar validación temporal.",
      fitScore: clamp(35 + Math.min(40, s.points.length * 3)),
    });
  }
  const textCols = ds.columnProfiles.filter((c) => c.type === "texto" && c.uniqueCount > ds.rows * 0.5);
  if (textCols.length) {
    recs.push({
      id: "nlp",
      technique: "Procesamiento de texto (NLP): embeddings, sentimiento, temas",
      family: "nlp",
      suggestedTarget: textCols[0]!.name,
      rationale: `${textCols[0]!.name} contiene texto libre con alta variedad de valores.`,
      requirement: "Limpiar el texto (normalización, stopwords) y elegir idioma del modelo.",
      fitScore: 45,
    });
  }
  recs.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));

  const blockers: string[] = [];
  if (ds.duplicates > 0) blockers.push(`${ds.duplicates} duplicados sin resolver.`);
  if (ds.missingPct > 5) blockers.push(`${ds.missingPct}% de valores faltantes.`);
  if (assessment.readiness !== "listo") {
    blockers.push(`La validación marca "${assessment.readiness === "revision" ? "Requiere revisión" : "No recomendado para análisis todavía"}" (score ${assessment.score}/100).`);
  }
  for (const b of assessment.blockers.slice(0, 4)) blockers.push(b);

  return { recommendations: recs, assessment, readiness: assessment.readiness, targetCandidates: targets, blockers };
}

/** Compatibilidad con usos anteriores. */
export function recommendTechniques(dataset: DatasetSummary | null): MlRecommendation[] {
  if (!dataset) return [];
  const recs: MlRecommendation[] = [];
  const types = dataset.columnProfiles.map((c) => c.type);
  if (types.includes("booleana") || types.includes("categorica")) {
    recs.push({
      id: "clasificacion",
      technique: "Clasificación supervisada",
      family: "supervisado",
      rationale: "Existen columnas categóricas o booleanas que pueden actuar como variable objetivo.",
      requirement: "Definir la columna objetivo y balancear clases.",
    });
  }
  if (types.filter((t) => t === "numerica").length >= 1) {
    recs.push({
      id: "regresion",
      technique: "Regresión",
      family: "supervisado",
      rationale: "Hay variables numéricas continuas aptas como objetivo.",
      requirement: "Tratar valores faltantes antes del entrenamiento.",
    });
    recs.push({
      id: "clustering",
      technique: "Clustering (K-Means)",
      family: "no_supervisado",
      rationale: "El conjunto numérico permite segmentar registros sin etiquetas.",
      requirement: "Escalar variables y decidir número de grupos.",
    });
  }
  if (types.includes("fecha")) {
    recs.push({
      id: "series",
      technique: "Series temporales",
      family: "series_temporales",
      rationale: "Se detecta al menos una columna de fecha con granularidad diaria.",
      requirement: "Completar huecos temporales y fijar frecuencia.",
    });
  }
  return recs;
}

/** Bloqueos que impiden pasar a la fase de modelado. */
export function modelingBlockers(dataset: DatasetSummary | null): string[] {
  if (!dataset) return ["No hay dataset cargado."];
  const blockers: string[] = [];
  if (dataset.duplicates > 0) blockers.push(`${dataset.duplicates} duplicados sin resolver.`);
  if (dataset.missingPct > 5) blockers.push(`${dataset.missingPct}% de valores faltantes.`);
  if (dataset.status !== "validado") blockers.push("El dataset aún no ha superado la validación.");
  return blockers;
}
