import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-foreground">
      <div className="app-backdrop fixed inset-0 -z-10" aria-hidden />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 space-y-4 px-4 pb-28 pt-4 sm:px-6 lg:pb-10">
            <div className="mx-auto w-full max-w-5xl space-y-4">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
