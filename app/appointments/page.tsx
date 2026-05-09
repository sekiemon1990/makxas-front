"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Download, List } from "lucide-react";

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

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetch("/api/appointments/list")
      .then((r) => r.json())
      .then((d: { appointments?: Appointment[] }) => setAppointments(d.appointments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleExport = () => {
    window.location.href = "/api/appointments/export";
  };

  // カレンダー用: その月の日付ごとにアポをグループ化
  const calendarData = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const appt of appointments) {
      const d = new Date(appt.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      (map[key] ??= []).push(appt);
    }
    return map;
  }, [appointments]);

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
        <div className="border-b border-zinc-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">アポ一覧</h1>
              <p className="mt-1 text-sm text-zinc-500">全 {appointments.length} 件</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-zinc-200 bg-white">
                <button
                  className={cn("flex h-8 w-8 items-center justify-center rounded-l-md text-zinc-500 hover:bg-zinc-50", view === "list" && "bg-zinc-950 text-white hover:bg-zinc-900")}
                  onClick={() => setView("list")}
                  type="button"
                >
                  <List className="size-4" />
                </button>
                <button
                  className={cn("flex h-8 w-8 items-center justify-center rounded-r-md border-l border-zinc-200 text-zinc-500 hover:bg-zinc-50", view === "calendar" && "bg-zinc-950 text-white hover:bg-zinc-900")}
                  onClick={() => setView("calendar")}
                  type="button"
                >
                  <Calendar className="size-4" />
                </button>
              </div>
              <Button onClick={handleExport} size="sm" variant="outline">
                <Download className="size-4" />
                CSV出力
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-zinc-500">読み込み中...</div>
          ) : appointments.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500">
              アポイントメントがまだありません。
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
                  {appointments.map((appt) => {
                    const isUnassigned = !appt.staff?.name;
                    return (
                    <tr
                      key={appt.id}
                      className={cn("transition-colors", appt.inquiry_id ? "cursor-pointer hover:bg-zinc-50" : "hover:bg-zinc-50")}
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
                            className="w-full truncate rounded bg-zinc-950 px-1.5 py-0.5 text-left text-[10px] font-medium text-white hover:bg-zinc-700 transition-colors"
                            title={`${appt.leads?.display_name ?? "顧客"} ${appt.item_category ?? ""}`}
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
