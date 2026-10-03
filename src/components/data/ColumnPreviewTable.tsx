import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatNumber, formatPct } from "@/lib/format";
import type { ColumnProfile, ColumnType } from "@/lib/types";

export const typeLabel: Record<ColumnType, string> = {
  numerica: "Numérica",
  categorica: "Categórica",
  fecha: "Fecha",
  texto: "Texto",
  booleana: "Booleana",
};

type Row = ColumnProfile & Record<string, unknown>;

const columns: Column<Row>[] = [
  { key: "name", header: "Columna", render: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "type", header: "Tipo detectado", render: (r) => <StatusBadge tone="info">{typeLabel[r.type]}</StatusBadge> },
  {
    key: "firstValues",
    header: "Primeros registros",
    render: (r) => (
      <span className="block max-w-[220px] truncate text-muted-foreground">
        {(r.firstValues ?? [r.sample]).join(" · ")}
      </span>
    ),
  },
  { key: "uniqueCount", header: "Únicos", align: "right", render: (r) => formatNumber(r.uniqueCount) },
  { key: "nullCount", header: "Nulos", align: "right", render: (r) => formatNumber(r.nullCount ?? 0) },
  {
    key: "missingPct",
    header: "% nulos",
    align: "right",
    render: (r) => (
      <span className={r.missingPct >= 20 ? "text-danger" : r.missingPct >= 5 ? "text-warning" : ""}>
        {formatPct(r.missingPct)}
      </span>
    ),
  },
];

export function ColumnPreviewTable({ profiles }: { profiles: ColumnProfile[] }) {
  return <DataTable columns={columns} rows={profiles as Row[]} />;
}
