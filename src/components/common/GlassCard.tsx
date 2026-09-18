import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("glass rounded-2xl p-4 ring-1 ring-white/60 sm:p-5", className)}
    >
      {children}
    </section>
  );
}

export function CardHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
        {meta ? <p className="mt-0.5 text-[11px] text-muted-foreground">{meta}</p> : null}
      </div>
      {action}
    </div>
  );
}
