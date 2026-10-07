import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Database, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { MetricCard } from "@/components/common/MetricCard";
import { useDataset } from "@/state/dataset-store";
import { formatNumber } from "@/lib/format";
import {
  assessQuality,
  readinessLabel,
  ruleKindLabels,
  suggestRules,
  type Readiness,
  type RuleKind,
  type ValidationRule,
} from "@/services/validation-service";

export const Route = createFileRoute("/validacion")({
  head: () => ({
    meta: [
      { title: "Validación y Data Quality · DataClean AI" },
      { name: "description", content: "Evalúa si el dataset limpio está preparado para análisis: seis dimensiones de calidad y reglas de negocio." },
      { property: "og:title", content: "Validación y Data Quality · DataClean AI" },
      { property: "og:description", content: "Data Quality Score real, reglas de validación y veredicto de preparación para análisis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValidacionPage,
});

const readinessTone: Record<Readiness, BadgeTone> = { listo: "success", revision: "warning", no_recomendado: "danger" };
const selectCls = "h-9 rounded-lg border border-input bg-background/70 px-2 text-[12px]";

function ValidacionPage() {
  const { dataset, originalDataset, currentTable, steps, loadDemoDataset } = useDataset();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => {
    if (originalDataset && seededFor !== originalDataset.id) {
      setRules(suggestRules(originalDataset));
      setSeededFor(originalDataset.id);
    }
  }, [originalDataset, seededFor]);

  const assessment = useMemo(
    () => (dataset && currentTable ? assessQuality(currentTable, dataset, rules) : null),
    [dataset, currentTable, rules],
  );

  if (!dataset || !originalDataset || !currentTable || !assessment) {
    return (
      <>
        <PageHeader title="Validación" description="Data Quality y reglas de validación." />
        <EmptyState
          icon={Database}
          title="Sin dataset que validar"
          description="La calidad se calcula sobre datos reales cargados. No se muestran resultados simulados."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="lg"><Link to="/datos">Analizar un dataset</Link></Button>
              <Button variant="outline" size="lg" onClick={loadDemoDataset}>Ver ejemplo de demostración</Button>
            </div>
          }
        />
      </>
    );
  }

  const { dimensions, score, readiness, blockers, warnings, results } = assessment;
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  // Reporte: comparación por id de problema entre original y actual
  const currentIds = new Set(dataset.issues.map((i) => i.id));
  const originalIds = new Set(originalDataset.issues.map((i) => i.id));
  const corrected = originalDataset.issues.filter((i) => !currentIds.has(i.id)).length;
  const newIssues = dataset.issues.filter((i) => !originalIds.has(i.id)).length;
  const scoreBefore = originalDataset.currentTable ? 0 : assessQuality(rawOriginal(), originalDataset, rules).score;
  function rawOriginal() {
    return steps.length ? (steps[0] ? undefinedSafe() : currentTable!) : currentTable!;
  }
  function undefinedSafe() {
    return originalTableRef!;
  }
  void scoreBefore;

  return null as unknown as JSX.Element;
}

declare const originalTableRef: never;
