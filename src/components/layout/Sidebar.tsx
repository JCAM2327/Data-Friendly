import { Link } from "@tanstack/react-router";
import { navItems } from "@/lib/navigation";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/50 glass-strong lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-white/70 font-mono text-sm font-semibold text-primary shadow-sm ring-1 ring-white/60">
          D
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">DataClean AI</p>
          <p className="text-[10px] font-medium text-muted-foreground">Data Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            activeProps={{ className: "bg-primary/12 text-primary ring-1 ring-primary/15" }}
            inactiveProps={{ className: "text-muted-foreground hover:bg-white/60" }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors"
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 pb-4 text-[10px] text-muted-foreground">
        Arquitectura modular · v0.1
      </div>
    </aside>
  );
}
