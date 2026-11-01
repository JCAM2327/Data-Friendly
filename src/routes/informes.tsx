import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Database, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/common/MetricCard";
import { ReportDocument } from "@/components/reports/ReportDocument";
import reportCss from "@/components/reports/report.css?raw";
import "@/components/reports/report.css";
import { useDataset } from "@/state/dataset-store";
import { buildReport } from "@/services/report-service";
import { downloadText } from "@/lib/download";

export const Route = createFileRoute("/informes")({
  head: () => ({ meta: [
    { title: "Informe de calidad exportable · DataClean AI" },
    { name: "description", content: "Informe completo del diagnóstico, limpieza, validación y EDA con comparación antes y después." },
    { property: "og:title", content: "Informe de calidad exportable · DataClean AI" },
    { property: "og:description", content: "Resultados reales del dataset, trazabilidad y exportación HTML o impresión PDF." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InformesPage,
});

function InformesPage() {
  const { dataset, originalDataset, currentTable, originalTable, validationRules, steps, history, registerOperation, loadDemoDataset } = useDataset();
  const report = useMemo(() => dataset && originalDataset && currentTable && originalTable ? buildReport({
    current: dataset, original: originalDataset, currentTable, originalTable, rules: validationRules, steps, history, generatedAt: new Date().toISOString(),
  }) : null, [dataset, originalDataset, currentTable, originalTable, validationRules, steps, history]);

  if (!report) return <><PageHeader title="Informes" description="Reporte de calidad del dataset." /><EmptyState icon={Database} title="Sin informe disponible" description="Carga un dataset para generar el informe de calidad." action={<div className="flex flex-wrap justify-center gap-2"><Button asChild><Link to="/datos">Analizar un dataset</Link></Button><Button variant="outline" onClick={loadDemoDataset}>Ver ejemplo de demostración</Button></div>} /></>;

  const exportHtml = () => {
    const body = renderToStaticMarkup(<ReportDocument report={report} />);
    downloadText(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de calidad · DataClean AI</title><style>${reportCss}</style></head><body>${body}</body></html>`, "informe-dataclean.html", "text/html;charset=utf-8");
    registerOperation({ kind: "informe", label: "Informe HTML exportado", detail: `${report.current.name} · calidad ${report.before.score} → ${report.after.score}/100` });
  };

  return <>
    <PageHeader title="Informes" description={report.current.name} action={<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button><Button size="sm" onClick={exportHtml}><Download className="size-4" />Exportar HTML</Button></div>} />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <MetricCard label="Calidad antes" value={`${report.before.score}/100`} />
      <MetricCard label="Calidad después" value={`${report.after.score}/100`} />
      <MetricCard label="Problemas corregidos" value={String(report.counts.corrected)} tone="success" />
      <MetricCard label="Problemas pendientes" value={String(report.counts.pending)} tone={report.counts.pending ? "warning" : "success"} />
    </div>
    <ReportDocument report={report} />
  </>;
}