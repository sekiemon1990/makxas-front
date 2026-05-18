"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BrainCircuit,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  Gauge,
  History as HistoryIcon,
  Inbox,
  ListChecks,
  Package,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { FloatingWidget } from "./ai/FloatingWidget";
import { WidgetPageContextProvider } from "@/contexts/WidgetPageContext";
import { cn } from "@/lib/utils";

const AI_HISTORY_STORAGE_KEY = "makxas-show-ai-history";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", mobileLabel: "ダッシュ", icon: Gauge },
  { href: "/inbox", label: "インボックス", mobileLabel: "受信", icon: Inbox, badge: "inbox" },
  { href: "/leads", label: "リード一覧", mobileLabel: "リード", icon: ListChecks },
  { href: "/items", label: "商品一覧", mobileLabel: "商品", icon: Package },
  { href: "/appointments", label: "アポ一覧", mobileLabel: "アポ", icon: CalendarDays },
  { href: "/shifts", label: "シフト管理", mobileLabel: "シフト", icon: Clock },
  { href: "/ai", label: "AIアシスタント", mobileLabel: "AI", icon: Bot },
  { href: "/settings", label: "設定", mobileLabel: "設定", icon: Settings },
  { href: "/admin", label: "管理", mobileLabel: "管理", icon: ShieldCheck, divider: true as const, exactMatch: true as const },
  { href: "/admin/ai", label: "AI学習・自動化", mobileLabel: "学習", icon: BrainCircuit, indent: true as const },
  { href: "/admin/ai-chats", label: "AI履歴管理", mobileLabel: "履歴", icon: HistoryIcon, indent: true as const, aiHistoryOnly: true as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [newCount, setNewCount] = useState(0);
  const [showAiHistory, setShowAiHistory] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setShowAiHistory(
        localStorage.getItem(AI_HISTORY_STORAGE_KEY) === "true",
      );
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleAiHistory() {
    setShowAiHistory((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AI_HISTORY_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

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

  const visibleNavItems = navItems.filter(
    (item) => !item.aiHistoryOnly || showAiHistory,
  );

  return (
    <WidgetPageContextProvider>
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
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              // 修正: /admin/ai と /admin/ai-chats が両方アクティブ判定される問題を解消。
              // 「区切り `/` 付きの startsWith」にすることで /admin/ai と /admin/ai-chats を分離する。
              const active = item.exactMatch
                ? pathname === item.href
                : pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href + "/"));
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

            {/* AI履歴管理 表示切り替えトグル */}
            <div className="mt-auto pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={toggleAiHistory}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                {showAiHistory ? (
                  <EyeOff className="size-3 shrink-0" />
                ) : (
                  <Eye className="size-3 shrink-0" />
                )}
                <span>
                  AI履歴管理を{showAiHistory ? "隠す" : "表示"}
                </span>
              </button>
            </div>
          </nav>
        </aside>

        {/* モバイルヘッダー */}
        <header className="flex h-12 items-center border-b border-zinc-200 bg-white px-4 md:hidden">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight"
          >
            makxas-front
          </Link>
        </header>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? (
            <div className="border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-center text-[11px] font-medium text-amber-900">
              ⚠️ デモモード（認証バイパス中） — Phase 1.5 実運用開始までの暫定。本番では必ず無効化してください。
            </div>
          ) : null}
          {children}
        </main>
        {pathname !== "/ai" && <FloatingWidget />}

        {/* モバイルボトムナビ */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-200 bg-white md:hidden">
          {visibleNavItems
            .filter((item) => !item.aiHistoryOnly)
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const count = item.badge === "inbox" ? newCount : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-medium text-zinc-500 transition-colors",
                    active && "text-zinc-950",
                  )}
                >
                  <Icon
                    className={cn("size-5", active && "text-zinc-950")}
                    aria-hidden="true"
                  />
                  {count > 0 ? (
                    <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                  {/* 常時短縮ラベル表示（モバイルでアイコンだけだと意味が分からない問題の解消） */}
                  <span className="block leading-tight">
                    {item.mobileLabel ?? item.label}
                  </span>
                </Link>
              );
            })}
        </nav>
      </div>
    </WidgetPageContextProvider>
  );
}
