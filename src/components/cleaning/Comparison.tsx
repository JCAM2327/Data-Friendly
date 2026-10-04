import { formatNumber, formatPct } from "@/lib/format";
import type { DatasetSummary } from "@/lib/types";

/** Tabla ANTES | DESPUÉS con las métricas clave de calidad. */
export function Comparison({
  before,
  after,
  beforeLabel = "Antes",
  afterLabel = "Después",
}: {
  before: DatasetSummary;
  after: DatasetSummary;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const rows: { label: string; a: number; b: number; fmt: (n: number) => string; better: "up" | "down" }[] = [
    { label: "Filas", a: before.rows, b: after.rows, fmt: formatNumber, better: "up" },
    { label: "Columnas", a: before.columns, b: after.columns, fmt: formatNumber, better: "up" },
    { label: "Nulos", a: before.missingPct, b: after.missingPct, fmt: (n) => formatPct(n), better: "down" },
    { label: "Duplicados", a: before.duplicates, b: after.duplicates, fmt: formatNumber, better: "down" },
    { label: "Problemas detectados", a: before.issues.length, b: after.issues.length, fmt: formatNumber, better: "down" },
    { label: "Data Quality Score", a: before.qualityScore, b: after.qualityScore, fmt: (n) => `${n}/100`, better: "up" },
  ];
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-white/50">
      <table className="w-full min-w-[360px] border-collapse text-left">
        <thead>
          <tr className="glass-inset font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Métrica</th>
            <th className="px-3 py-2 text-right">{beforeLabel}</th>
            <th className="px-3 py-2 text-right">{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const diff = r.b - r.a;
            const good = diff === 0 ? null : (diff > 0) === (r.better === "up");
            return (
              <tr key={r.label} className={i % 2 === 0 ? "bg-white/40" : "bg-white/20"}>
                <td className="px-3 py-2 text-[12px]">{r.label}</td>
                <td className="px-3 py-2 text-right font-mono text-[12px]">{r.fmt(r.a)}</td>
                <td
                  className={`px-3 py-2 text-right font-mono text-[12px] font-semibold ${
                    good === null ? "" : good ? "text-success" : "text-danger"
                  }`}
                >
                  {r.fmt(r.b)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
