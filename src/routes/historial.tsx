import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { useDataset } from "@/state/dataset-store";
import { formatDateTime } from "@/lib/format";
import type { OperationRecord } from "@/lib/types";

export const Route = createFileRoute("/historial")({
  head: () => ({
    meta: [
      { title: "Historial · DataClean AI" },
      {
        name: "description",
        content: "Registro cronológico de cargas, diagnósticos y limpiezas de la sesión.",
      },
      { property: "og:title", content: "Historial · DataClean AI" },
      {
        property: "og:description",
        content: "Trazabilidad completa de las operaciones ejecutadas sobre los datos.",
      },
    ],
  }),
  component: HistorialPage,
});

const kindTone: Record<OperationRecord["kind"], BadgeTone> = {
  carga: "info",
  diagnostico: "warning",
  limpieza: "success",
  validacion: "success",
  informe: "neutral",
  ml: "info",
};

const kindLabel: Record<OperationRecord["kind"], string> = {
  carga: "Carga",
  diagnostico: "Diagnóstico",
  limpieza: "Limpieza",
  validacion: "Validación",
  informe: "Informe",
  ml: "ML",
};

function HistorialPage() {
  const { history } = useDataset();

  return (
    <>
      <PageHeader
        title="Historial"
        description="Operaciones ejecutadas durante esta sesión de trabajo."
      />

      {history.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin operaciones registradas"
          description="Cada carga, limpieza o validación quedará registrada aquí con su fecha y detalle."
        />
      ) : (
        <GlassCard>
          <CardHeading title="Registro cronológico" meta={`${history.length} operación(es)`} />
          <ol className="mt-3 space-y-2">
            {history.map((op) => (
              <li
                key={op.id}
                className="flex items-start gap-3 rounded-xl glass-inset p-3 ring-1 ring-white/50"
              >
                <StatusBadge tone={kindTone[op.kind]}>{kindLabel[op.kind]}</StatusBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{op.label}</p>
                  <p className="text-[11px] text-muted-foreground">{op.detail}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDateTime(op.at)}
                </span>
              </li>
            ))}
          </ol>
        </GlassCard>
      )}
    </>
  );
}
