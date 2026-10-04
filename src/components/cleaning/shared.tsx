import type { ReactNode } from "react";
import type { RawTable } from "@/services/file-parser";
import type { OpResult } from "@/services/cleaning-service";
import type { ColumnProfile } from "@/lib/types";

/** Transformación calculada pero aún no confirmada. */
export interface PendingOp {
  operation: string;
  column: string;
  method: string;
  result: OpResult;
}

export interface PanelProps {
  table: RawTable;
  profiles: ColumnProfile[];
  onPreview: (op: PendingOp) => void;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const selectClass =
  "block w-full rounded-md border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring";

export function ColumnSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.length === 0 ? <option value="">Sin columnas aplicables</option> : null}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <p
      className={`rounded-lg px-2.5 py-1.5 text-[12px] ring-1 ${
        tone === "warning" ? "bg-warning/10 text-warning ring-warning/20" : "bg-primary/8 text-muted-foreground ring-primary/12"
      }`}
    >
      {children}
    </p>
  );
}
