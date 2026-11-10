import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DatasetSummary, OperationRecord } from "@/lib/types";
import type { RawTable } from "@/services/file-parser";
import { createDemoTable } from "@/services/dataset-service";
import { profileTable } from "@/services/profiling-service";
import { suggestRules, type ValidationRule } from "@/services/validation-service";

export interface TableMeta {
  name: string;
  source: string;
  sizeLabel: string;
  sheetName?: string | undefined;
  isDemo?: boolean | undefined;
}

/** Transformación confirmada. Guarda la tabla resultante para poder deshacer. */
export interface CleaningStep {
  id: string;
  at: string;
  operation: string;
  column: string;
  method: string;
  affected: number;
  result: string;
  table: RawTable;
}

export type NewStep = Omit<CleaningStep, "id" | "at">;

interface DatasetContextValue {
  /** Perfil del dataset de trabajo (limpio si hay transformaciones). */
  dataset: DatasetSummary | null;
  /** Perfil del dataset original, que nunca se modifica. */
  originalDataset: DatasetSummary | null;
  /** Tabla original, nunca modificada. */
  originalTable: RawTable | null;
  /** Tabla de trabajo actual. */
  currentTable: RawTable | null;
  steps: CleaningStep[];
  history: OperationRecord[];
  lastOperation: OperationRecord | null;
  loadDemoDataset: () => void;
  loadDataset: (table: RawTable, meta: TableMeta) => void;
  clearDataset: () => void;
  registerOperation: (op: Omit<OperationRecord, "id" | "at">) => void;
  applyStep: (step: NewStep) => void;
  undoLastStep: () => void;
  profile: (table: RawTable) => DatasetSummary | null;
  /** Problemas que el usuario eligió corregir. */
  plannedIssueIds: string[];
  togglePlanned: (id: string) => void;
  validationRules: ValidationRule[];
  addValidationRule: (rule: ValidationRule) => void;
  removeValidationRule: (id: string) => void;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [original, setOriginal] = useState<{ table: RawTable; meta: TableMeta } | null>(null);
  const [steps, setSteps] = useState<CleaningStep[]>([]);
  const [history, setHistory] = useState<OperationRecord[]>([]);
  const [plannedIssueIds, setPlanned] = useState<string[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);

  const togglePlanned = useCallback(
    (id: string) => setPlanned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [],
  );

  const registerOperation = useCallback((op: Omit<OperationRecord, "id" | "at">) => {
    setHistory((prev) => [
      { ...op, id: `${Date.now()}-${prev.length}`, at: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const meta = original?.meta;
  const profile = useCallback(
    (table: RawTable) => (meta ? profileTable(table, meta) : null),
    [meta],
  );

  const originalDataset = useMemo(
    () => (original ? profileTable(original.table, original.meta) : null),
    [original],
  );
  const currentTable = steps.at(-1)?.table ?? original?.table ?? null;
  const dataset = useMemo(() => {
    if (!original || !currentTable) return null;
    if (!steps.length) return originalDataset;
    return { ...profileTable(currentTable, original.meta), status: "limpiado" as const };
  }, [original, currentTable, steps.length, originalDataset]);

  const loadDataset = useCallback(
    (table: RawTable, m: TableMeta) => {
      setOriginal({ table, meta: m });
      setSteps([]);
      setPlanned([]);
      const s = profileTable(table, m);
      setValidationRules(suggestRules(s));
      registerOperation({
        kind: "carga",
        label: m.isDemo ? "Dataset de demostración cargado" : "Dataset cargado",
        detail: `${m.name}${m.sheetName ? ` (${m.sheetName})` : ""} · ${s.rows} filas`,
      });
      registerOperation({
        kind: "diagnostico",
        label: "Diagnóstico automático",
        detail: `${s.issues.length} problema(s) · score ${s.qualityScore}`,
      });
    },
    [registerOperation],
  );

  const loadDemoDataset = useCallback(() => {
    loadDataset(createDemoTable(), {
      name: "ventas_demo.csv",
      source: "Demostración",
      sizeLabel: "generado",
      isDemo: true,
    });
  }, [loadDataset]);

  const clearDataset = useCallback(() => {
    setOriginal(null);
    setSteps([]);
    setPlanned([]);
    setValidationRules([]);
    registerOperation({ kind: "carga", label: "Dataset descartado", detail: "Se limpió la sesión de trabajo" });
  }, [registerOperation]);

  const applyStep = useCallback(
    (step: NewStep) => {
      setSteps((prev) => [...prev, { ...step, id: `${Date.now()}`, at: new Date().toISOString() }]);
      registerOperation({
        kind: "limpieza",
        label: `${step.operation}${step.column ? ` · ${step.column}` : ""}`,
        detail: `${step.method} · ${step.affected} registro(s) · ${step.result}`,
      });
    },
    [registerOperation],
  );

  const undoLastStep = useCallback(() => {
    const last = steps[steps.length - 1];
    if (!last) return;
    setSteps(steps.slice(0, -1));
    registerOperation({
      kind: "limpieza",
      label: "Transformación deshecha",
      detail: `${last.operation}${last.column ? ` · ${last.column}` : ""}`,
    });
  }, [steps, registerOperation]);

  const addValidationRule = useCallback((rule: ValidationRule) => {
    setValidationRules((prev) => [...prev, rule]);
    registerOperation({ kind: "validacion", label: "Regla añadida", detail: `${rule.column} · ${rule.kind}${rule.critical ? " · crítica" : ""}` });
  }, [registerOperation]);

  const removeValidationRule = useCallback((id: string) => {
    const rule = validationRules.find((r) => r.id === id);
    if (!rule) return;
    setValidationRules((prev) => prev.filter((r) => r.id !== id));
    registerOperation({ kind: "validacion", label: "Regla eliminada", detail: `${rule.column} · ${rule.kind}` });
  }, [validationRules, registerOperation]);

  const value = useMemo(
    () => ({
      dataset,
      originalDataset,
      originalTable: original?.table ?? null,
      currentTable,
      steps,
      history,
      lastOperation: history[0] ?? null,
      loadDemoDataset,
      loadDataset,
      clearDataset,
      registerOperation,
      applyStep,
      undoLastStep,
      profile,
      plannedIssueIds,
      togglePlanned,
      validationRules,
      addValidationRule,
      removeValidationRule,
    }),
    [dataset, originalDataset, original, currentTable, steps, history, loadDemoDataset, loadDataset, clearDataset, registerOperation, applyStep, undoLastStep, profile, plannedIssueIds, togglePlanned, validationRules, addValidationRule, removeValidationRule],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset debe usarse dentro de DatasetProvider");
  return ctx;
}
