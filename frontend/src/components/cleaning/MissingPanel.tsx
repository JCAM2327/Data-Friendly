import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatNumber, formatPct } from "@/lib/format";
import { applyMissing, missingLabels, recommendMissing, type MissingStrategy } from "@/services/cleaning-service";
import type { ColumnProfile } from "@/lib/types";
import { selectClass, type PanelProps } from "./shared";

function MissingRow({ p, props }: { p: ColumnProfile; props: PanelProps }) {
  const rec = recommendMissing(p, props.table.rows.length);
  const [strategy, setStrategy] = useState<MissingStrategy>(rec.strategy);
  const [custom, setCustom] = useState(rec.strategy === "personalizado" ? "Desconocido" : "");
  return (
    <li className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold">{p.name}</p>
        <StatusBadge tone={p.missingPct >= 20 ? "danger" : "warning"}>
          {formatNumber(p.nullCount ?? 0)} nulos · {formatPct(p.missingPct)}
        </StatusBadge>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Recomendado: <strong>{missingLabels[rec.strategy]}</strong> — {rec.reason}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className={`${selectClass} max-w-[220px]`} value={strategy} onChange={(e) => setStrategy(e.target.value as MissingStrategy)}>
          {(Object.keys(missingLabels) as MissingStrategy[]).map((s) => (
            <option key={s} value={s}>
              {missingLabels[s]}
              {s === rec.strategy ? " (recomendado)" : ""}
            </option>
          ))}
        </select>
        {strategy === "personalizado" ? (
          <input className={`${selectClass} max-w-[180px]`} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Valor" />
        ) : null}
        <Button
          size="sm"
          onClick={() =>
            props.onPreview({
              operation: "Tratar valores faltantes",
              column: p.name,
              method: missingLabels[strategy] + (strategy === "personalizado" ? `: "${custom}"` : ""),
              result: applyMissing(props.table, p.name, strategy, custom),
            })
          }
        >
          Vista previa
        </Button>
      </div>
    </li>
  );
}

export function MissingPanel(props: PanelProps) {
  const cols = props.profiles.filter((p) => (p.nullCount ?? 0) > 0);
  if (!cols.length) return <p className="text-[12px] text-muted-foreground">No hay valores faltantes.</p>;
  return (
    <ul className="space-y-2">
      {cols.map((p) => (
        <MissingRow key={p.name} p={p} props={props} />
      ))}
    </ul>
  );
}
