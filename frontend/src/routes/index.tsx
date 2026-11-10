import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { PageHeader } from "@/components/common/PageHeader";
import { useDataset } from "@/state/dataset-store";
import { formatDateTime, formatNumber, formatPct, scoreLabel } from "@/lib/format";
import { countBySeverity } from "@/services/dataset-service";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · DataClean AI" },
      {
        name: "description",
        content:
          "Resumen de calidad del dataset activo: filas, columnas, faltantes, duplicados y Data Quality Score.",
      },
      { property: "og:title", content: "Dashboard · DataClean AI" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Estado general y métricas de calidad del dataset activo.",
      },
    ],
  }),
  component: DashboardPage,
});

const statusLabels: Record<string, string> = {
  sin_cargar: "Sin cargar",
  cargado: "Cargado",
  diagnosticado: "Diagnosticado",
  limpiado: "Limpiado",
  validado: "Validado",
};

function DashboardPage() {
  const { dataset, lastOperation, loadDemoDataset } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Aún no hay un dataset en la sesión de trabajo."
        />
        <EmptyState
          icon={Database}
          title="Sin dataset cargado"
          description="Conecta una fuente o sube un archivo para iniciar el diagnóstico automático de calidad."
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
      <PageHeader title="Dashboard" description="Estado general del dataset activo." />

      {dataset.isDemo ? <DemoNotice /> : null}

      <GlassCard>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Dataset actual
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight">{dataset.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {dataset.source} · {dataset.sizeLabel}
            </p>
          </div>
          <StatusBadge tone="success" dot>
            {statusLabels[dataset.status]}
          </StatusBadge>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan-accent font-mono text-lg font-semibold text-primary-foreground shadow-md shadow-primary/30">
            {dataset.qualityScore}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight">Data Quality Score</p>
            <p className="text-[12px] text-muted-foreground">
              {scoreLabel(dataset.qualityScore)} · {severity.critico} crítico(s), {severity.aviso}{" "}
              aviso(s)
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-accent"
                style={{ width: `${dataset.qualityScore}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Filas" value={formatNumber(dataset.rows)} />
          <MetricCard label="Columnas" value={formatNumber(dataset.columns)} />
          <MetricCard
            label="Faltantes"
            value={formatPct(dataset.missingPct)}
            tone={dataset.missingPct > 0 ? "warning" : "success"}
          />
          <MetricCard
            label="Duplicados"
            value={formatNumber(dataset.duplicates)}
            tone={dataset.duplicates > 0 ? "danger" : "success"}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Diagnóstico de calidad"
          action={
            <StatusBadge tone={severity.critico > 0 ? "danger" : "warning"}>
              {severity.critico + severity.aviso} avisos
            </StatusBadge>
          }
        />
        <ul className="mt-3 space-y-2">
          {dataset.issues.map((issue) => (
            <li
              key={issue.id}
              className="flex items-center gap-3 rounded-xl glass-inset p-3 ring-1 ring-white/50"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${
                  issue.severity === "critica"
                    ? "bg-danger"
                    : issue.severity !== "baja"
                      ? "bg-warning"
                      : "bg-success"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{issue.title}</p>
                <p className="text-[11px] text-muted-foreground">{issue.detail}</p>
              </div>
              <StatusBadge
                tone={
                  issue.severity === "critica"
                    ? "danger"
                    : issue.severity !== "baja"
                      ? "warning"
                      : "success"
                }
              >
                {issue.severity === "critica" ? "Revisar" : issue.severity !== "baja" ? "Corregible" : "OK"}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Última operación"
          action={
            <span className="text-[11px] text-muted-foreground">
              {lastOperation ? formatDateTime(lastOperation.at) : "—"}
            </span>
          }
        />
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary/10 to-cyan-accent/10 p-3 ring-1 ring-primary/15">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <RotateCcw className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">
              {lastOperation ? lastOperation.label : "Sin operaciones registradas"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {lastOperation ? lastOperation.detail : "Las acciones aparecerán aquí"}
            </p>
          </div>
        </div>
      </GlassCard>
    </>
  );
}
