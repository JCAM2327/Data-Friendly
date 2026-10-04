import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/common/DataTable";
import { formatNumber } from "@/lib/format";
import {
  applyCategoryMapping,
  applyOutliers,
  convertType,
  detectOutliers,
  outlierActionLabels,
  proposeCategoryGroups,
  typeTargetLabels,
  type OutlierAction,
  type OutlierMethod,
  type TypeTarget,
} from "@/services/cleaning-service";
import { displayValue } from "@/services/profiling-service";
import { ColumnSelect, Field, Note, selectClass, type PanelProps } from "./shared";

export function CategoriesPanel({ table, profiles, onPreview }: PanelProps) {
  const options = profiles.filter((p) => p.type === "categorica" || p.type === "texto").map((p) => p.name);
  const [col, setCol] = useState(options[0] ?? "");
  const current = options.includes(col) ? col : (options[0] ?? "");
  const groups = useMemo(() => (current ? proposeCategoryGroups(table, current) : []), [table, current]);
  const [canon, setCanon] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const mapping = () => {
    const m: Record<string, string> = {};
    groups.forEach((g, gi) => {
      const target = canon[gi] ?? g.canonical;
      for (const v of g.variants) if (!excluded[`${gi}:${v.value}`] && v.value !== target) m[v.value] = target;
    });
    return m;
  };

  return (
    <div className="space-y-3">
      <Field label="Columna categórica">
        <ColumnSelect value={current} onChange={(v) => { setCol(v); setCanon({}); setExcluded({}); }} options={options} />
      </Field>
      {groups.length === 0 ? (
        <Note>No se detectaron categorías equivalentes en esta columna.</Note>
      ) : (
        <>
          <Note tone="warning">Posibles categorías equivalentes detectadas. Revisa cada grupo: puedes cambiar el valor final o excluir variantes.</Note>
          <ul className="space-y-2">
            {groups.map((g, gi) => (
              <li key={gi} className="rounded-xl glass-inset p-3 ring-1 ring-white/50">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Unificar como">
                    <input
                      className={`${selectClass} max-w-[240px]`}
                      value={canon[gi] ?? g.canonical}
                      onChange={(e) => setCanon((c) => ({ ...c, [gi]: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                  {g.variants.map((v) => {
                    const k = `${gi}:${v.value}`;
                    return (
                      <label key={k} className="flex items-center gap-2 font-mono text-[12px]">
                        <Checkbox checked={!excluded[k]} onCheckedChange={() => setExcluded((e) => ({ ...e, [k]: !e[k] }))} />
                        "{v.value}" <span className="text-muted-foreground">×{v.count}</span>
                      </label>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            onClick={() => {
              const m = mapping();
              onPreview({
                operation: "Unificar categorías",
                column: current,
                method: `${Object.keys(m).length} variante(s) → ${new Set(Object.values(m)).size} valor(es)`,
                result: applyCategoryMapping(table, current, m),
              });
            }}
          >
            Vista previa
          </Button>
        </>
      )}
    </div>
  );
}

export function TypesPanel({ table, profiles, onPreview }: PanelProps) {
  const options = profiles.map((p) => p.name);
  const [col, setCol] = useState(options[0] ?? "");
  const [target, setTarget] = useState<TypeTarget>("numero");
  const current = options.includes(col) ? col : (options[0] ?? "");
  const type = profiles.find((p) => p.name === current)?.type;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Field label={`Columna${type ? ` (actual: ${type})` : ""}`}>
          <ColumnSelect value={current} onChange={setCol} options={options} />
        </Field>
        <Field label="Conversión">
          <select className={selectClass} value={target} onChange={(e) => setTarget(e.target.value as TypeTarget)}>
            {(Object.keys(typeTargetLabels) as TypeTarget[]).map((t) => (
              <option key={t} value={t}>
                {typeTargetLabels[t]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Note>Los valores que no puedan convertirse se dejan intactos y se avisa antes de confirmar.</Note>
      <Button
        size="sm"
        disabled={!current}
        onClick={() =>
          onPreview({ operation: "Convertir tipo", column: current, method: typeTargetLabels[target], result: convertType(table, current, target) })
        }
      >
        Vista previa
      </Button>
    </div>
  );
}

export function OutliersPanel({ table, profiles, onPreview }: PanelProps) {
  const options = profiles.filter((p) => p.type === "numerica").map((p) => p.name);
  const [col, setCol] = useState(options[0] ?? "");
  const [method, setMethod] = useState<OutlierMethod>("iqr");
  const [action, setAction] = useState<OutlierAction>("marcar");
  const current = options.includes(col) ? col : (options[0] ?? "");
  const det = useMemo(() => (current ? detectOutliers(table, current, method) : null), [table, current, method]);

  const rows = (det?.indices ?? []).slice(0, 30).map((i) => ({
    fila: i + 1,
    valor: displayValue(table.rows[i]![current]),
    ...Object.fromEntries(table.headers.filter((h) => h !== current).slice(0, 3).map((h) => [h, displayValue(table.rows[i]![h])])),
  }));
  const cols: Column<Record<string, unknown>>[] = rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, header: k })) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Field label="Columna numérica">
          <ColumnSelect value={current} onChange={setCol} options={options} />
        </Field>
        <Field label="Método">
          <select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as OutlierMethod)}>
            <option value="iqr">IQR (1,5 × rango intercuartílico)</option>
            <option value="zscore">Z-score (|z| &gt; 3)</option>
          </select>
        </Field>
      </div>
      {det ? (
        <Note tone={det.indices.length ? "warning" : "info"}>
          {det.indices.length} registro(s) fuera del rango [{formatNumber(det.lower)}, {formatNumber(det.upper)}]. Nunca se eliminan automáticamente.
        </Note>
      ) : null}
      {rows.length ? <DataTable columns={cols} rows={rows} /> : null}
      {det && det.indices.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Acción">
            <select className={`${selectClass} max-w-[260px]`} value={action} onChange={(e) => setAction(e.target.value as OutlierAction)}>
              {(Object.keys(outlierActionLabels) as OutlierAction[]).map((a) => (
                <option key={a} value={a}>
                  {outlierActionLabels[a]}
                </option>
              ))}
            </select>
          </Field>
          <Button
            size="sm"
            onClick={() =>
              onPreview({
                operation: "Tratar outliers",
                column: current,
                method: `${method === "iqr" ? "IQR" : "Z-score"} · ${outlierActionLabels[action]}`,
                result: applyOutliers(table, current, det, action),
              })
            }
          >
            Vista previa
          </Button>
        </div>
      ) : null}
    </div>
  );
}
