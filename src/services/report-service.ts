import type { DatasetSummary, OperationRecord, QualityIssue } from "@/lib/types";
import type { RawTable } from "./file-parser";
import { assessQuality, type ValidationRule } from "./validation-service";
import { runEda } from "./eda-service";

export interface ReportStep {
  id: string;
  at: string;
  operation: string;
  column: string;
  method: string;
  affected: number;
  result: string;
}

const issueKey = (issue: QualityIssue) => `${issue.id}|${issue.column ?? ""}`;

/** Counts resolved issue types, not transformed cells or partially reduced issues. */
export function compareIssues(original: QualityIssue[], current: QualityIssue[]) {
  const originalKeys = new Set(original.map(issueKey));
  const currentKeys = new Set(current.map(issueKey));
  return {
    found: original.length,
    corrected: original.filter((issue) => !currentKeys.has(issueKey(issue))).length,
    pending: current.length,
    newIssues: current.filter((issue) => !originalKeys.has(issueKey(issue))).length,
  };
}

export function buildReport(input: {
  original: DatasetSummary;
  current: DatasetSummary;
  originalTable: RawTable;
  currentTable: RawTable;
  rules: ValidationRule[];
  steps: ReportStep[];
  history: OperationRecord[];
  generatedAt: string;
}) {
  return {
    original: input.original,
    current: input.current,
    generatedAt: input.generatedAt,
    counts: compareIssues(input.original.issues, input.current.issues),
    before: assessQuality(input.originalTable, input.original, input.rules),
    after: assessQuality(input.currentTable, input.current, input.rules),
    eda: runEda(input.currentTable, input.current),
    steps: input.steps.map(({ id, at, operation, column, method, affected, result }) => ({ id, at, operation, column, method, affected, result })),
    history: input.history,
  };
}

export type DatasetReport = ReturnType<typeof buildReport>;

/** Spreadsheet-safe CSV, including untrusted file names and operation details. */
export function historyCsv(history: OperationRecord[]): string {
  const cell = (value: string) => {
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [
    ["Fecha UTC", "Tipo", "Operación", "Detalle"],
    ...history.map((op) => [op.at, op.kind, op.label, op.detail]),
  ].map((row) => row.map(cell).join(",")).join("\r\n");
}