import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTone = "neutral" | "success" | "warning" | "danger";

const toneClass: Record<MetricTone, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: MetricTone;
  icon?: LucideIcon;
}) {
  return (
    <div className="glass-inset rounded-xl p-3 ring-1 ring-white/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden /> : null}
      </div>
      <p className={cn("font-mono text-base font-semibold sm:text-lg", toneClass[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
