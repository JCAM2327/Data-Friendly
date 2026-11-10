import type { ReactNode } from "react";
import type { DatasetReport } from "@/services/report-service";
import { readinessLabel } from "@/services/validation-service";
import { formatDateTime, formatNumber } from "@/lib/format";
import { severityLabel } from "@/lib/severity";

function ReportTable({ headings, rows }: { headings: string[]; rows: ReactNode[][] }) {
  return <div className="report-table-scroll"><table><thead><tr>{headings.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headings.length}>Sin registros.</td></tr>}</tbody></table></div>;
}

export function ReportDocument({ report: r }: { report: DatasetReport }) {
  return <article className="report-document" aria-label="Informe completo">
    <header>
      <p className="report-eyebrow">DataClean AI · Informe de análisis</p>
      <h2>{r.current.name}</h2>
      <p>{r.current.source}{r.current.sheetName ? ` · Hoja: ${r.current.sheetName}` : ""} · Generado {formatDateTime(r.generatedAt)}</p>
      {r.current.isDemo ? <p className="report-warning">DEMOSTRACIÓN — no corresponde a un archivo real del usuario.</p> : null}
    </header>

    <section>
      <h3>Resumen de calidad</h3>
      <p className="report-verdict">{readinessLabel[r.after.readiness]} · {r.before.score}/100 → {r.after.score}/100</p>
      <ReportTable headings={["Métrica", "Original", "Actual"]} rows={[
        ["Filas", formatNumber(r.original.rows), formatNumber(r.current.rows)],
        ["Columnas", r.original.columns, r.current.columns],
        ["Valores faltantes", `${r.original.missingPct}%`, `${r.current.missingPct}%`],
        ["Filas duplicadas", r.original.duplicates, r.current.duplicates],
        ["Data Quality Score", `${r.before.score}/100`, `${r.after.score}/100`],
      ]} />
      <p>Problemas encontrados: <strong>{r.counts.found}</strong> · Corregidos: <strong>{r.counts.corrected}</strong> · Pendientes: <strong>{r.counts.pending}</strong> · Nuevos: <strong>{r.counts.newIssues}</strong>.</p>
      <p className="report-note">Corregidos cuenta incidencias originales que ya no aparecen en el diagnóstico; las reducciones parciales siguen pendientes. Antes y después se evalúan con las mismas reglas actuales.</p>
      <ReportTable headings={["Dimensión", "Antes", "Después", "Detalle actual"]} rows={r.after.dimensions.map((d, i) => [d.label, `${r.before.dimensions[i]?.score ?? 0}%`, `${d.score}%`, d.detail])} />
    </section>

    <section>
      <h3>Preparación para análisis</h3>
      {r.after.blockers.length ? <><h4>Bloqueos</h4><ul>{r.after.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul></> : <p>Sin bloqueos en los criterios evaluados.</p>}
      {r.after.warnings.length ? <><h4>Avisos</h4><ul>{r.after.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></> : null}
    </section>

    <section>
      <h3>Diagnóstico original</h3>
      <ReportTable headings={["Problema", "Columna", "Severidad", "Afectados", "Descripción"]} rows={r.original.issues.map((i) => [i.title, i.column ?? "Todas", severityLabel[i.severity], i.affectedRows, i.detail])} />
      <h3>Problemas pendientes</h3>
      <ReportTable headings={["Problema", "Columna", "Severidad", "Afectados", "Recomendación"]} rows={r.current.issues.map((i) => [i.title, i.column ?? "Todas", severityLabel[i.severity], i.affectedRows, i.suggestedFix ?? i.detail])} />
    </section>

    <section>
      <h3>Limpieza aplicada</h3>
      <ReportTable headings={["Operación", "Columna", "Método", "Afectados", "Resultado"]} rows={r.steps.map((s) => [s.operation, s.column || "Todas", s.method, s.affected, s.result])} />
    </section>

    <section>
      <h3>Reglas de validación</h3>
      <ReportTable headings={["Regla", "Estado", "Evaluados", "Afectados", "Cumplimiento"]} rows={r.after.results.map((v) => [v.label + (v.rule.critical ? " (crítica)" : ""), v.passed ? "Cumplida" : "Incumplida", v.evaluated, v.failed, `${v.compliance}%`])} />
    </section>

    <section>
      <h3>EDA · Dataset de trabajo actual</h3>
      <h4>Estadística numérica</h4>
      <ReportTable headings={["Variable", "N", "Media", "Mediana", "Mín.", "Máx.", "Desv.", "P5", "P25", "P75", "P95", "IQR"]} rows={r.eda.numeric.map((n) => [n.column, n.n, n.mean, n.median, n.min, n.max, n.std, n.p5, n.p25, n.p75, n.p95, n.iqr])} />
      <h4>Categorías</h4>
      <ReportTable headings={["Variable", "Cardinalidad", "Categoría", "Frecuencia", "% no nulos"]} rows={r.eda.categorical.flatMap((c) => c.top.map((v) => [c.column, c.cardinality, v.value, v.count, `${v.pct}%`]))} />
      <h4>Relaciones</h4>
      <ReportTable headings={["Variable A", "Variable B", "Correlación Pearson"]} rows={r.eda.correlations.map((c) => [c.a, c.b, c.r])} />
      <h4>Series temporales</h4>
      <ReportTable headings={["Fecha", "Métrica", "Periodo", "Total"]} rows={r.eda.series.flatMap((s) => s.points.map((p) => [s.dateColumn, s.valueColumn ?? "Registros", p.period, p.value]))} />
      <h4>Hallazgos</h4>
      {r.eda.insights.length ? <ul>{r.eda.insights.map((i, n) => <li key={n}>{i}</li>)}</ul> : <p>No se detectaron hallazgos destacables con los criterios del EDA.</p>}
      <h4>Preguntas sugeridas</h4>
      <ul>{r.eda.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
      <h4>Próximos análisis recomendados</h4>
      <ul>{r.eda.recommendations.map((rec) => <li key={rec.title}><strong>{rec.title}:</strong> {rec.reason}</li>)}</ul>
    </section>

    <section>
      <h3>Trazabilidad de la sesión</h3>
      <ReportTable headings={["Fecha", "Tipo", "Operación", "Detalle"]} rows={r.history.map((h) => [formatDateTime(h.at), h.kind, h.label, h.detail])} />
      <p className="report-note">Las operaciones pueden incluir otros archivos cargados durante la sesión. El informe es una fotografía del estado actual; no certifica criterios que no se hayan definido.</p>
    </section>
  </article>;
}