import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ModuleStub } from "@/components/common/ModuleStub";
import { severityLabel, severityTone } from "@/lib/severity";
import { useDataset } from "@/state/dataset-store";
import { formatNumber, formatPct } from "@/lib/format";

export const Route = createFileRoute("/limpieza")({
  head: () => ({
    meta: [
      { title: "Limpieza · DataClean AI" },
      {
        name: "description",
        content: "Correcciones propuestas y limpieza controlada con confirmación previa.",
      },
      { property: "og:title", content: "Limpieza · DataClean AI" },
      {
        property: "og:description",
        content: "Revisa cada corrección antes de aplicarla sobre el dataset activo.",
      },
    ],
  }),
  component: LimpiezaPage,
});

function LimpiezaPage() {
  const { dataset, loadDemoDataset, plannedIssueIds } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader title="Limpieza" description="Correcciones controladas sobre el dataset." />
        <EmptyState
          icon={Database}
          title="Nada que limpiar todavía"
          description="Las correcciones se derivan del diagnóstico. Carga un dataset para verlas."
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

  const pending = plannedIssueIds.length
    ? dataset.issues.filter((i) => plannedIssueIds.includes(i.id))
    : dataset.issues;

  return (
    <>
      <PageHeader
        title="Limpieza"
        description="Revisa cada corrección antes de aplicarla."
        action={
          <StatusBadge tone="info" dot>
            {pending.length} corrección(es) pendiente(s)
          </StatusBadge>
        }
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <GlassCard>
        <CardHeading
          title="Estado actual"
          meta={`${formatNumber(dataset.rows)} filas · ${formatPct(dataset.missingPct)} faltantes · ${formatNumber(dataset.duplicates)} duplicados`}
          action={<StatusBadge tone="info">Score {dataset.qualityScore}</StatusBadge>}
        />
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Correcciones propuestas"
          meta={plannedIssueIds.length ? `${pending.length} seleccionada(s) en Calidad` : `${pending.length} pendiente(s) · selecciona en Calidad cuáles aplicar`}
        />
        <ul className="mt-3 space-y-2">
          {pending.length === 0 ? (
            <li className="rounded-xl glass-inset p-4 text-center text-[12px] text-muted-foreground ring-1 ring-white/50">
              Todas las incidencias detectadas están resueltas.
            </li>
          ) : (
            pending.map((issue) => (
              <li key={issue.id} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{issue.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {issue.column ? `${issue.column} · ` : ""}
                      {formatNumber(issue.affectedRows)} fila(s) afectada(s)
                    </p>
                  </div>
                  <StatusBadge tone={severityTone[issue.severity]}>
                    {severityLabel[issue.severity]}
                  </StatusBadge>
                </div>
                <p className="mt-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-primary/12">
                  {issue.suggestedFix ?? "Sin corrección automática disponible."}
                </p>
              </li>
            ))
          )}
        </ul>
      </GlassCard>

      <ModuleStub
        icon={Sparkles}
        title="Limpieza avanzada prevista"
        items={[
          "Selección de estrategia de imputación por columna",
          "Normalización de texto y categorías",
          "Detección y tratamiento de valores atípicos",
          "Vista previa del cambio antes de confirmar",
        ]}
      />
    </>
  );
}
