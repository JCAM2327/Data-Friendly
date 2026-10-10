import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Database, AlertTriangle, Target, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { MetricCard } from "@/components/common/MetricCard";
import { ModuleStub } from "@/components/common/ModuleStub";
import { useDataset } from "@/state/dataset-store";
import { buildMlPlan } from "@/services/ml-service";
import { runEda } from "@/services/eda-service";
import { readinessLabel, type Readiness } from "@/services/validation-service";
import type { MlRecommendation } from "@/lib/types";

export const Route = createFileRoute("/ml")({
  head: () => ({
    meta: [
      { title: "Machine Learning · DataClean AI" },
      {
        name: "description",
        content: "Técnicas de Machine Learning recomendadas según el perfil, el EDA y la validación del dataset.",
      },
      { property: "og:title", content: "Machine Learning · DataClean AI" },
      {
        property: "og:description",
        content: "Recomendaciones derivadas del perfilado real, con requisitos previos al modelado.",
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

const readinessTone: Record<Readiness, BadgeTone> = {
  listo: "success",
  revision: "warning",
  no_recomendado: "danger",
};

function fitTone(score: number): BadgeTone {
  return score >= 70 ? "success" : score >= 45 ? "warning" : "neutral";
}

function MlPage() {
  const { dataset, currentTable, loadDemoDataset } = useDataset();

  if (!dataset || !currentTable) {
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

  const eda = runEda(currentTable, dataset);
  const plan = buildMlPlan(dataset, currentTable, eda);

  return (
    <>
      <PageHeader
        title="Machine Learning"
        description="Técnicas aplicables según las variables detectadas, el EDA y la validación."
        action={
          <StatusBadge tone={readinessTone[plan.readiness]} dot>
            {readinessLabel[plan.readiness]}
          </StatusBadge>
        }
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          label="Data Quality Score"
          value={`${plan.assessment.score}/100`}
          tone={plan.assessment.score >= 85 ? "success" : plan.assessment.score >= 60 ? "warning" : "danger"}
        />
        <MetricCard label="Técnicas sugeridas" value={String(plan.recommendations.length)} />
        <MetricCard label="Objetivos candidatos" value={String(plan.targetCandidates.length)} />
        <MetricCard
          label="Bloqueos"
          value={String(plan.blockers.length)}
          tone={plan.blockers.length ? "danger" : "success"}
        />
      </div>

      {plan.blockers.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-danger/10 p-3 ring-1 ring-danger/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Requisitos antes de modelar</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
              {plan.blockers.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/validacion">Ir a Validación</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-success/10 p-3 ring-1 ring-success/20">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <p className="text-[13px]">
            El dataset supera la validación: no hay bloqueos para empezar a modelar.
          </p>
        </div>
      )}

      <GlassCard>
        <CardHeading
          title="Técnicas recomendadas"
          meta="Ordenadas por adecuación al dataset actual"
        />
        <ul className="mt-3 space-y-2">
          {plan.recommendations.length === 0 ? (
            <li className="rounded-xl glass-inset p-4 text-center text-[12px] text-muted-foreground ring-1 ring-white/50">
              El perfilado actual no permite sugerir técnicas.
            </li>
          ) : (
            plan.recommendations.map((r) => (
              <li key={r.id} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{r.technique}</p>
                    <p className="text-[11px] text-muted-foreground">{r.rationale}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge tone="neutral">{familyLabels[r.family]}</StatusBadge>
                    {r.fitScore !== undefined ? (
                      <StatusBadge tone={fitTone(r.fitScore)}>Adecuación {r.fitScore}%</StatusBadge>
                    ) : null}
                  </div>
                </div>
                {r.suggestedTarget ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Target className="size-3.5 shrink-0" aria-hidden />
                    Objetivo sugerido: <span className="font-mono font-medium">{r.suggestedTarget}</span>
                  </p>
                ) : null}
                <p className="mt-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-primary/12">
                  Requisito: {r.requirement}
                </p>
                {r.preparation && r.preparation.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                    {r.preparation.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </GlassCard>

      {plan.targetCandidates.length > 0 ? (
        <GlassCard>
          <CardHeading
            title="Posibles variables objetivo"
            meta="Columnas aptas como objetivo según su tipo y cardinalidad"
          />
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {plan.targetCandidates.map((t) => (
              <li key={t.column} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-[12px] font-medium">{t.column}</p>
                  <StatusBadge tone="info">
                    {t.kind === "clasificacion" ? "Clasificación" : "Regresión"}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.reason}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

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
