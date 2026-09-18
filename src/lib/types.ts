/** Dominio de la aplicación. Compartido por UI, lógica y servicios de IA/ML. */

export type QualitySeverity = "ok" | "aviso" | "critico";

export type DatasetStatus =
  | "sin_cargar"
  | "cargado"
  | "diagnosticado"
  | "limpiado"
  | "validado";

export type ColumnType = "numerica" | "categorica" | "fecha" | "texto" | "booleana";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  missingPct: number;
  uniqueCount: number;
  sample: string;
}

export interface QualityIssue {
  id: string;
  title: string;
  detail: string;
  severity: QualitySeverity;
  column?: string;
  affectedRows: number;
  /** Corrección propuesta por el motor de limpieza. */
  suggestedFix?: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  source: string;
  sizeLabel: string;
  rows: number;
  columns: number;
  missingPct: number;
  duplicates: number;
  qualityScore: number;
  status: DatasetStatus;
  loadedAt: string;
  /** true cuando los datos provienen del set de demostración. */
  isDemo: boolean;
  columnProfiles: ColumnProfile[];
  issues: QualityIssue[];
  preview: Record<string, string>[];
}

export interface OperationRecord {
  id: string;
  label: string;
  detail: string;
  at: string;
  kind: "carga" | "diagnostico" | "limpieza" | "validacion" | "informe" | "ml";
}

export interface MlRecommendation {
  id: string;
  technique: string;
  family: "supervisado" | "no_supervisado" | "series_temporales" | "nlp";
  rationale: string;
  requirement: string;
}
