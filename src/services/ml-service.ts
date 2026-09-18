/**
 * Servicios de IA/ML. Aislado del frontend: aquí se conectarán los
 * modelos y el motor de recomendación. Hoy sólo deriva sugerencias
 * a partir del perfilado del dataset (sin resultados inventados).
 */
import type { DatasetSummary, MlRecommendation } from "@/lib/types";

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
