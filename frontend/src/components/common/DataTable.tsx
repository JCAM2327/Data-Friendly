import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyLabel = "Sin registros",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-white/50">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="glass-inset">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="bg-white/40 px-3 py-6 text-center text-[12px] text-muted-foreground"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white/40" : "bg-white/20"}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2.5 font-mono text-[11px] ${
                      c.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
