"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Search, SlidersHorizontal, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChannelBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/design-tokens";
import { channelMeta } from "@/lib/inquiry-options";
import { ErrorState } from "@/components/ErrorState";
import type { InquiryChannel } from "@/types/database";

type LeadRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  line_user_id: string | null;
  first_channel: string | null;
  created_at: string;
};

type InquirySummary = {
  lead_id: string;
  channel: string;
  created_at: string;
};

type AppointmentSummary = {
  lead_id: string;
};

type SortKey = "created_at" | "last_contact" | "inquiry_count";

const CHANNEL_FILTERS: InquiryChannel[] = [
  "line",
  "web_form",
  "email",
  "oikura",
  "uridoki",
  "hikakaku",
  "phone",
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_at", label: "登録日（新しい順）" },
  { value: "last_contact", label: "最終接触（新しい順）" },
  { value: "inquiry_count", label: "反響数（多い順）" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<InquiryChannel | "all">("all");
  const [apptFilter, setApptFilter] = useState<"all" | "yes" | "no">("all");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [showFilters, setShowFilters] = useState(false);
  // UI/UXレビュー D2: エラー状態を可視化
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Date.now() はマウント時に一度だけ評価（最終接触の経過日数計算用）
  // eslint-disable-next-line react-hooks/purity
  const nowMs = useMemo(() => Date.now(), []);

  useEffect(() => {
    setError(null);
    setLoading(true);
    fetch("/api/leads/list")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { leads?: LeadRow[]; inquiries?: InquirySummary[]; appointments?: AppointmentSummary[] }) => {
        setLeads(d.leads ?? []);
        setInquiries(d.inquiries ?? []);
        setAppointments(d.appointments ?? []);
      })
      .catch((e: Error) => {
        setError(e.message ?? "通信エラー");
      })
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const countMap = useMemo(() => {
    const map = new Map<string, { total: number; channels: string[]; lastContact: string | null }>();
    for (const inq of inquiries) {
      if (!inq.lead_id) continue;
      const existing = map.get(inq.lead_id) ?? { total: 0, channels: [], lastContact: null };
      const last = existing.lastContact && existing.lastContact > inq.created_at ? existing.lastContact : inq.created_at;
      map.set(inq.lead_id, {
        total: existing.total + 1,
        channels: [...new Set([...existing.channels, inq.channel])],
        lastContact: last,
      });
    }
    return map;
  }, [inquiries]);

  const apptMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      map.set(a.lead_id, (map.get(a.lead_id) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const filteredLeads = useMemo(() => {
    let result = leads;

    // テキスト検索
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.display_name ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").includes(q) ||
          (l.email ?? "").toLowerCase().includes(q),
      );
    }

    // チャネルフィルター（そのリードの反響チャネルに含まれるか）
    if (channelFilter !== "all") {
      result = result.filter((l) => {
        const info = countMap.get(l.id);
        return info?.channels.includes(channelFilter) ?? false;
      });
    }

    // アポ有無フィルター
    if (apptFilter === "yes") {
      result = result.filter((l) => (apptMap.get(l.id) ?? 0) > 0);
    } else if (apptFilter === "no") {
      result = result.filter((l) => (apptMap.get(l.id) ?? 0) === 0);
    }

    // ソート
    result = [...result].sort((a, b) => {
      if (sortBy === "created_at") {
        return b.created_at.localeCompare(a.created_at);
      }
      if (sortBy === "last_contact") {
        const ac = countMap.get(a.id)?.lastContact ?? a.created_at;
        const bc = countMap.get(b.id)?.lastContact ?? b.created_at;
        return bc.localeCompare(ac);
      }
      if (sortBy === "inquiry_count") {
        return (countMap.get(b.id)?.total ?? 0) - (countMap.get(a.id)?.total ?? 0);
      }
      return 0;
    });

    return result;
  }, [leads, search, channelFilter, apptFilter, sortBy, countMap, apptMap]);

  const activeFilterCount = [
    channelFilter !== "all",
    apptFilter !== "all",
    sortBy !== "created_at",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setChannelFilter("all");
    setApptFilter("all");
    setSortBy("created_at");
    setSearch("");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ヘッダー */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">リード一覧</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {/* UI/UXレビュー C1: formatCount で表記統一（数字+半角スペース+件、千区切り対応） */}
              全 {formatCount(leads.length)}{filteredLeads.length !== leads.length ? ` / 表示中 ${formatCount(filteredLeads.length)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* テキスト検索 */}
            <div className="relative w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="氏名・電話・メールで検索"
                type="search"
                value={search}
              />
            </div>
            {/* フィルタートグル */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                showFilters
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              <SlidersHorizontal className="size-4" />
              絞り込み
              {activeFilterCount > 0 && (
                <span className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  showFilters ? "bg-white/20 text-white" : "bg-zinc-900 text-white",
                )}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-500 hover:bg-zinc-50"
              >
                <X className="size-3.5" />
                リセット
              </button>
            )}
          </div>
        </div>

        {/* フィルターパネル */}
        {showFilters && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap gap-6">
              {/* チャネルフィルター */}
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500">チャネル</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setChannelFilter("all")}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      channelFilter === "all"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    全て
                  </button>
                  {CHANNEL_FILTERS.map((ch) => {
                    const meta = channelMeta[ch];
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setChannelFilter(ch === channelFilter ? "all" : ch)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          channelFilter === ch
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : `${meta.className} border`,
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* アポ有無 */}
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500">アポ</p>
                <div className="flex gap-1.5">
                  {(["all", "yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setApptFilter(v)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        apptFilter === v
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      {v === "all" ? "全て" : v === "yes" ? "あり" : "なし"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ソート */}
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-500">並び順</p>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* UI/UXレビュー D2: エラー時は専用UIを表示 */}
        {error && !loading ? (
          <div className="mt-6">
            <ErrorState
              message="リード一覧の読み込みに失敗しました"
              detail={error}
              onRetry={() => setReloadKey((k) => k + 1)}
              retrying={loading}
            />
          </div>
        ) : null}

        {/* テーブル */}
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {loading ? (
            // UI/UXレビュー D1: スピナーをスケルトンUIに置き換え
            <table className="w-full text-sm" aria-label="読み込み中">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  <th className="px-4 py-3 font-medium text-zinc-500">顧客名</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">電話番号</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">メール</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">チャネル</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">反響</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">アポ</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">最終接触</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">登録日</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    <td className="px-4 py-3"><div className="h-3 w-24 animate-pulse rounded bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-28 animate-pulse rounded bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-36 animate-pulse rounded bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-5 animate-pulse rounded-full bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-6 animate-pulse rounded bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-6 animate-pulse rounded bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-12 animate-pulse rounded bg-zinc-100" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 animate-pulse rounded bg-zinc-100" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  <th className="px-4 py-3 font-medium text-zinc-500">顧客名</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">電話番号</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">メール</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">チャネル</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-center">反響</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-center">アポ</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">最終接触</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLeads.map((lead) => {
                  const info = countMap.get(lead.id);
                  const apptCount = apptMap.get(lead.id) ?? 0;
                  const lastContact = info?.lastContact ?? null;
                  const daysSince = lastContact
                    ? Math.floor((nowMs - new Date(lastContact).getTime()) / 86400000)
                    : null;
                  const isStale = daysSince !== null && daysSince >= 7;

                  return (
                    // UI/UXレビュー C3: 行全体をクリック可能に
                    <tr
                      key={lead.id}
                      className="hover:bg-zinc-50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Linkや他のクリック可能要素を踏んだ場合は親で再ナビゲートしない
                        const target = e.target as HTMLElement;
                        if (target.closest("a, button")) return;
                        window.location.href = `/leads/${lead.id}`;
                      }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {lead.display_name ?? lead.email ?? lead.phone ?? "名前未登録"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{lead.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 max-w-[180px] truncate">{lead.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(info?.channels ?? []).map((ch) => (
                            <ChannelBadge
                              key={ch}
                              channel={ch as Parameters<typeof ChannelBadge>[0]["channel"]}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-100 px-2 text-xs font-medium text-zinc-700">
                          {info?.total ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {apptCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CalendarCheck className="size-3" />
                            {apptCount}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lastContact ? (
                          // UI/UXレビュー C10: 相対時刻 + 絶対日付を併記して表記統一
                          <span
                            className={cn("text-xs", isStale ? "font-medium text-orange-500" : "text-zinc-500")}
                            title={formatDate(lastContact)}
                          >
                            {daysSince === null
                              ? formatDate(lastContact)
                              : daysSince === 0
                                ? "今日"
                                : daysSince === 1
                                  ? "昨日"
                                  : daysSince < 30
                                    ? `${daysSince}日前`
                                    : formatDate(lastContact)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(lead.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              {search || activeFilterCount > 0
                ? "条件に一致するリードがいません。"
                : "リードがまだいません。"}
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
