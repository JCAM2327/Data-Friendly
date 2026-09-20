import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/common/DataTable";
import { useDataset } from "@/state/dataset-store";
import { formatNumber, formatPct, scoreLabel } from "@/lib/format";
import { countBySeverity } from "@/services/dataset-service";
import type { ColumnProfile } from "@/lib/types";

export const Route = createFileRoute("/calidad")({
  head: () => ({
    meta: [
      { title: "Calidad · DataClean AI" },
      {
        name: "description",
        content: "Diagnóstico automático de calidad: incidencias detectadas y perfil por columna.",
      },
      { property: "og:title", content: "Calidad · DataClean AI" },
      {
        property: "og:description",
        content: "Incidencias, severidad y perfilado columna a columna del dataset activo.",
      },
    ],
  }),
  component: CalidadPage,
});

const profileColumns: Column<ColumnProfile & Record<string, unknown>>[] = [
  { key: "name", header: "Columna" },
  { key: "type", header: "Tipo" },
  {
    key: "missingPct",
    header: "Faltantes",
    align: "right",
    render: (r) => formatPct(r.missingPct),
  },
  {
    key: "uniqueCount",
    header: "Únicos",
    align: "right",
    render: (r) => formatNumber(r.uniqueCount),
  },
  { key: "sample", header: "Ejemplo" },
];

function CalidadPage() {
  const { dataset, loadDemoDataset } = useDataset();

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

  const severity = countBySeverity(dataset.issues);

  return (
    <>
      <PageHeader
        title="Calidad"
        description={`Diagnóstico de ${dataset.name}.`}
        action={
          <StatusBadge tone={dataset.qualityScore >= 70 ? "success" : "warning"}>
            Score {dataset.qualityScore} · {scoreLabel(dataset.qualityScore)}
          </StatusBadge>
        }
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Críticos" value={String(severity.critico)} tone="danger" />
        <MetricCard label="Avisos" value={String(severity.aviso)} tone="warning" />
        <MetricCard label="Correctos" value={String(severity.ok)} tone="success" />
        <MetricCard label="Faltantes" value={formatPct(dataset.missingPct)} />
      </div>

      <GlassCard>
        <CardHeading title="Incidencias detectadas" meta="Ordenadas por severidad" />
        <ul className="mt-3 space-y-2">
          {[...dataset.issues]
            .sort((a, b) => {
              const order = { critico: 0, aviso: 1, ok: 2 } as const;
              return order[a.severity] - order[b.severity];
            })
            .map((issue) => (
              <li key={issue.id} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{issue.title}</p>
                    <p className="text-[11px] text-muted-foreground">{issue.detail}</p>
                  </div>
                  <StatusBadge
                    tone={
                      issue.severity === "critico"
                        ? "danger"
                        : issue.severity === "aviso"
                          ? "warning"
                          : "success"
                    }
                  >
                    {issue.severity === "critico"
                      ? "Crítico"
                      : issue.severity === "aviso"
                        ? "Aviso"
                        : "OK"}
                  </StatusBadge>
                </div>
                {issue.suggestedFix ? (
                  <p className="mt-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-primary/12">
                    Corrección propuesta: {issue.suggestedFix}
                  </p>
                ) : null}
              </li>
            ))}
        </ul>
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Perfil por columna"
          meta={`${dataset.columnProfiles.length} de ${dataset.columns} columnas perfiladas`}
        />
        <div className="mt-3">
          <DataTable
            columns={profileColumns}
            rows={dataset.columnProfiles as (ColumnProfile & Record<string, unknown>)[]}
          />
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/limpieza">
            <ShieldCheck className="size-4" aria-hidden />
            Ir a limpieza
          </Link>
        </Button>
      </div>
    </>
  );
}
