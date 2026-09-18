import { useDataset } from "@/state/dataset-store";
import { StatusBadge } from "@/components/common/StatusBadge";

export function Header() {
  const { dataset } = useDataset();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/50 glass-strong px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/70 font-mono text-sm font-semibold text-primary shadow-sm ring-1 ring-white/60 lg:hidden">
          D
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold tracking-tight">
            {dataset ? dataset.name : "Ningún dataset activo"}
          </p>
          <p className="truncate text-[10px] font-medium text-muted-foreground">
            {dataset ? dataset.source : "DataClean AI · Data Platform"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {dataset?.isDemo ? <StatusBadge tone="warning">Demo</StatusBadge> : null}
        <div className="grid size-9 place-items-center rounded-full bg-white/70 text-[11px] font-semibold text-muted-foreground shadow-sm ring-1 ring-white/60">
          RA
        </div>
      </div>
    </header>
  );
}
