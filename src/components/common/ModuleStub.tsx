import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./GlassCard";

/** Módulo previsto en la arquitectura, aún sin implementar. */
export function ModuleStub({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-semibold tracking-tight">{title}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center justify-between gap-3 rounded-xl glass-inset p-3 ring-1 ring-white/50"
          >
            <span className="text-[13px]">{item}</span>
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Previsto
            </span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
