"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Download, List, SlidersHorizontal, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  inquiry_id: string;
  scheduled_at: string;
  item_category: string | null;
  item_description: string | null;
  address: string | null;
  preferred_method: "visit" | "delivery" | null;
  status: string;
  reminder_sent_at: string | null;
  created_at: string;
  leads: { display_name: string | null; phone: string | null; email: string | null } | null;
  staff: { name: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "確定",
  cancelled: "キャンセル",
  completed: "完了",
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-zinc-100 text-zinc-700",
};

const STATUS_ALL = ["confirmed", "cancelled", "completed"] as const;
type StatusKey = typeof STATUS_ALL[number];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // フィルター状態
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "visit" | "delivery">("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [monthOnly, setMonthOnly] = useState(false); // カレンダー表示月と連動するか

  useEffect(() => {
    fetch("/api/appointments/list")
      .then((r) => r.json())
      .then((d: { appointments?: Appointment[] }) => setAppointments(d.appointments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // スタッフ一覧（フィルター用）
  const staffOptions = useMemo(() => {
    const names = new Set<string>();
    for (const a of appointments) {
      if (a.staff?.name) names.add(a.staff.name);
    }
    return [...names].sort();
  }, [appointments]);

  const activeFilterCount = [
    statusFilter !== "all",
    methodFilter !== "all",
    staffFilter !== "all",
    monthOnly,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter("all");
    setMethodFilter("all");
    setStaffFilter("all");
    setMonthOnly(false);
  };

  // フィルター適用
  const filteredAppointments = useMemo(() => {
    let result = appointments;

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (methodFilter !== "all") {
      result = result.filter((a) => a.preferred_method === methodFilter);
    }
    if (staffFilter !== "all") {
      result = result.filter((a) => a.staff?.name === staffFilter);
    }
    if (monthOnly) {
      const y = calMonth.getFullYear();
      const m = calMonth.getMonth();
      result = result.filter((a) => {
        const d = new Date(a.scheduled_at);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    }

    return result;
  }, [appointments, statusFilter, methodFilter, staffFilter, monthOnly, calMonth]);

  const handleExport = () => {
    window.location.href = "/api/appointments/export";
  };

  // カレンダー用: その月の日付ごとにアポをグループ化（フィルター適用後）
  const calendarData = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const appt of filteredAppointments) {
      const d = new Date(appt.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      (map[key] ??= []).push(appt);
    }
    return map;
  }, [filteredAppointments]);

  const calDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calMonth]);

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  const fmt = (v: string) =>
    new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(v));

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        {/* ヘッダー */}
        <div className="border-b border-zinc-200 px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">アポ一覧</h1>
              <p className="mt-1 text-sm text-zinc-500">
                全 {appointments.length} 件
                {filteredAppointments.length !== appointments.length ? ` / 表示中 ${filteredAppointments.length} 件` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* リスト/カレンダー切替 */}
              <div className="flex rounded-md border border-zinc-200 bg-white">
                <button
                  className={cn("flex h-8 w-8 items-center justify-center rounded-l-md text-zinc-500 hover:bg-zinc-50", view === "list" && "bg-zinc-950 text-white hover:bg-zinc-900")}
                  onClick={() => setView("list")}
                  type="button"
                  title="リスト表示"
                >
                  <List className="size-4" />
                </button>
                <button
                  className={cn("flex h-8 w-8 items-center justify-center rounded-r-md border-l border-zinc-200 text-zinc-500 hover:bg-zinc-50", view === "calendar" && "bg-zinc-950 text-white hover:bg-zinc-900")}
                  onClick={() => setView("calendar")}
                  type="button"
                  title="カレンダー表示"
                >
                  <Calendar className="size-4" />
                </button>
              </div>

              {/* 絞り込みボタン */}
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
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
                  className="flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-500 hover:bg-zinc-50"
                >
                  <X className="size-3.5" />
                  リセット
                </button>
              )}

              <Button onClick={handleExport} size="sm" variant="outline">
                <Download className="size-4" />
                CSV出力
              </Button>
            </div>
          </div>

          {/* フィルターパネル */}
          {showFilters && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap gap-6">
                {/* ステータス */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-zinc-500">ステータス</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        statusFilter === "all"
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      全て
                    </button>
                    {STATUS_ALL.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          statusFilter === s
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : `${STATUS_COLOR[s]} border`,
                        )}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 方法 */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-zinc-500">方法</p>
                  <div className="flex gap-1.5">
                    {(["all", "visit", "delivery"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setMethodFilter(v)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          methodFilter === v
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                        )}
                      >
                        {v === "all" ? "全て" : v === "visit" ? "訪問" : "宅配"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 担当者 */}
                {staffOptions.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-zinc-500">担当者</p>
                    <select
                      value={staffFilter}
                      onChange={(e) => setStaffFilter(e.target.value)}
                      className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    >
                      <option value="all">全員</option>
                      {staffOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 期間（カレンダー月と連動） */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-zinc-500">表示期間</p>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={monthOnly}
                      onChange={(e) => setMonthOnly(e.target.checked)}
                      className="rounded"
                    />
                    {calMonth.getFullYear()}年{calMonth.getMonth() + 1}月のみ
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-zinc-500">読み込み中...</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500">
              {activeFilterCount > 0 ? "条件に一致するアポイントメントがありません。" : "アポイントメントがまだありません。"}
            </div>
          ) : view === "list" ? (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">日時</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">顧客名</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">電話番号</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">品目</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">方法</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">担当者</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">前日通知</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredAppointments.map((appt) => {
                    const isUnassigned = !appt.staff?.name;
                    return (
                    <tr
                      key={appt.id}
                      className="cursor-pointer transition-colors hover:bg-zinc-50"
                      onClick={() => { if (appt.inquiry_id) window.location.href = `/inbox?id=${appt.inquiry_id}`; }}
                    >
                      <td className="px-4 py-3 font-medium">{fmt(appt.scheduled_at)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{appt.leads?.display_name ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{appt.leads?.phone ?? "—"}</td>
                      <td className="px-4 py-3">{appt.item_category ?? "—"}</td>
                      <td className="px-4 py-3">{appt.preferred_method === "delivery" ? "宅配" : "訪問"}</td>
                      <td className="px-4 py-3">
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            ⚠ 未割当
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-700">{appt.staff!.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLOR[appt.status] ?? "bg-zinc-100 text-zinc-700")}>
                          {STATUS_LABEL[appt.status] ?? appt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {appt.reminder_sent_at ? (
                          <Badge variant="outline" className="rounded-md text-xs text-green-700 border-green-200">送信済</Badge>
                        ) : (
                          <span className="text-xs text-zinc-400">未送信</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white">
              {/* カレンダーヘッダー */}
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-100"
                  onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  type="button"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm font-semibold">
                  {calMonth.getFullYear()}年{calMonth.getMonth() + 1}月
                </span>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-100"
                  onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  type="button"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 border-b border-zinc-200">
                {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-xs font-medium text-zinc-500">{d}</div>
                ))}
              </div>
              {/* 日付グリッド */}
              <div className="grid grid-cols-7">
                {calDays.map((day, i) => {
                  if (!day) return <div key={i} className="min-h-[88px] border-b border-r border-zinc-100 bg-zinc-50/60 last:border-r-0" />;
                  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  const dayAppts = calendarData[key] ?? [];
                  const isToday = key === todayStr;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "min-h-[88px] border-b border-r border-zinc-100 p-1.5 last:border-r-0",
                        isToday && "bg-blue-50",
                      )}
                    >
                      <p className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium", isToday ? "bg-blue-600 text-white" : "text-zinc-700")}>
                        {day.getDate()}
                      </p>
                      <div className="space-y-0.5">
                        {dayAppts.map((appt) => (
                          <button
                            key={appt.id}
                            type="button"
                            className={cn(
                              "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-colors",
                              appt.status === "cancelled"
                                ? "bg-red-200 text-red-900 hover:bg-red-300"
                                : appt.status === "completed"
                                  ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                                  : "bg-zinc-950 text-white hover:bg-zinc-700",
                            )}
                            title={`${appt.leads?.display_name ?? "顧客"} ${appt.item_category ?? ""}${appt.staff?.name ? ` / ${appt.staff.name}` : ""}`}
                            onClick={() => { if (appt.inquiry_id) window.location.href = `/inbox?id=${appt.inquiry_id}`; }}
                          >
                            {new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(appt.scheduled_at))} {appt.leads?.display_name ?? "—"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
