import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-6 text-center ring-1 ring-white/60 sm:p-10">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="mt-3 text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
