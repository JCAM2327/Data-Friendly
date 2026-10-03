import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DatasetSummary, OperationRecord } from "@/lib/types";
import { createDemoDataset } from "@/services/dataset-service";

interface DatasetContextValue {
  dataset: DatasetSummary | null;
  history: OperationRecord[];
  lastOperation: OperationRecord | null;
  loadDemoDataset: () => void;
  loadDataset: (summary: DatasetSummary) => void;
  /** Problemas que el usuario eligió corregir. No se aplica nada automáticamente. */
  plannedIssueIds: string[];
  togglePlanned: (id: string) => void;
  clearDataset: () => void;
  registerOperation: (op: Omit<OperationRecord, "id" | "at">) => void;
  applyCleaning: () => void;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [plannedIssueIds, setPlanned] = useState<string[]>([]);
  const togglePlanned = useCallback(
    (id: string) => setPlanned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [],
  );
  const [history, setHistory] = useState<OperationRecord[]>([]);

  const registerOperation = useCallback((op: Omit<OperationRecord, "id" | "at">) => {
    setHistory((prev) => [
      { ...op, id: `${Date.now()}-${prev.length}`, at: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const loadDemoDataset = useCallback(() => {
    const demo = createDemoDataset();
    setDataset(demo);
    registerOperation({
      kind: "carga",
      label: "Dataset de demostración cargado",
      detail: `${demo.name} · ${demo.rows} filas`,
    });
  }, [registerOperation]);

  const loadDataset = useCallback(
    (summary: DatasetSummary) => {
      setDataset(summary);
      setPlanned([]);
      registerOperation({
        kind: "carga",
        label: "Dataset cargado",
        detail: `${summary.name}${summary.sheetName ? ` (${summary.sheetName})` : ""} · ${summary.rows} filas`,
      });
      registerOperation({
        kind: "diagnostico",
        label: "Diagnóstico automático",
        detail: `${summary.issues.length} problema(s) · score ${summary.qualityScore}`,
      });
    },
    [registerOperation],
  );

  const clearDataset = useCallback(() => {
    setDataset(null);
    registerOperation({
      kind: "carga",
      label: "Dataset descartado",
      detail: "Se limpió la sesión de trabajo",
    });
  }, [registerOperation]);

  const applyCleaning = useCallback(() => {
    setDataset((prev) =>
      prev
        ? {
            ...prev,
            duplicates: 0,
            missingPct: 0,
            rows: prev.rows - prev.duplicates,
            qualityScore: 94,
            status: "limpiado",
            issues: [],
          }
        : prev,
    );
    registerOperation({
      kind: "limpieza",
      label: "Limpieza controlada ejecutada",
      detail: "Imputación + deduplicación aplicada",
    });
  }, [registerOperation]);

  const value = useMemo(
    () => ({
      dataset,
      history,
      lastOperation: history[0] ?? null,
      loadDemoDataset,
      loadDataset,
      plannedIssueIds,
      togglePlanned,
      clearDataset,
      registerOperation,
      applyCleaning,
    }),
    [dataset, history, loadDemoDataset, loadDataset, plannedIssueIds, togglePlanned, clearDataset, registerOperation, applyCleaning],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset debe usarse dentro de DatasetProvider");
  return ctx;
}
