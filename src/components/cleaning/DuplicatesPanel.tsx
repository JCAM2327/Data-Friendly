import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/common/DataTable";
import { findDuplicates, removeRows } from "@/services/cleaning-service";
import { displayValue } from "@/services/profiling-service";
import { Note, type PanelProps } from "./shared";

export function DuplicatesPanel({ table, onPreview }: PanelProps) {
  const [mode, setMode] = useState<"completo" | "columnas">("completo");
  const [cols, setCols] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [kept, setKept] = useState(false);

  const keyCols = mode === "completo" ? [] : cols;
  const dups = useMemo(() => (mode === "columnas" && !cols.length ? [] : findDuplicates(table, keyCols)), [table, mode, cols]); // eslint-disable-line react-hooks/exhaustive-deps
  const method = mode === "completo" ? "Duplicados completos" : `Duplicados por: ${cols.join(", ")}`;

  const reviewRows = dups.slice(0, 50).map((i) => ({
    __i: i,
    ...Object.fromEntries(table.headers.slice(0, 6).map((h) => [h, displayValue(table.rows[i]![h])])),
  }));
  const reviewCols: Column<Record<string, unknown>>[] = [
    {
      key: "__sel",
      header: "",
      render: (r) => (
        <Checkbox
          checked={selected.includes(r["__i"] as number)}
          onCheckedChange={() =>
            setSelected((s) => (s.includes(r["__i"] as number) ? s.filter((x) => x !== r["__i"]) : [...s, r["__i"] as number]))
          }
          aria-label={`Seleccionar fila ${(r["__i"] as number) + 1}`}
        />
      ),
    },
    { key: "__i", header: "Fila", render: (r) => (r["__i"] as number) + 1 },
    ...table.headers.slice(0, 6).map((h) => ({ key: h, header: h })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["completo", "columnas"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => { setMode(m); setSelected([]); setKept(false); }}>
            {m === "completo" ? "Duplicados completos" : "Según columnas"}
          </Button>
        ))}
      </div>

      {mode === "columnas" ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl glass-inset p-3 ring-1 ring-white/50">
          {table.headers.map((h) => (
            <label key={h} className="flex items-center gap-2 text-[12px]">
              <Checkbox
                checked={cols.includes(h)}
                onCheckedChange={() => setCols((c) => (c.includes(h) ? c.filter((x) => x !== h) : [...c, h]))}
              />
              {h}
            </label>
          ))}
        </div>
      ) : null}

      <Note tone={dups.length ? "warning" : "info"}>
        {mode === "columnas" && !cols.length
          ? "Selecciona al menos una columna."
          : `Se encontraron ${dups.length} registros duplicados.`}
      </Note>

      {kept ? <Note>Se mantienen los duplicados. No se realizó ningún cambio.</Note> : null}

      {dups.length ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onPreview({ operation: "Eliminar duplicados", column: keyCols.join(", "), method, result: removeRows(table, dups, "fila(s) duplicadas") })}
          >
            Eliminar
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setKept(true); setReview(false); }}>
            Mantener
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setReview((r) => !r); setKept(false); }}>
            Revisar manualmente
          </Button>
        </div>
      ) : null}

      {review && dups.length ? (
        <div className="space-y-2">
          <DataTable columns={reviewCols} rows={reviewRows} />
          {dups.length > 50 ? <p className="text-[11px] text-muted-foreground">Mostrando 50 de {dups.length}.</p> : null}
          <Button
            size="sm"
            disabled={!selected.length}
            onClick={() =>
              onPreview({
                operation: "Eliminar duplicados (revisión manual)",
                column: keyCols.join(", "),
                method,
                result: removeRows(table, selected, "fila(s) duplicadas seleccionadas"),
              })
            }
          >
            Eliminar {selected.length} seleccionada(s)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
