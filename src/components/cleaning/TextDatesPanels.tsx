import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { analyzeDates, applyText, convertDates, textOpLabels, type TextOp } from "@/services/cleaning-service";
import { ColumnSelect, Field, Note, selectClass, type PanelProps } from "./shared";

export function TextPanel({ table, profiles, onPreview }: PanelProps) {
  const options = profiles.filter((p) => p.type === "texto" || p.type === "categorica").map((p) => p.name);
  const [col, setCol] = useState(options[0] ?? "");
  const [ops, setOps] = useState<TextOp[]>(["trim", "collapse"]);
  const toggle = (o: TextOp) =>
    setOps((s) => {
      if (s.includes(o)) return s.filter((x) => x !== o);
      const exclusive: TextOp[] = ["lower", "upper", "capitalize"];
      return [...s.filter((x) => !(exclusive.includes(o) && exclusive.includes(x))), o];
    });
  const current = options.includes(col) ? col : (options[0] ?? "");

  return (
    <div className="space-y-3">
      <Field label="Columna de texto">
        <ColumnSelect value={current} onChange={setCol} options={options} />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(textOpLabels) as TextOp[]).map((o) => (
          <label key={o} className="flex items-center gap-2 rounded-lg glass-inset px-3 py-2 text-[12px] ring-1 ring-white/50">
            <Checkbox checked={ops.includes(o)} onCheckedChange={() => toggle(o)} />
            {textOpLabels[o]}
          </label>
        ))}
      </div>
      <Button
        size="sm"
        disabled={!current || !ops.length}
        onClick={() =>
          onPreview({
            operation: "Estandarizar texto",
            column: current,
            method: ops.map((o) => textOpLabels[o]).join(" + "),
            result: applyText(table, current, ops),
          })
        }
      >
        Vista previa
      </Button>
    </div>
  );
}

export function DatesPanel({ table, profiles, onPreview }: PanelProps) {
  const options = profiles.filter((p) => p.type !== "numerica" && p.type !== "booleana").map((p) => p.name);
  const preferred = profiles.find((p) => p.type === "fecha")?.name;
  const [col, setCol] = useState(preferred ?? options[0] ?? "");
  const [order, setOrder] = useState<"dmy" | "mdy">("dmy");
  const [includeAmb, setIncludeAmb] = useState(false);
  const current = options.includes(col) ? col : (options[0] ?? "");
  const analysis = useMemo(() => (current ? analyzeDates(table, current) : null), [table, current]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Field label="Columna">
          <ColumnSelect value={current} onChange={setCol} options={options} />
        </Field>
        <Field label="Orden de las fechas con barra (d/m/a)">
          <select className={selectClass} value={order} onChange={(e) => setOrder(e.target.value as "dmy" | "mdy")}>
            <option value="dmy">Día / Mes / Año</option>
            <option value="mdy">Mes / Día / Año</option>
          </select>
        </Field>
      </div>
      {analysis ? (
        <div className="flex flex-wrap gap-2">
          {analysis.formats.length === 0 ? <StatusBadge>Sin fechas detectadas</StatusBadge> : null}
          {analysis.formats.map((f) => (
            <StatusBadge key={f.label} tone={f.label.includes("ambiguo") ? "warning" : "info"}>
              {f.label}: {f.count}
            </StatusBadge>
          ))}
          {analysis.unparseable ? <StatusBadge tone="danger">No reconocidas: {analysis.unparseable}</StatusBadge> : null}
        </div>
      ) : null}
      {analysis && analysis.ambiguous > 0 ? (
        <>
          <Note tone="warning">
            {analysis.ambiguous} fecha(s) son ambiguas (por ejemplo 03/04/2024 puede ser 3 de abril o 4 de marzo). Por defecto no se modifican.
          </Note>
          <label className="flex items-center gap-2 text-[12px]">
            <Checkbox checked={includeAmb} onCheckedChange={(v) => setIncludeAmb(v === true)} />
            Convertir también las ambiguas asumiendo el orden {order === "dmy" ? "Día/Mes" : "Mes/Día"}
          </label>
        </>
      ) : null}
      <Button
        size="sm"
        disabled={!current}
        onClick={() =>
          onPreview({
            operation: "Estandarizar fechas",
            column: current,
            method: `YYYY-MM-DD · orden ${order === "dmy" ? "D/M/A" : "M/D/A"}${includeAmb ? " · incluye ambiguas" : ""}`,
            result: convertDates(table, current, order, includeAmb),
          })
        }
      >
        Vista previa
      </Button>
    </div>
  );
}
