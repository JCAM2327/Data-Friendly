import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Database, Lightbulb, HelpCircle, ArrowRight } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { GlassCard, CardHeading } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DemoNotice } from "@/components/common/DemoNotice";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useDataset } from "@/state/dataset-store";
import { formatNumber } from "@/lib/format";
import { runEda, type NumericStats } from "@/services/eda-service";

export const Route = createFileRoute("/eda")({
  head: () => ({
    meta: [
      { title: "EDA · DataClean AI" },
      { name: "description", content: "Análisis exploratorio: estadística descriptiva, gráficos, correlaciones y preguntas sugeridas." },
      { property: "og:title", content: "EDA · DataClean AI" },
      { property: "og:description", content: "Exploración automática del dataset limpio con recomendaciones de análisis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EdaPage,
});

const axis = { fontSize: 10, fill: "var(--muted-foreground)" };
const tooltipStyle = { fontSize: 11, borderRadius: 8, background: "var(--popover)", border: "1px solid var(--border)" };

function EdaPage() {
  const { dataset, currentTable, loadDemoDataset } = useDataset();
  const eda = useMemo(() => (dataset && currentTable ? runEda(currentTable, dataset) : null), [dataset, currentTable]);
  const [numSel, setNumSel] = useState(0);
  const [catSel, setCatSel] = useState(0);

  if (!dataset || !eda) {
    return (
      <>
        <PageHeader title="EDA" description="Análisis exploratorio del dataset limpio." />
        <EmptyState
          icon={Database}
          title="Sin variables que explorar"
          description="La exploración se construye sobre datos cargados. No se generan gráficos sin datos reales."
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

  const num = eda.numeric[numSel] ?? eda.numeric[0];
  const cat = eda.categorical[catSel] ?? eda.categorical[0];

  return (
    <>
      <PageHeader
        title="EDA"
        description={dataset.status === "limpiado" ? "Sobre el dataset limpio (tabla de trabajo actual)." : "Sobre el dataset cargado: aún no se ha aplicado ninguna limpieza."}
        action={<StatusBadge tone={dataset.status === "limpiado" ? "success" : "warning"}>{dataset.status === "limpiado" ? "Datos limpios" : "Sin limpiar"}</StatusBadge>}
      />
      {dataset.isDemo ? <DemoNotice /> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Filas" value={formatNumber(dataset.rows)} />
        <MetricCard label="Numéricas" value={String(eda.numeric.length)} />
        <MetricCard label="Categóricas" value={String(eda.categorical.length)} />
        <MetricCard label="Pares muy relacionados" value={String(eda.strongPairs.length)} />
      </div>

      {eda.numeric.length ? (
        <GlassCard>
          <CardHeading title="Variables numéricas" meta="Estadística descriptiva" />
          <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-white/50">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="glass-inset font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {["Variable", "n", "Media", "Mediana", "Mín", "Máx", "Desv.", "P5", "P25", "P75", "P95", "IQR", "Atípicos"].map((h, i) => (
                    <th key={h} className={`px-2 py-2 ${i ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eda.numeric.map((n, i) => (
                  <tr key={n.column} onClick={() => setNumSel(i)} className={`cursor-pointer ${i === numSel ? "bg-primary/10" : i % 2 === 0 ? "bg-white/40" : "bg-white/20"}`}>
                    <td className="px-2 py-2 font-mono text-[11px] font-semibold">{n.column}</td>
                    {[n.n, n.mean, n.median, n.min, n.max, n.std, n.p5, n.p25, n.p75, n.p95, n.iqr, n.outliers].map((v, j) => (
                      <td key={j} className="px-2 py-2 text-right font-mono text-[11px]">{formatNumber(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {num ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-[12px] font-medium">Histograma · {num.column}</p>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={num.histogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="bin" tick={axis} />
                      <YAxis tick={axis} width={36} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Frecuencia" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[12px] font-medium">Boxplot · {num.column}</p>
                <BoxPlot s={num} />
              </div>
            </div>
          ) : null}
        </GlassCard>
      ) : null}

      {eda.categorical.length ? (
        <GlassCard>
          <CardHeading title="Variables categóricas" meta="Frecuencia, porcentaje y cardinalidad" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {eda.categorical.map((c, i) => (
              <Button key={c.column} size="sm" variant={i === catSel ? "default" : "outline"} onClick={() => setCatSel(i)}>
                {c.column} <span className="font-mono text-[10px] opacity-70">· {c.cardinality}</span>
              </Button>
            ))}
          </div>
          {cat ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={cat.top} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={axis} />
                    <YAxis type="category" dataKey="value" tick={axis} width={90} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Frecuencia" fill="var(--primary)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Cardinalidad: <span className="font-mono">{cat.cardinality}</span> · valores no nulos: <span className="font-mono">{formatNumber(cat.n)}</span>
                </p>
                <ul className="mt-2 space-y-1">
                  {cat.top.map((t) => (
                    <li key={t.value} className="flex justify-between gap-2 rounded-lg glass-inset px-2.5 py-1.5 font-mono text-[11px] ring-1 ring-white/50">
                      <span className="truncate">{t.value}</span>
                      <span>{formatNumber(t.count)} · {t.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </GlassCard>
      ) : null}

      {eda.series.map((s) => (
        <GlassCard key={s.dateColumn}>
          <CardHeading
            title={`Serie temporal · ${s.dateColumn}`}
            meta={`${s.valueColumn ? `Suma mensual de ${s.valueColumn}` : "Registros por mes"}${s.trendPct !== null ? ` · tendencia ${s.trendPct > 0 ? "+" : ""}${s.trendPct}%` : ""}`}
          />
          <div className="mt-3 h-56">
            <ResponsiveContainer>
              <LineChart data={s.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={axis} />
                <YAxis tick={axis} width={48} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line dataKey="value" name={s.valueColumn ?? "Registros"} stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      ))}

      {eda.matrixColumns.length >= 2 ? (
        <GlassCard>
          <CardHeading title="Matriz de correlación" meta="Pearson entre variables numéricas" />
          <div className="mt-3 overflow-x-auto">
            <table className="border-collapse font-mono text-[10px]">
              <thead>
                <tr>
                  <th />
                  {eda.matrixColumns.map((c) => <th key={c} className="max-w-20 truncate px-1 py-1 font-normal text-muted-foreground">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {eda.matrix.map((row, i) => (
                  <tr key={i}>
                    <td className="pr-2 text-right text-muted-foreground">{eda.matrixColumns[i]}</td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className="size-12 text-center"
                        style={{ background: v >= 0 ? `color-mix(in oklch, var(--primary) ${Math.abs(v) * 80}%, transparent)` : `color-mix(in oklch, var(--danger) ${Math.abs(v) * 80}%, transparent)` }}
                      >
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      {eda.scatter.length ? (
        <GlassCard>
          <CardHeading title="Scatter plots" meta="Pares numéricos con mayor correlación (|r| ≥ 0,3)" />
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {eda.scatter.map((s) => (
              <div key={`${s.a}-${s.b}`}>
                <p className="mb-1 font-mono text-[11px]">{s.a} vs {s.b}</p>
                <div className="h-52">
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" dataKey="x" name={s.a} tick={axis} />
                      <YAxis type="number" dataKey="y" name={s.b} tick={axis} width={40} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Scatter data={s.points} fill="var(--primary)" fillOpacity={0.5} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <CardHeading title="Relaciones y hallazgos" meta="Correlaciones, tendencias, distribuciones y dominancia" />
          {eda.insights.length ? (
            <ul className="mt-3 space-y-1.5">
              {eda.insights.map((t, i) => <li key={i} className="flex gap-2 text-[12px]"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" />{t}</li>)}
            </ul>
          ) : <p className="mt-3 text-[12px] text-muted-foreground">No se detectaron relaciones ni patrones destacables.</p>}
        </GlassCard>
        <GlassCard>
          <CardHeading title="Preguntas sugeridas" meta="Generadas a partir de las columnas disponibles" />
          {eda.questions.length ? (
            <ul className="mt-3 space-y-1.5">
              {eda.questions.map((t, i) => <li key={i} className="flex gap-2 text-[12px]"><HelpCircle className="mt-0.5 size-3.5 shrink-0 text-info" />{t}</li>)}
            </ul>
          ) : <p className="mt-3 text-[12px] text-muted-foreground">No hay columnas suficientes para proponer preguntas.</p>}
        </GlassCard>
      </div>

      <GlassCard>
        <CardHeading title="Próximos análisis recomendados" meta="Basados en las características reales del dataset" />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {eda.recommendations.map((rec) => (
            <li key={rec.title} className="glass-inset rounded-xl p-3 ring-1 ring-white/50">
              <p className="flex items-center gap-1.5 text-[13px] font-medium"><ArrowRight className="size-3.5 text-primary" />{rec.title}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{rec.reason}</p>
            </li>
          ))}
        </ul>
      </GlassCard>
    </>
  );
}

function BoxPlot({ s }: { s: NumericStats }) {
  const lo = s.p25 - 1.5 * s.iqr, hi = s.p75 + 1.5 * s.iqr;
  const wl = Math.max(s.min, lo), wh = Math.min(s.max, hi);
  const span = s.max - s.min || 1;
  const x = (v: number) => 20 + ((v - s.min) / span) * 360;
  return (
    <svg viewBox="0 0 400 140" className="h-56 w-full">
      <line x1={x(wl)} x2={x(wh)} y1={60} y2={60} stroke="var(--muted-foreground)" />
      <line x1={x(wl)} x2={x(wl)} y1={45} y2={75} stroke="var(--muted-foreground)" />
      <line x1={x(wh)} x2={x(wh)} y1={45} y2={75} stroke="var(--muted-foreground)" />
      <rect x={x(s.p25)} y={35} width={Math.max(1, x(s.p75) - x(s.p25))} height={50} fill="color-mix(in oklch, var(--primary) 25%, transparent)" stroke="var(--primary)" />
      <line x1={x(s.median)} x2={x(s.median)} y1={35} y2={85} stroke="var(--primary)" strokeWidth={2} />
      {s.min < lo ? <circle cx={x(s.min)} cy={60} r={3} fill="var(--danger)" /> : null}
      {s.max > hi ? <circle cx={x(s.max)} cy={60} r={3} fill="var(--danger)" /> : null}
      <text x={20} y={115} fontSize={10} fill="var(--muted-foreground)">mín {s.min}</text>
      <text x={200} y={115} fontSize={10} textAnchor="middle" fill="var(--muted-foreground)">mediana {s.median} · IQR {s.iqr}</text>
      <text x={380} y={115} fontSize={10} textAnchor="end" fill="var(--muted-foreground)">máx {s.max}</text>
    </svg>
  );
}
