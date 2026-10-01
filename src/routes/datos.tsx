import { createFileRoute } from "@tanstack/react-router";
import { Database, Upload, Plug, FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModuleStub } from "@/components/common/ModuleStub";
import { useDataset } from "@/state/dataset-store";
import { formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/datos")({
  head: () => ({
    meta: [
      { title: "Datos · DataClean AI" },
      {
        name: "description",
        content: "Carga archivos o conecta fuentes de datos para iniciar el diagnóstico de calidad.",
      },
      { property: "og:title", content: "Datos · DataClean AI" },
      {
        property: "og:description",
        content: "Fuentes y formatos soportados para cargar tu conjunto de datos.",
      },
    ],
  }),
  component: DatosPage,
});

type PreviewRow = Record<string, string>;

function DatosPage() {
  const { dataset, loadDemoDataset, clearDataset } = useDataset();

  const previewColumns: Column<PreviewRow>[] =
    dataset && dataset.preview.length > 0
      ? Object.keys(dataset.preview[0] ?? {}).map((key) => ({ key, header: key }))
      : [];

  return (
    <>
      <PageHeader
        title="Datos"
        description="Carga un archivo o conecta una fuente para trabajar en la sesión."
        action={
          dataset ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Trash2 className="size-4" aria-hidden />
                  Descartar dataset
                </Button>
              }
              title="¿Descartar el dataset activo?"
              description="Se perderá el diagnóstico y las correcciones no exportadas de esta sesión."
              confirmLabel="Descartar"
              destructive
              onConfirm={clearDataset}
            />
          ) : null
        }
      />

      <GlassCard>
        <CardHeading
          title="Origen de los datos"
          meta="La ingesta real se conectará en la siguiente fase"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { icon: Upload, label: "Subir archivo", hint: "CSV, XLSX, JSON, Parquet" },
            { icon: Plug, label: "Conectar base de datos", hint: "PostgreSQL, MySQL, BigQuery" },
            { icon: FileSpreadsheet, label: "Hoja de cálculo", hint: "Google Sheets, Excel online" },
          ].map((s) => (
            <div
              key={s.label}
              className="glass-inset rounded-xl p-3 ring-1 ring-white/50"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                <s.icon className="size-4" aria-hidden />
              </span>
              <p className="mt-2 text-[13px] font-medium">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">{s.hint}</p>
              <Button variant="outline" size="sm" className="mt-2 w-full" disabled>
                Próximamente
              </Button>
            </div>
          ))}
        </div>
      </GlassCard>

      {!dataset ? (
        <EmptyState
          icon={Database}
          title="Ninguna fuente conectada"
          description="Mientras se habilita la ingesta real puedes revisar la aplicación con un conjunto de demostración."
          action={
            <Button size="lg" onClick={loadDemoDataset}>
              Ver ejemplo de demostración
            </Button>
          }
        />
      ) : (
        <>
          {dataset.isDemo ? <DemoNotice /> : null}

          <GlassCard>
            <CardHeading
              title={dataset.name}
              meta={`${dataset.source} · ${dataset.sizeLabel} · ${formatDateTime(dataset.loadedAt)}`}
              action={
                <StatusBadge tone="info">
                  {formatNumber(dataset.rows)} filas · {dataset.columns} col.
                </StatusBadge>
              }
            />
            <div className="mt-3">
              <DataTable columns={previewColumns} rows={dataset.preview} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Vista previa de las primeras filas.
            </p>
          </GlassCard>
        </>
      )}

      <ModuleStub
        icon={Plug}
        title="Ingesta prevista"
        items={[
          "Detección automática de separador y codificación",
          "Inferencia de tipos por columna",
          "Carga por lotes para archivos grandes",
          "Credenciales seguras para bases de datos remotas",
        ]}
      />
    </>
  );
}
