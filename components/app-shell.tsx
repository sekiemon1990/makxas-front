"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BrainCircuit,
  CalendarDays,
  Clock,
  Gauge,
  Inbox,
  ListChecks,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { FloatingWidget } from "./ai/FloatingWidget";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: Gauge },
  { href: "/inbox", label: "インボックス", icon: Inbox, badge: "inbox" },
  { href: "/leads", label: "リード一覧", icon: ListChecks },
  { href: "/appointments", label: "アポ一覧", icon: CalendarDays },
  { href: "/shifts", label: "シフト管理", icon: Clock },
  { href: "/ai", label: "AIアシスタント", icon: Bot },
  { href: "/settings", label: "設定", icon: Settings },
  { href: "/admin", label: "管理", icon: ShieldCheck, divider: true as const, exactMatch: true as const },
  { href: "/admin/ai", label: "AI学習・自動化", icon: BrainCircuit, indent: true as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      fetch("/api/inquiries/new-count")
        .then((r) => r.json())
        .then((d: { count?: number }) => setNewCount(d.count ?? 0))
        .catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-950 md:flex-row">
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
            const active = item.exactMatch
              ? pathname === item.href
              : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const count = item.badge === "inbox" ? newCount : 0;

            return (
              <div key={item.href}>
                {item.divider && (
                  <div className="my-2 border-t border-zinc-100" />
                )}
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950",
                    item.indent && "pl-6 text-[13px]",
                    active &&
                      "bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white",
                  )}
                  title={item.label}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-red-500 text-white",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* モバイルヘッダー */}
      <header className="flex h-12 items-center border-b border-zinc-200 bg-white px-4 md:hidden">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          makxas-front
        </Link>
      </header>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">{children}</main>
      <FloatingWidget />

      {/* モバイルボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-200 bg-white md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const count = item.badge === "inbox" ? newCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-zinc-500 transition-colors",
                active && "text-zinc-950",
              )}
            >
              <Icon className={cn("size-5", active && "text-zinc-950")} aria-hidden="true" />
              {count > 0 ? (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
              <span className="hidden xs:block">{item.label.replace("一覧", "")}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
