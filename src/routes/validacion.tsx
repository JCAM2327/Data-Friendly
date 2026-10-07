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
  const { dataset, originalDataset, originalTable, currentTable, loadDemoDataset } = useDataset();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => {
    if (originalDataset && seededFor !== originalDataset.id + originalDataset.loadedAt) {
      setRules(suggestRules(originalDataset));
      setSeededFor(originalDataset.id + originalDataset.loadedAt);
    }
  }, [originalDataset, seededFor]);

  const after = useMemo(
    () => (dataset && currentTable ? assessQuality(currentTable, dataset, rules) : null),
    [dataset, currentTable, rules],
  );
  const before = useMemo(
    () => (originalDataset && originalTable ? assessQuality(originalTable, originalDataset, rules) : null),
    [originalDataset, originalTable, rules],
  );

  if (!dataset || !originalDataset || !after || !before) {
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

  const { dimensions, score, readiness, blockers, warnings, results } = after;
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const currentIds = new Set(dataset.issues.map((i) => i.id));
  const corrected = originalDataset.issues.filter((i) => !currentIds.has(i.id)).length;
  const columns = dataset.columnProfiles.map((c) => c.name);

  return (
    <>
      <PageHeader
        title="Validación y Data Quality"
        description="¿Está el dataset limpio realmente preparado para análisis?"
        action={<StatusBadge tone={readinessTone[readiness]} dot>{readinessLabel[readiness]}</StatusBadge>}
      />
      {dataset.isDemo ? <DemoNotice /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-1">
          <CardHeading title="Data Quality Score" meta="Media ponderada de 6 dimensiones reales" />
          <p className="mt-3 font-mono text-4xl font-semibold">{score}<span className="text-lg text-muted-foreground">/100</span></p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${score >= 85 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-danger"}`} style={{ width: `${score}%` }} />
          </div>
          <div className="mt-4">
            <StatusBadge tone={readinessTone[readiness]}>{readinessLabel[readiness]}</StatusBadge>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <CardHeading title="Dimensiones de calidad" meta="Calculadas sobre la tabla de trabajo actual" />
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {dimensions.map((d) => (
              <li key={d.key} className="glass-inset rounded-xl p-3 ring-1 ring-white/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium">{d.label}</p>
                  <span className={`font-mono text-[12px] font-semibold ${d.score >= 95 ? "text-success" : d.score >= 80 ? "text-warning" : "text-danger"}`}>{d.score}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${d.score >= 95 ? "bg-success" : d.score >= 80 ? "bg-warning" : "bg-danger"}`} style={{ width: `${d.score}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{d.detail} · peso {Math.round(d.weight * 100)}%</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <GlassCard>
        <CardHeading
          title="¿Qué impide considerar el dataset preparado?"
          meta={blockers.length ? `${blockers.length} bloqueo(s) · ${warnings.length} aviso(s)` : warnings.length ? `${warnings.length} aviso(s) menores` : "Ningún problema pendiente"}
        />
        {blockers.length === 0 && warnings.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-success"><CheckCircle2 className="size-4" /> El dataset cumple todos los criterios evaluados.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {blockers.map((b, i) => (
              <li key={`b${i}`} className="flex gap-2 text-[12px]"><XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />{b}</li>
            ))}
            {warnings.map((w, i) => (
              <li key={`w${i}`} className="flex gap-2 text-[12px] text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />{w}</li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Reglas de validación"
          meta={`${passed.length} cumplidas · ${failed.length} incumplidas · propuestas automáticamente según los nombres de columna`}
        />
        <RuleBuilder columns={columns} onAdd={(r) => setRules((p) => [...p, r])} />
        <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-white/50">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="glass-inset font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Regla</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Evaluados</th>
                <th className="px-3 py-2 text-right">Afectados</th>
                <th className="px-3 py-2 text-right">Cumplimiento</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={6} className="bg-white/40 px-3 py-6 text-center text-[12px] text-muted-foreground">Sin reglas. Añade una arriba.</td></tr>
              ) : results.map((r, i) => (
                <tr key={r.rule.id} className={i % 2 === 0 ? "bg-white/40" : "bg-white/20"}>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {r.label}
                    {r.rule.critical ? <span className="ml-1.5 text-[10px] text-danger">crítica</span> : null}
                    {r.sampleRows.length ? <p className="text-[10px] text-muted-foreground">filas: {r.sampleRows.map((n) => n + 1).join(", ")}{r.failed > 5 ? "…" : ""}</p> : null}
                  </td>
                  <td className="px-3 py-2"><StatusBadge tone={r.passed ? "success" : r.rule.critical ? "danger" : "warning"}>{r.passed ? "Cumplida" : "Incumplida"}</StatusBadge></td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">{formatNumber(r.evaluated)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">{formatNumber(r.failed)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] font-semibold">{r.compliance}%</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" aria-label="Eliminar regla" onClick={() => setRules((p) => p.filter((x) => x.id !== r.rule.id))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeading title="Reporte de calidad" meta="Dataset original frente a la tabla de trabajo actual" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Dataset original" value={`${formatNumber(originalDataset.rows)} filas`} hint={`${originalDataset.columns} columnas`} />
          <MetricCard label="Problemas encontrados" value={formatNumber(originalDataset.issues.length)} />
          <MetricCard label="Problemas corregidos" value={formatNumber(corrected)} tone={corrected ? "success" : "neutral"} />
          <MetricCard label="Problemas pendientes" value={formatNumber(dataset.issues.length)} tone={dataset.issues.length ? "warning" : "success"} />
          <MetricCard label="Calidad antes" value={`${before.score}/100`} />
          <MetricCard label="Calidad después" value={`${score}/100`} tone={score > before.score ? "success" : score < before.score ? "danger" : "neutral"} />
        </div>
        {dataset.issues.length > 0 ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Pendientes: {dataset.issues.slice(0, 6).map((i) => i.title).join(" · ")}{dataset.issues.length > 6 ? "…" : ""}.{" "}
            <Link to="/limpieza" className="underline">Ir a Limpieza</Link>
          </p>
        ) : null}
      </GlassCard>
    </>
  );
}

function RuleBuilder({ columns, onAdd }: { columns: string[]; onAdd: (r: ValidationRule) => void }) {
  const [kind, setKind] = useState<RuleKind>("min");
  const [column, setColumn] = useState(columns[0] ?? "");
  const [column2, setColumn2] = useState(columns[1] ?? columns[0] ?? "");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("120");
  const [critical, setCritical] = useState(true);
  const needsMin = kind === "min" || kind === "range";
  const needsMax = kind === "max" || kind === "range";
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as RuleKind)} aria-label="Tipo de regla">
        {(Object.keys(ruleKindLabels) as RuleKind[]).map((k) => <option key={k} value={k}>{ruleKindLabels[k]}</option>)}
      </select>
      <select className={selectCls} value={column} onChange={(e) => setColumn(e.target.value)} aria-label="Columna">
        {columns.map((c) => <option key={c}>{c}</option>)}
      </select>
      {kind === "date_order" ? (
        <select className={selectCls} value={column2} onChange={(e) => setColumn2(e.target.value)} aria-label="Columna fecha final">
          {columns.map((c) => <option key={c}>{c}</option>)}
        </select>
      ) : null}
      {needsMin ? <input className={`${selectCls} w-20`} type="number" value={min} onChange={(e) => setMin(e.target.value)} aria-label="Mínimo" /> : null}
      {needsMax ? <input className={`${selectCls} w-20`} type="number" value={max} onChange={(e) => setMax(e.target.value)} aria-label="Máximo" /> : null}
      <label className="flex h-9 items-center gap-1.5 text-[12px]">
        <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Crítica
      </label>
      <Button
        size="sm"
        onClick={() =>
          onAdd({
            id: `u-${Date.now()}`,
            kind,
            column,
            column2: kind === "date_order" ? column2 : undefined,
            min: needsMin ? Number(min) : undefined,
            max: needsMax ? Number(max) : undefined,
            critical,
          })
        }
        disabled={!column}
      >
        <Plus className="size-3.5" /> Añadir regla
      </Button>
    </div>
  );
}
