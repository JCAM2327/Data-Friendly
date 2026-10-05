import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, Undo2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/common/DataTable";
import { useDataset } from "@/state/dataset-store";
import { formatNumber, formatPct, formatDateTime } from "@/lib/format";
import { DuplicatesPanel } from "@/components/cleaning/DuplicatesPanel";
import { MissingPanel } from "@/components/cleaning/MissingPanel";
import { TextPanel, DatesPanel } from "@/components/cleaning/TextDatesPanels";
import { CategoriesPanel, TypesPanel, OutliersPanel } from "@/components/cleaning/CategoryTypesOutliers";
import { Comparison } from "@/components/cleaning/Comparison";
import { Note, type PendingOp } from "@/components/cleaning/shared";
import type { RawTable } from "@/services/file-parser";

export const Route = createFileRoute("/limpieza")({
  head: () => ({
    meta: [
      { title: "Limpieza · DataClean AI" },
      { name: "description", content: "Limpieza controlada: vista previa de cada cambio antes de confirmarlo." },
      { property: "og:title", content: "Limpieza · DataClean AI" },
      { property: "og:description", content: "Revisa cada corrección antes de aplicarla sobre el dataset activo." },
    ],
  }),
  component: LimpiezaPage,
});

const SECTIONS = [
  { id: "duplicados", label: "Duplicados" },
  { id: "faltantes", label: "Valores faltantes" },
  { id: "texto", label: "Texto" },
  { id: "fechas", label: "Fechas" },
  { id: "categorias", label: "Categorías" },
  { id: "tipos", label: "Tipos de dato" },
  { id: "outliers", label: "Outliers" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function previewRows(t: RawTable): Record<string, unknown>[] {
  return t.rows.slice(0, 5).map((r) =>
    Object.fromEntries(t.headers.map((h) => [h, typeof r[h] === "object" && r[h] !== null ? JSON.stringify(r[h]) : r[h]])),
  );
}

function LimpiezaPage() {
  const { dataset, originalDataset, currentTable, steps, loadDemoDataset, applyStep, undoLastStep, profile } = useDataset();
  const [section, setSection] = useState<SectionId>("duplicados");
  const [pending, setPending] = useState<PendingOp | null>(null);

  const afterSummary = useMemo(
    () => (pending ? profile(pending.result.table) : null),
    [pending, profile],
  );

  if (!dataset || !currentTable || !originalDataset) {
    return (
      <>
        <PageHeader title="Limpieza" description="Correcciones controladas sobre el dataset." />
        <EmptyState
          icon={Database}
          title="Nada que limpiar todavía"
          description="La limpieza se aplica sobre el dataset activo. Carga uno para empezar."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="lg">
                <Link to="/datos">Analizar un dataset</Link>
              </Button>
              <Button variant="outline" size="lg" onClick={loadDemoDataset}>
                Ver ejemplo de demostración
              </Button>
            </div>
          }
        />
      </>
    );
  }

  const profiles = dataset.columnProfiles;
  const panelProps = { table: currentTable, profiles, onPreview: setPending };

  const confirm = () => {
    if (!pending) return;
    applyStep({
      operation: pending.operation,
      column: pending.column,
      method: pending.method,
      affected: pending.result.affected,
      result: pending.result.result,
      table: pending.result.table,
    });
    setPending(null);
  };

  const previewCols: Column<Record<string, unknown>>[] = pending
    ? pending.result.table.headers.slice(0, 6).map((h) => ({ key: h, header: h }))
    : [];

  type StepRow = (typeof steps)[number] & Record<string, unknown>;
  const stepCols: Column<StepRow>[] = [
    { key: "operation", header: "Operación", render: (s) => <span className="font-medium">{s.operation}</span> },
    { key: "column", header: "Columna", render: (s) => s.column || "—" },
    { key: "method", header: "Método", render: (s) => <span className="text-muted-foreground">{s.method}</span> },
    { key: "affected", header: "Registros", align: "right", render: (s) => formatNumber(s.affected) },
    { key: "at", header: "Hora", align: "right", render: (s) => <span className="text-muted-foreground">{formatDateTime(s.at)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Limpieza"
        description="Cada cambio se previsualiza antes de confirmarse. El dataset original nunca se modifica."
        action={
          steps.length ? (
            <StatusBadge tone="info" dot>
              {steps.length} transformación(es) aplicada(s)
            </StatusBadge>
          ) : undefined
        }
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <GlassCard>
        <CardHeading
          title="Estado actual"
          meta={`${formatNumber(dataset.rows)} filas · ${formatPct(dataset.missingPct)} faltantes · ${formatNumber(dataset.duplicates)} duplicados`}
          action={<StatusBadge tone="info">Score {dataset.qualityScore}</StatusBadge>}
        />
        {steps.length ? (
          <div className="mt-3">
            <Comparison before={originalDataset} after={dataset} beforeLabel="Original" afterLabel="Actual" />
          </div>
        ) : null}
      </GlassCard>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={section === s.id ? "default" : "outline"}
            onClick={() => {
              setSection(s.id);
              setPending(null);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <GlassCard>
        <CardHeading title={SECTIONS.find((s) => s.id === section)!.label} meta="Configura y pulsa una acción para ver la vista previa" />
        <div className="mt-3">
          {section === "duplicados" ? <DuplicatesPanel {...panelProps} /> : null}
          {section === "faltantes" ? <MissingPanel {...panelProps} /> : null}
          {section === "texto" ? <TextPanel {...panelProps} /> : null}
          {section === "fechas" ? <DatesPanel {...panelProps} /> : null}
          {section === "categorias" ? <CategoriesPanel {...panelProps} /> : null}
          {section === "tipos" ? <TypesPanel {...panelProps} /> : null}
          {section === "outliers" ? <OutliersPanel {...panelProps} /> : null}
        </div>
      </GlassCard>

      {pending ? (
        <GlassCard>
          <CardHeading
            title="Vista previa del cambio"
            meta={`${pending.operation}${pending.column ? ` · ${pending.column}` : ""}`}
            action={<StatusBadge tone="warning">Sin confirmar</StatusBadge>}
          />
          <div className="mt-3 space-y-3">
            <Note>{pending.result.result}</Note>
            {pending.result.warnings.map((w) => (
              <Note key={w} tone="warning">
                {w}
              </Note>
            ))}
            {pending.result.samples.length ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Ejemplos del cambio</p>
                {pending.result.samples.map((s, i) => (
                  <p key={i} className="font-mono text-[12px]">
                    <span className="text-danger line-through">{s.before}</span>
                    {" → "}
                    <span className="text-success">{s.after}</span>
                  </p>
                ))}
              </div>
            ) : null}
            <DataTable columns={previewCols} rows={previewRows(pending.result.table)} />
            {afterSummary ? <Comparison before={dataset} after={afterSummary} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={confirm}>
                <Check className="size-4" aria-hidden /> Confirmar cambio
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPending(null)}>
                <X className="size-4" aria-hidden /> Descartar
              </Button>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard>
        <CardHeading
          title="Transformaciones aplicadas"
          meta={steps.length ? "Se aplican en orden; puedes deshacer la última" : "Aún no hay cambios confirmados"}
          action={
            steps.length ? (
              <Button size="sm" variant="outline" onClick={undoLastStep}>
                <Undo2 className="size-4" aria-hidden /> Deshacer última
              </Button>
            ) : undefined
          }
        />
        {steps.length ? (
          <div className="mt-3">
            <DataTable columns={stepCols} rows={[...steps].reverse() as StepRow[]} />
          </div>
        ) : (
          <p className="mt-3 rounded-xl glass-inset p-4 text-center text-[12px] text-muted-foreground ring-1 ring-white/50">
            Confirma una vista previa para registrar la primera transformación.
          </p>
        )}
      </GlassCard>
    </>
  );
}
