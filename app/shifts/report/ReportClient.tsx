"use client";

import { useRouter } from "next/navigation";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Shift, Staff } from "@/types/database";

type ShiftWithStaff = Shift & { staff?: Pick<Staff, "id" | "name"> | null };

function workHours(s: Shift) {
  const [sh = 0, sm = 0] = s.start_time.split(":").map(Number);
  const [eh = 0, em = 0] = s.end_time.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm) - s.break_minutes;
  return Math.max(0, mins) / 60;
}

function formatH(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm}m` : `${hh}h`;
}

type StaffSummary = {
  staffId: string;
  name: string;
  days: number;
  totalHours: number;
  avgHours: number;
  shifts: ShiftWithStaff[];
};

type Props = {
  month: string; // "YYYY-MM"
  shifts: ShiftWithStaff[];
  staff: Staff[];
};

export function ReportClient({ month, shifts, staff }: Props) {
  const router = useRouter();
  const [year, mon] = month.split("-").map(Number);

  const prevMonth = () => {
    const d = new Date(year!, (mon! - 1) - 1, 1);
    router.push(`/shifts/report?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(year!, (mon! - 1) + 1, 1);
    router.push(`/shifts/report?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // スタッフ別集計
  const summaryMap: Record<string, StaffSummary> = {};
  for (const s of staff) {
    summaryMap[s.id] = { staffId: s.id, name: s.name, days: 0, totalHours: 0, avgHours: 0, shifts: [] };
  }
  for (const s of shifts) {
    if (!summaryMap[s.staff_id]) {
      summaryMap[s.staff_id] = { staffId: s.staff_id, name: s.staff?.name ?? "不明", days: 0, totalHours: 0, avgHours: 0, shifts: [] };
    }
    const h = workHours(s);
    summaryMap[s.staff_id]!.days++;
    summaryMap[s.staff_id]!.totalHours += h;
    summaryMap[s.staff_id]!.shifts.push(s);
  }

  const summaries = Object.values(summaryMap)
    .map((s) => ({ ...s, avgHours: s.days > 0 ? s.totalHours / s.days : 0 }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const totalHours = summaries.reduce((acc, s) => acc + s.totalHours, 0);
  const totalDays = summaries.reduce((acc, s) => acc + s.days, 0);

  const downloadCsv = () => {
    const rows = [
      ["スタッフ名", "稼働日数", "総稼働時間（h）", "平均稼働時間/日（h）"],
      ...summaries.map((s) => [
        s.name,
        String(s.days),
        s.totalHours.toFixed(2),
        s.avgHours.toFixed(2),
      ]),
      ["合計", String(totalDays), totalHours.toFixed(2), ""],
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthLabel = `${year}年${mon}月`;

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* ヘッダー */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Shift Report</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">月次稼働レポート</h1>
          </div>
          <Button variant="outline" size="sm" onClick={downloadCsv} className="flex items-center gap-2">
            <Download className="size-4" />
            CSVダウンロード
          </Button>
        </div>

        {/* 月ナビゲーション */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="size-4" /></Button>
          <span className="min-w-28 text-center text-sm font-medium">{monthLabel}</span>
          <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
        </div>

        {/* 月次サマリー */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
            <CardHeader className="pb-1">
              <CardDescription>総稼働時間</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatH(totalHours)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
            <CardHeader className="pb-1">
              <CardDescription>延べ出勤日数</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totalDays}<span className="text-lg font-normal text-zinc-500 ml-1">日</span></p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
            <CardHeader className="pb-1">
              <CardDescription>稼働スタッフ数</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{summaries.filter((s) => s.days > 0).length}<span className="text-lg font-normal text-zinc-500 ml-1">名</span></p>
            </CardContent>
          </Card>
        </div>

        {/* スタッフ別テーブル */}
        <Card className="rounded-xl border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>スタッフ別稼働集計</CardTitle>
            <CardDescription>{monthLabel}の稼働実績</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-3 pl-6 text-left text-xs font-semibold text-zinc-500">スタッフ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">稼働日数</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">総稼働時間</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">平均 / 日</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">割合</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const pct = totalHours > 0 ? Math.round((s.totalHours / totalHours) * 100) : 0;
                    return (
                      <tr key={s.staffId} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                        <td className="py-3 pl-6 font-medium text-zinc-900">{s.name}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">
                          {s.days > 0 ? `${s.days}日` : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          {s.totalHours > 0 ? formatH(s.totalHours) : <span className="text-zinc-300 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600">
                          {s.avgHours > 0 ? formatH(s.avgHours) : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-6 py-3">
                          {s.totalHours > 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-zinc-500">{pct}%</span>
                              <div className="h-1.5 w-20 rounded-full bg-zinc-100">
                                <div className="h-1.5 rounded-full bg-zinc-800" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-zinc-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50">
                    <td className="py-3 pl-6 text-xs font-semibold text-zinc-500">合計</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-zinc-700">{totalDays}日</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-zinc-700">{formatH(totalHours)}</td>
                    <td className="px-4 py-3 text-right text-xs text-zinc-400">—</td>
                    <td className="px-6 py-3 text-right text-xs font-semibold text-zinc-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* シフト詳細（展開リスト） */}
        {summaries.filter((s) => s.shifts.length > 0).map((s) => (
          <Card key={s.staffId} className="mt-4 rounded-xl border-zinc-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{s.name} — シフト詳細</CardTitle>
              <CardDescription>{s.days}日出勤 / {formatH(s.totalHours)}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="py-2 pl-6 text-left font-semibold text-zinc-400">日付</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-400">開始</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-400">終了</th>
                      <th className="px-4 py-2 text-center font-semibold text-zinc-400">休憩</th>
                      <th className="px-4 py-2 text-right font-semibold text-zinc-400">稼働</th>
                      <th className="px-6 py-2 text-left font-semibold text-zinc-400">メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.shifts
                      .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
                      .map((sh) => (
                        <tr key={sh.id} className="border-b border-zinc-50 last:border-0">
                          <td className="py-2 pl-6 font-medium text-zinc-700">{sh.shift_date}</td>
                          <td className="px-4 py-2 text-center text-zinc-600">{sh.start_time.slice(0, 5)}</td>
                          <td className="px-4 py-2 text-center text-zinc-600">{sh.end_time.slice(0, 5)}</td>
                          <td className="px-4 py-2 text-center text-zinc-400">
                            {sh.break_minutes > 0 ? `${sh.break_minutes}m` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-zinc-800">
                            {formatH(workHours(sh))}
                          </td>
                          <td className="px-6 py-2 text-zinc-400">{sh.note ?? "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
