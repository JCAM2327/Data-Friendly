import { createFileRoute, Link } from "@tanstack/react-router";
import { Plug, Trash2, ShieldCheck } from "lucide-react";
import { FileUploader } from "@/components/data/FileUploader";
import { ColumnPreviewTable } from "@/components/data/ColumnPreviewTable";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { dataset, loadDemoDataset, loadDataset, clearDataset } = useDataset();

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
          title="Cargar archivo"
          meta="Al cargar se reemplaza el dataset activo"
          action={
            <Button variant="ghost" size="sm" onClick={loadDemoDataset}>
              Usar demostración
            </Button>
          }
        />
        <div className="mt-3">
          <FileUploader onLoaded={loadDataset} />
        </div>
      </GlassCard>

      {dataset ? (
        <>
          {dataset.isDemo ? <DemoNotice /> : null}

          <GlassCard>
            <CardHeading
              title={dataset.sheetName ? `${dataset.name} · ${dataset.sheetName}` : dataset.name}
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

          <GlassCard>
            <CardHeading
              title="Columnas detectadas"
              meta={`${dataset.columnProfiles.length} columnas · ${dataset.issues.length} problema(s) detectado(s)`}
              action={
                <Button asChild size="sm">
                  <Link to="/calidad">
                    <ShieldCheck className="size-4" aria-hidden />
                    Ver diagnóstico
                  </Link>
                </Button>
              }
            />
            <div className="mt-3">
              <ColumnPreviewTable profiles={dataset.columnProfiles} />
            </div>
          </GlassCard>
        </>
      ) : null}

      <ModuleStub
        icon={Plug}
        title="Próximas fuentes"
        items={[
          "Conexión a bases de datos y hojas en línea",
          "Procesamiento en segundo plano para archivos muy grandes",
          "Carga por lotes para archivos grandes",
          "Credenciales seguras para bases de datos remotas",
        ]}
      />
    </>
  );
}
