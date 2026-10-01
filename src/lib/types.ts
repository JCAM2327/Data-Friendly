/** Dominio de la aplicación. Compartido por UI, lógica y servicios de IA/ML. */

export type QualitySeverity = "critica" | "alta" | "media" | "baja";

export type DatasetStatus =
  | "sin_cargar"
  | "cargado"
  | "diagnosticado"
  | "limpiado"
  | "validado";

export type ColumnType = "numerica" | "categorica" | "fecha" | "texto" | "booleana";

export interface CategoryCount {
  value: string;
  count: number;
}

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  missingPct: number;
  uniqueCount: number;
  sample: string;
  /** Valores no nulos. */
  count?: number;
  nullCount?: number;
  firstValues?: string[];
  min?: string;
  max?: string;
  mean?: number;
  median?: number;
  std?: number;
  mode?: string;
  topCategories?: CategoryCount[];
}

export interface QualityIssue {
  id: string;
  title: string;
  detail: string;
  severity: QualitySeverity;
  column?: string;
  affectedRows: number;
  /** Corrección propuesta. Nunca se aplica automáticamente. */
  suggestedFix?: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  source: string;
  sizeLabel: string;
  sheetName?: string;
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
