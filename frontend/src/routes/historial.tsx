import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { History, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { useDataset } from "@/state/dataset-store";
import { formatDateTime } from "@/lib/format";
import { downloadText } from "@/lib/download";
import { historyCsv } from "@/services/report-service";
import type { OperationRecord } from "@/lib/types";

export const Route = createFileRoute("/historial")({
  head: () => ({ meta: [
    { title: "Historial de operaciones · DataClean AI" },
    { name: "description", content: "Registro de cargas, transformaciones, reglas y exportaciones durante la sesión de análisis." },
    { property: "og:title", content: "Historial de operaciones · DataClean AI" },
    { property: "og:description", content: "Consulta, filtra y exporta la trazabilidad de las operaciones ejecutadas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: HistorialPage,
});

const kindTone: Record<OperationRecord["kind"], BadgeTone> = { carga: "info", diagnostico: "warning", limpieza: "success", validacion: "success", informe: "neutral", ml: "info" };
const kindLabel: Record<OperationRecord["kind"], string> = { carga: "Carga", diagnostico: "Diagnóstico", limpieza: "Limpieza", validacion: "Validación", informe: "Informe", ml: "ML" };

function HistorialPage() {
  const { history, steps } = useDataset();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("todos");
  const filtered = history.filter((op) => (kind === "todos" || op.kind === kind) && `${op.label} ${op.detail}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  return <>
    <PageHeader title="Historial" description="Registro de esta sesión; se conserva hasta cerrar o recargar la página." action={<Button size="sm" variant="outline" disabled={!filtered.length} onClick={() => downloadText(historyCsv(filtered), "historial-dataclean.csv", "text/csv;charset=utf-8")}><Download className="size-4" />Exportar CSV</Button>} />
    {!history.length ? <EmptyState icon={History} title="Sin operaciones registradas" description="Todavía no se han ejecutado operaciones." /> : <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input className="w-full min-w-0 bg-transparent text-sm outline-none" aria-label="Buscar operaciones" placeholder="Buscar operaciones" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <select className="h-9 max-w-full rounded-lg border border-input bg-background px-3 text-sm" aria-label="Tipo de operación" value={kind} onChange={(e) => setKind(e.target.value)}><option value="todos">Todos los tipos</option>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      <GlassCard><CardHeading title="Registro cronológico" meta={`${filtered.length} de ${history.length} operaciones · ${steps.length} transformaciones activas`} />
        {!filtered.length ? <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados para estos filtros.</p> : <ol className="mt-4 divide-y divide-border">{filtered.map((op) => <li key={op.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><StatusBadge tone={kindTone[op.kind]}>{kindLabel[op.kind]}</StatusBadge><p className="min-w-0 break-words text-[13px] font-medium">{op.label}</p></div><time className="text-[11px] text-muted-foreground" dateTime={op.at}>{formatDateTime(op.at)}</time></div><p className="mt-2 break-words text-[12px] text-muted-foreground">{op.detail}</p></li>)}</ol>}
      </GlassCard>
      {steps.length ? <GlassCard><CardHeading title="Transformaciones activas" meta="Orden de aplicación sobre el dataset actual" /><ol className="mt-3 divide-y divide-border">{steps.map((s, i) => <li key={s.id} className="py-3"><p className="text-[13px] font-medium">{i + 1}. {s.operation}{s.column ? ` · ${s.column}` : ""}</p><p className="mt-1 text-[12px] text-muted-foreground">{s.method} · {s.affected} registro(s) · {s.result}</p></li>)}</ol></GlassCard> : null}
    </>}
  </>;
}