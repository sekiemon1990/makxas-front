"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Gauge,
  Inbox,
  ListChecks,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: Gauge },
  { href: "/inbox", label: "インボックス", icon: Inbox },
  { href: "/leads", label: "リード一覧", icon: ListChecks },
  { href: "/appointments", label: "アポ一覧", icon: CalendarDays },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 md:flex-row">
      {/* デスクトップサイドバー */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <Link
          href="/dashboard"
          className="flex h-16 items-center border-b border-zinc-200 px-5"
        >
          <span className="text-base font-semibold tracking-tight">
            makxas-front
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950",
                  active &&
                    "bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white",
                )}
                title={item.label}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-4 text-xs leading-5 text-zinc-500">
          静的UIプロトタイプ
        </div>
      </aside>

      {/* モバイルヘッダー */}
      <header className="flex h-12 items-center border-b border-zinc-200 bg-white px-4 md:hidden">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          makxas-front
        </Link>
      </header>

      <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>

      {/* モバイルボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-200 bg-white md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-zinc-500 transition-colors",
                active && "text-zinc-950",
              )}
            >
              <Icon className={cn("size-5", active && "text-zinc-950")} aria-hidden="true" />
              <span className="hidden xs:block">{item.label.replace("一覧", "")}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
