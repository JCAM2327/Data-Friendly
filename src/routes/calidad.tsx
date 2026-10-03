import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Database, Rows3, Columns3, CircleSlash, Copy, AlertTriangle, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/common/DataTable";
import { typeLabel } from "@/components/data/ColumnPreviewTable";
import { useDataset } from "@/state/dataset-store";
import { formatNumber, formatPct, scoreLabel } from "@/lib/format";
import { severityLabel, severityTone } from "@/lib/severity";
import { countBySeverity } from "@/services/dataset-service";
import type { ColumnProfile } from "@/lib/types";

export const Route = createFileRoute("/calidad")({
  head: () => ({
    meta: [
      { title: "Calidad · DataClean AI" },
      {
        name: "description",
        content: "Diagnóstico automático de calidad: problemas detectados y perfil por columna.",
      },
      { property: "og:title", content: "Calidad · DataClean AI" },
      {
        property: "og:description",
        content: "Problemas, severidad y perfilado estadístico columna a columna.",
      },
    ],
  }),
  component: CalidadPage,
});

type Row = ColumnProfile & Record<string, unknown>;
const num = (v?: number) => (v === undefined ? "—" : formatNumber(v));

const profileColumns: Column<Row>[] = [
  { key: "name", header: "Columna", render: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "type", header: "Tipo", render: (r) => typeLabel[r.type] },
  { key: "count", header: "Valores", align: "right", render: (r) => num(r.count) },
  { key: "uniqueCount", header: "Únicos", align: "right", render: (r) => formatNumber(r.uniqueCount) },
  { key: "nullCount", header: "Nulos", align: "right", render: (r) => num(r.nullCount) },
  { key: "missingPct", header: "% nulos", align: "right", render: (r) => formatPct(r.missingPct) },
  { key: "min", header: "Mín.", align: "right", render: (r) => r.min ?? "—" },
  { key: "max", header: "Máx.", align: "right", render: (r) => r.max ?? "—" },
  { key: "mean", header: "Media", align: "right", render: (r) => (r.type === "numerica" ? num(r.mean) : "—") },
  { key: "median", header: "Mediana", align: "right", render: (r) => num(r.median) },
  { key: "std", header: "Desv. est.", align: "right", render: (r) => num(r.std) },
  { key: "mode", header: "Moda", render: (r) => <span className="block max-w-[140px] truncate">{r.mode ?? "—"}</span> },
];

function CalidadPage() {
  const { dataset, loadDemoDataset, plannedIssueIds, togglePlanned } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader title="Calidad" description="Diagnóstico automático del dataset activo." />
        <EmptyState
          icon={Database}
          title="Sin datos que diagnosticar"
          description="El diagnóstico se genera a partir de un dataset cargado. No se muestran resultados sin datos reales."
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

  const sev = countBySeverity(dataset.issues);
  const categorical = dataset.columnProfiles.filter((c) => c.topCategories?.length);

  return (
    <>
      <PageHeader
        title="Calidad"
        description={`Diagnóstico de ${dataset.name}${dataset.sheetName ? ` · ${dataset.sheetName}` : ""}.`}
        action={
          <StatusBadge tone={dataset.qualityScore >= 70 ? "success" : dataset.qualityScore >= 50 ? "warning" : "danger"}>
            Score {dataset.qualityScore} · {scoreLabel(dataset.qualityScore)}
          </StatusBadge>
        }
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Rows3} label="Filas" value={formatNumber(dataset.rows)} />
        <MetricCard icon={Columns3} label="Columnas" value={formatNumber(dataset.columns)} />
        <MetricCard icon={CircleSlash} label="Nulos" value={formatPct(dataset.missingPct)} tone={dataset.missingPct >= 5 ? "warning" : "neutral"} />
        <MetricCard icon={Copy} label="Duplicados" value={formatNumber(dataset.duplicates)} tone={dataset.duplicates > 0 ? "warning" : "neutral"} />
        <MetricCard
          icon={AlertTriangle}
          label="Problemas"
          value={String(dataset.issues.length)}
          hint={`${sev.critica} crít. · ${sev.alta} altas · ${sev.media} medias · ${sev.baja} bajas`}
          tone={sev.critica + sev.alta > 0 ? "danger" : dataset.issues.length ? "warning" : "success"}
        />
        <MetricCard
          icon={Gauge}
          label="Data Quality Score"
          value={`${dataset.qualityScore}/100`}
          tone={dataset.qualityScore >= 70 ? "success" : dataset.qualityScore >= 50 ? "warning" : "danger"}
        />
      </div>

      <GlassCard>
        <CardHeading
          title="Problemas detectados"
          meta="Marca los que quieras corregir. Nada se modifica hasta que lo confirmes en Limpieza."
          action={<StatusBadge tone="info">{plannedIssueIds.length} seleccionado(s)</StatusBadge>}
        />
        {dataset.issues.length === 0 ? (
          <p className="mt-3 rounded-xl glass-inset p-4 text-center text-[12px] text-muted-foreground ring-1 ring-white/50">
            No se detectaron problemas de calidad.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dataset.issues.map((issue) => {
              const checked = plannedIssueIds.includes(issue.id);
              return (
                <li key={issue.id} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`plan-${issue.id}`}
                      checked={checked}
                      onCheckedChange={() => togglePlanned(issue.id)}
                      className="mt-0.5"
                      aria-label={`Incluir "${issue.title}" en el plan de limpieza`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`plan-${issue.id}`} className="text-[13px] font-medium">
                          {issue.title}
                        </label>
                        <StatusBadge tone={severityTone[issue.severity]}>{severityLabel[issue.severity]}</StatusBadge>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {issue.column ? `Columna: ${issue.column}` : "Todo el dataset"} ·{" "}
                        {formatNumber(issue.affectedRows)} registro(s) afectado(s)
                      </p>
                      <p className="mt-1 text-[12px]">{issue.detail}</p>
                      {issue.suggestedFix ? (
                        <p className="mt-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-primary/12">
                          Recomendación: {issue.suggestedFix}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Perfil por columna"
          meta={`${dataset.columnProfiles.length} de ${dataset.columns} columnas perfiladas`}
        />
        <div className="mt-3">
          <DataTable columns={profileColumns} rows={dataset.columnProfiles as Row[]} />
        </div>
      </GlassCard>

      {categorical.length ? (
        <GlassCard>
          <CardHeading title="Categorías más frecuentes" meta="Variables categóricas y booleanas" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {categorical.map((c) => {
              const total = c.count || 1;
              return (
                <div key={c.name} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                  <p className="text-[13px] font-medium">{c.name}</p>
                  <ul className="mt-2 space-y-1.5">
                    {c.topCategories!.map((t) => (
                      <li key={t.value}>
                        <div className="flex justify-between gap-2 font-mono text-[11px]">
                          <span className="truncate">{t.value}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(t.count)} · {formatPct((t.count / total) * 100)}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(t.count / total) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </GlassCard>
      ) : null}

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/limpieza">
            <ShieldCheck className="size-4" aria-hidden />
            Revisar plan de limpieza
          </Link>
        </Button>
      </div>
    </>
  );
}
