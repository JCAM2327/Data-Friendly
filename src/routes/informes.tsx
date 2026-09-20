import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Database, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ModuleStub } from "@/components/common/ModuleStub";
import { useDataset } from "@/state/dataset-store";
import { formatDateTime, formatNumber, formatPct, scoreLabel } from "@/lib/format";
import { countBySeverity } from "@/services/dataset-service";

export const Route = createFileRoute("/informes")({
  head: () => ({
    meta: [
      { title: "Informes · DataClean AI" },
      {
        name: "description",
        content: "Resumen ejecutable del estado de calidad del dataset listo para compartir.",
      },
      { property: "og:title", content: "Informes · DataClean AI" },
      {
        property: "og:description",
        content: "Reporte de calidad con métricas, incidencias y trazabilidad.",
      },
    ],
  }),
  component: InformesPage,
});

function InformesPage() {
  const { dataset, history, loadDemoDataset } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader title="Informes" description="Reporte de calidad del dataset." />
        <EmptyState
          icon={Database}
          title="Sin informe disponible"
          description="El informe se genera a partir de un diagnóstico real. No se publican cifras estimadas."
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
        title="Informes"
        description="Resumen del estado de calidad del dataset activo."
        action={
          <Button size="sm" variant="outline" disabled>
            <Download className="size-4" aria-hidden />
            Exportar (próximamente)
          </Button>
        }
      />

      {dataset.isDemo ? <DemoNotice text="Este informe corresponde a un conjunto de demostración y no debe compartirse como resultado real." /> : null}

      <GlassCard>
        <CardHeading
          title={dataset.name}
          meta={`${dataset.source} · ${formatDateTime(dataset.loadedAt)}`}
          action={
            <StatusBadge tone={dataset.qualityScore >= 70 ? "success" : "warning"}>
              {scoreLabel(dataset.qualityScore)}
            </StatusBadge>
          }
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Score" value={String(dataset.qualityScore)} />
          <MetricCard label="Filas" value={formatNumber(dataset.rows)} />
          <MetricCard label="Faltantes" value={formatPct(dataset.missingPct)} tone="warning" />
          <MetricCard
            label="Duplicados"
            value={formatNumber(dataset.duplicates)}
            tone={dataset.duplicates > 0 ? "danger" : "success"}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeading title="Resumen de incidencias" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricCard label="Críticas" value={String(severity.critico)} tone="danger" />
          <MetricCard label="Avisos" value={String(severity.aviso)} tone="warning" />
          <MetricCard label="Correctas" value={String(severity.ok)} tone="success" />
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeading title="Trazabilidad" meta={`${history.length} operación(es) registradas`} />
        <ul className="mt-3 space-y-2">
          {history.length === 0 ? (
            <li className="rounded-xl glass-inset p-4 text-center text-[12px] text-muted-foreground ring-1 ring-white/50">
              Sin operaciones registradas.
            </li>
          ) : (
            history.slice(0, 5).map((op) => (
              <li
                key={op.id}
                className="flex items-center justify-between gap-3 rounded-xl glass-inset p-3 ring-1 ring-white/50"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{op.label}</p>
                  <p className="text-[11px] text-muted-foreground">{op.detail}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDateTime(op.at)}
                </span>
              </li>
            ))
          )}
        </ul>
      </GlassCard>

      <ModuleStub
        icon={FileText}
        title="Informes previstos"
        items={[
          "Exportación a PDF y HTML",
          "Informe comparativo antes/después de la limpieza",
          "Resumen narrativo generado con IA",
          "Programación de envíos periódicos",
        ]}
      />
    </>
  );
}
