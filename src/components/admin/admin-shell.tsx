"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, ListChecks, ScanLine, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand";
import { LogoutButton } from "@/components/admin/logout-button";
import { adminNavItems, sectionTitle, type AdminNavItem } from "@/features/organizer/nav";

const ICONS: Record<AdminNavItem["key"], LucideIcon> = { talleres: ListChecks, scan: ScanLine, panel: LayoutDashboard };

function TabBar() {
  const pathname = usePathname();
  const eventParam = useSearchParams().get("event");
  const items = adminNavItems(pathname, eventParam);
  return (
    <nav
      aria-label="Navegación del organizador"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-16 max-w-3xl grid-cols-3">
        {items.map((it) => {
          const Icon = ICONS[it.key];
          return (
            <li key={it.key} className="contents">
              <Link
                href={it.href}
                aria-current={it.active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-mango ${it.active ? "text-ink" : "text-muted-foreground"}`}
              >
                <span className={`flex h-7 w-14 items-center justify-center rounded-full ${it.active ? "bg-mango" : ""}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/admin/talleres" aria-label="PaseListo, ir a Mis talleres" className="rounded-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-mango">
            <Logo />
          </Link>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-bold">{sectionTitle(pathname)}</span>
          <LogoutButton />
        </div>
      </header>
      {/* Bottom padding keeps the last element clear of the 64px fixed tab bar + safe area. */}
      <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
    </div>
  );
}
