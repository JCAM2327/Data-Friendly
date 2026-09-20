import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Database, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ModuleStub } from "@/components/common/ModuleStub";
import { useDataset } from "@/state/dataset-store";
import { modelingBlockers, recommendTechniques } from "@/services/ml-service";
import type { MlRecommendation } from "@/lib/types";

export const Route = createFileRoute("/ml")({
  head: () => ({
    meta: [
      { title: "Machine Learning · DataClean AI" },
      {
        name: "description",
        content: "Técnicas de Machine Learning recomendadas según el perfil del dataset.",
      },
      { property: "og:title", content: "Machine Learning · DataClean AI" },
      {
        property: "og:description",
        content: "Recomendaciones derivadas del perfilado, con requisitos previos al modelado.",
      },
    ],
  }),
  component: MlPage,
});

const familyLabels: Record<MlRecommendation["family"], string> = {
  supervisado: "Supervisado",
  no_supervisado: "No supervisado",
  series_temporales: "Series temporales",
  nlp: "NLP",
};

function MlPage() {
  const { dataset, loadDemoDataset } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader
          title="Machine Learning"
          description="Recomendaciones según el perfil de los datos."
        />
        <EmptyState
          icon={Database}
          title="Sin datos para recomendar técnicas"
          description="Las recomendaciones se derivan del perfilado real del dataset, nunca de supuestos."
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

  const recommendations = recommendTechniques(dataset);
  const blockers = modelingBlockers(dataset);

  return (
    <>
      <PageHeader
        title="Machine Learning"
        description="Técnicas aplicables según las variables detectadas."
        action={<StatusBadge tone="info">{recommendations.length} sugerencias</StatusBadge>}
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      {blockers.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-danger/10 p-3 ring-1 ring-danger/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Requisitos antes de modelar</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
              {blockers.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <GlassCard>
        <CardHeading
          title="Técnicas recomendadas"
          meta="Derivadas de los tipos de columna del dataset"
        />
        <ul className="mt-3 space-y-2">
          {recommendations.length === 0 ? (
            <li className="rounded-xl glass-inset p-4 text-center text-[12px] text-muted-foreground ring-1 ring-white/50">
              El perfilado actual no permite sugerir técnicas.
            </li>
          ) : (
            recommendations.map((r) => (
              <li key={r.id} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{r.technique}</p>
                    <p className="text-[11px] text-muted-foreground">{r.rationale}</p>
                  </div>
                  <StatusBadge tone="neutral">{familyLabels[r.family]}</StatusBadge>
                </div>
                <p className="mt-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-primary/12">
                  Requisito: {r.requirement}
                </p>
              </li>
            ))
          )}
        </ul>
      </GlassCard>

      <ModuleStub
        icon={Brain}
        title="Modelado previsto"
        items={[
          "Selección de variable objetivo y partición train/test",
          "Entrenamiento de modelos de referencia",
          "Métricas de evaluación comparables",
          "Explicabilidad de las predicciones",
        ]}
      />
    </>
  );
}
