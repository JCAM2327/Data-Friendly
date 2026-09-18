import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navItems } from "@/lib/navigation";

const primary = navItems.slice(0, 4);

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/50 glass-strong lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {primary.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1 py-2.5"
          >
            <item.icon className="size-4" aria-hidden />
            <span className="text-[10px] font-medium">{item.short}</span>
          </Link>
        ))}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="flex flex-col items-center gap-1 py-2.5 text-muted-foreground">
            <MoreHorizontal className="size-4" aria-hidden />
            <span className="text-[10px] font-medium">Más</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="glass-strong rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Navegación</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 p-4 pt-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  activeOptions={{ exact: item.to === "/" }}
                  activeProps={{ className: "bg-primary/12 text-primary" }}
                  className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2.5 text-[13px] font-medium ring-1 ring-white/50"
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
