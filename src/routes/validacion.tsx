import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ModuleStub } from "@/components/common/ModuleStub";
import { useDataset } from "@/state/dataset-store";

export const Route = createFileRoute("/validacion")({
  head: () => ({
    meta: [
      { title: "Validación · DataClean AI" },
      {
        name: "description",
        content: "Reglas de validación y comprobaciones previas al modelado.",
      },
      { property: "og:title", content: "Validación · DataClean AI" },
      {
        property: "og:description",
        content: "Comprobaciones estructurales y de negocio sobre el dataset activo.",
      },
    ],
  }),
  component: ValidacionPage,
});

function ValidacionPage() {
  const { dataset, loadDemoDataset } = useDataset();

  if (!dataset) {
    return (
      <>
        <PageHeader title="Validación" description="Reglas y comprobaciones sobre los datos." />
        <EmptyState
          icon={Database}
          title="Sin dataset que validar"
          description="Las reglas se ejecutan sobre datos cargados. No se muestran resultados simulados."
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

  const checks = [
    {
      id: "duplicados",
      label: "Sin filas duplicadas",
      ok: dataset.duplicates === 0,
      detail: `${dataset.duplicates} duplicado(s)`,
    },
    {
      id: "faltantes",
      label: "Faltantes por debajo del 5%",
      ok: dataset.missingPct < 5,
      detail: `${dataset.missingPct}% de valores faltantes`,
    },
    {
      id: "tipos",
      label: "Tipos de dato consistentes",
      ok: !dataset.issues.some((i) => i.id.startsWith("tipo-")),
      detail: "Comprobación estructural",
    },
    {
      id: "columnas",
      label: "Esquema con columnas mínimas",
      ok: dataset.columns > 0,
      detail: `${dataset.columns} columnas detectadas`,
    },
  ];

  const passed = checks.filter((c) => c.ok).length;

  return (
    <>
      <PageHeader
        title="Validación"
        description="Comprobaciones previas al análisis y al modelado."
        action={
          <StatusBadge tone={passed === checks.length ? "success" : "warning"}>
            {passed}/{checks.length} superadas
          </StatusBadge>
        }
      />

      {dataset.isDemo ? <DemoNotice /> : null}

      <GlassCard>
        <CardHeading title="Reglas base" meta="Se ejecutan automáticamente tras cada limpieza" />
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl glass-inset p-3 ring-1 ring-white/50"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${c.ok ? "bg-success" : "bg-warning"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{c.detail}</p>
              </div>
              <StatusBadge tone={c.ok ? "success" : "warning"}>
                {c.ok ? "Superada" : "Pendiente"}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </GlassCard>

      <ModuleStub
        icon={ClipboardCheck}
        title="Validación avanzada prevista"
        items={[
          "Reglas de negocio definidas por el usuario",
          "Rangos y dominios permitidos por columna",
          "Validación de claves y relaciones entre tablas",
          "Bloqueo del paso a modelado si fallan reglas críticas",
        ]}
      />
    </>
  );
}
