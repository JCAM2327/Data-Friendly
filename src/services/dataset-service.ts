/**
 * Lógica de procesamiento de datos.
 * Aquí vivirá la ingesta y el perfilado real. De momento sólo expone
 * funciones puras y un dataset de DEMOSTRACIÓN explícitamente marcado.
 */
import type { DatasetSummary, QualityIssue } from "@/lib/types";

/** Puntuación de calidad a partir de métricas de perfilado. */
export function computeQualityScore(input: {
  missingPct: number;
  duplicates: number;
  rows: number;
  criticalIssues: number;
}): number {
  const duplicatePct = input.rows > 0 ? (input.duplicates / input.rows) * 100 : 0;
  const raw = 100 - input.missingPct * 2 - duplicatePct * 1.5 - input.criticalIssues * 4;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function countBySeverity(issues: QualityIssue[]) {
  return {
    ok: issues.filter((i) => i.severity === "ok").length,
    aviso: issues.filter((i) => i.severity === "aviso").length,
    critico: issues.filter((i) => i.severity === "critico").length,
  };
}

/** Dataset de demostración. Nunca debe presentarse como un análisis real. */
export function createDemoDataset(): DatasetSummary {
  const issues: QualityIssue[] = [
    {
      id: "nulls-fecha",
      title: "Valores nulos en fecha_compra",
      detail: "4.1% de registros afectados",
      severity: "aviso",
      column: "fecha_compra",
      affectedRows: 512,
      suggestedFix: "Imputar con la mediana temporal por cliente",
    },
    {
      id: "dup-transaccion",
      title: "213 filas duplicadas",
      detail: "Clave: id_transaccion",
      severity: "critico",
      column: "id_transaccion",
      affectedRows: 213,
      suggestedFix: "Eliminar duplicados conservando el registro más reciente",
    },
    {
      id: "tipos",
      title: "Tipos de dato consistentes",
      detail: "34/34 columnas válidas",
      severity: "ok",
      affectedRows: 0,
    },
  ];

  return {
    id: "demo-ventas-2024",
    name: "ventas_2024.csv",
    source: "Archivo local (demo)",
    sizeLabel: "3.2 MB",
    rows: 12480,
    columns: 34,
    missingPct: 6.2,
    duplicates: 213,
    qualityScore: computeQualityScore({
      missingPct: 6.2,
      duplicates: 213,
      rows: 12480,
      criticalIssues: 1,
    }),
    status: "diagnosticado",
    loadedAt: new Date().toISOString(),
    isDemo: true,
    issues,
    columnProfiles: [
      { name: "id_transaccion", type: "texto", missingPct: 0, uniqueCount: 12267, sample: "TRX-1042" },
      { name: "cliente", type: "categorica", missingPct: 0.4, uniqueCount: 3108, sample: "a.rivera" },
      { name: "fecha_compra", type: "fecha", missingPct: 4.1, uniqueCount: 274, sample: "2024-03-11" },
      { name: "importe", type: "numerica", missingPct: 1.2, uniqueCount: 8921, sample: "48.20" },
      { name: "canal", type: "categorica", missingPct: 0, uniqueCount: 4, sample: "web" },
      { name: "devuelto", type: "booleana", missingPct: 0, uniqueCount: 2, sample: "false" },
    ],
    preview: [
      { id_transaccion: "TRX-1042", cliente: "a.rivera", fecha_compra: "2024-03-11", importe: "48.20", estado: "ok" },
      { id_transaccion: "TRX-1043", cliente: "m.torres", fecha_compra: "—", importe: "112.00", estado: "nulo" },
      { id_transaccion: "TRX-1044", cliente: "a.rivera", fecha_compra: "2024-03-11", importe: "48.20", estado: "dup" },
      { id_transaccion: "TRX-1045", cliente: "j.pena", fecha_compra: "2024-03-12", importe: "9.90", estado: "ok" },
      { id_transaccion: "TRX-1046", cliente: "l.ortega", fecha_compra: "2024-03-12", importe: "230.45", estado: "ok" },
    ],
  };
}
