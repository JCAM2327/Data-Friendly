import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ModuleStub } from "@/components/common/ModuleStub";
import { useDataset } from "@/state/dataset-store";
import { formatNumber, formatPct } from "@/lib/format";
import type { ColumnType } from "@/lib/types";

export const Route = createFileRoute("/eda")({
  head: () => ({
    meta: [
      { title: "EDA · DataClean AI" },
      {
        name: "description",
        content: "Exploración de variables: composición de tipos y cobertura por columna.",
      },
      { property: "og:title", content: "EDA · DataClean AI" },
      {
        property: "og:description",
        content: "Análisis exploratorio del dataset activo, columna por columna.",
      },
    ],
  }),
  component: EdaPage,
});

const typeLabels: Record<ColumnType, string> = {
  numerica: "Numéricas",
  categorica: "Categóricas",
  fecha: "Fechas",
  texto: "Texto",
  booleana: "Booleanas",
};

function EdaPage() {
  const { dataset, loadDemoDataset } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader title="EDA" description="Exploración de variables del dataset." />
        <EmptyState
          icon={Database}
          title="Sin variables que explorar"
          description="La exploración se construye sobre datos cargados. No se generan gráficos sin datos reales."
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

  const counts = dataset.columnProfiles.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});
  const total = dataset.columnProfiles.length || 1;

  return (
    <>
      <PageHeader
        title="EDA"
        description="Exploración de las variables perfiladas."
        action={<StatusBadge tone="info">{dataset.columnProfiles.length} variables</StatusBadge>}
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Filas" value={formatNumber(dataset.rows)} />
        <MetricCard label="Columnas" value={formatNumber(dataset.columns)} />
        <MetricCard label="Perfiladas" value={String(dataset.columnProfiles.length)} />
        <MetricCard label="Faltantes" value={formatPct(dataset.missingPct)} tone="warning" />
      </div>

      <GlassCard>
        <CardHeading title="Composición por tipo" meta="Sobre las columnas perfiladas" />
        <div className="mt-3 space-y-2">
          {(Object.keys(typeLabels) as ColumnType[])
            .filter((t) => counts[t])
            .map((t) => (
              <div key={t} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium">{typeLabels[t]}</p>
                  <span className="font-mono text-[12px] text-muted-foreground">{counts[t]}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-accent"
                    style={{ width: `${((counts[t] ?? 0) / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeading title="Cobertura por columna" meta="Porcentaje de valores presentes" />
        <div className="mt-3 space-y-2">
          {dataset.columnProfiles.map((c) => {
            const coverage = 100 - c.missingPct;
            return (
              <div key={c.name} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-mono text-[12px]">{c.name}</p>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {formatPct(coverage)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${coverage >= 95 ? "bg-success" : "bg-warning"}`}
                    style={{ width: `${coverage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <ModuleStub
        icon={BarChart3}
        title="Exploración avanzada prevista"
        items={[
          "Histogramas y distribuciones por variable",
          "Matriz de correlaciones",
          "Detección de atípicos con gráficos de caja",
          "Segmentación por variable categórica",
        ]}
      />
    </>
  );
}
