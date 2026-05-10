"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Plus, X, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Shift, Staff } from "@/types/database";

type ShiftWithStaff = Shift & { staff?: Pick<Staff, "id" | "name"> | null };

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMondayOf(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** "HH:MM" → 分数 */
function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** 稼働時間（時間単位、小数点1桁）を計算 */
function workHours(shift: Shift) {
  const mins = toMin(shift.end_time) - toMin(shift.start_time) - shift.break_minutes;
  return Math.max(0, mins) / 60;
}

function formatHours(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm}m` : `${hh}h`;
}

type AddModalState = {
  open: boolean;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  note: string;
};

const MODAL_INIT: AddModalState = {
  open: false,
  staffId: "",
  date: "",
  startTime: "10:00",
  endTime: "19:00",
  breakMinutes: "60",
  note: "",
};

export function ShiftsClient({ staff }: { staff: Staff[] }) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [shifts, setShifts] = useState<ShiftWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AddModalState>(MODAL_INIT);
  const [saving, setSaving] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState<string>("all");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadShifts = useCallback(async () => {
    setLoading(true);
    const from = toYmd(weekDays[0]!);
    const to   = toYmd(weekDays[6]!);
    const res = await fetch(`/api/shifts?from=${from}&to=${to}`);
    const d = (await res.json()) as { shifts?: ShiftWithStaff[] };
    setShifts(d.shifts ?? []);
    setLoading(false);
  }, [weekDays]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadShifts(); }, [loadShifts]);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d,  7));
  const thisWeek = () => setWeekStart(getMondayOf(new Date()));

  const openModal = (staffId: string, date: string) => {
    setModal({ ...MODAL_INIT, open: true, staffId, date });
  };

  const saveShift = async () => {
    if (!modal.staffId || !modal.date || !modal.startTime || !modal.endTime) return;
    setSaving(true);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: modal.staffId,
        shift_date: modal.date,
        start_time: modal.startTime,
        end_time: modal.endTime,
        break_minutes: Number(modal.breakMinutes) || 0,
        note: modal.note || undefined,
      }),
    });
    const d = (await res.json()) as { shift?: ShiftWithStaff };
    setSaving(false);
    if (d.shift) {
      setShifts((prev) => {
        const idx = prev.findIndex((s) => s.id === d.shift!.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = d.shift!; return n; }
        return [...prev, d.shift!];
      });
      setModal(MODAL_INIT);
    }
  };

  const deleteShift = async (id: string) => {
    await fetch("/api/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setShifts((prev) => prev.filter((s) => s.id !== id));
  };

  const filteredStaff = filterStaffId === "all" ? staff : staff.filter((s) => s.id === filterStaffId);

  // 表示する曜日ラベル（月〜日）
  const dateLabel = (d: Date) => {
    const dow = DAY_LABELS[d.getDay()] ?? "";
    const today = toYmd(new Date()) === toYmd(d);
    return { label: `${d.getMonth() + 1}/${d.getDate()}(${dow})`, today };
  };

  // スタッフの週合計稼働時間
  const staffWeeklyHours = (staffId: string) => {
    return shifts.filter((s) => s.staff_id === staffId).reduce((acc, s) => acc + workHours(s), 0);
  };

  const weekLabel = `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 〜 ${addDays(weekStart, 6).getMonth() + 1}月${addDays(weekStart, 6).getDate()}日`;

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* ヘッダー */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Shift</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">シフト管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/shifts/report"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <BarChart2 className="size-4" />
              月次レポート
            </Link>
            <select
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="all">全スタッフ</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 週ナビゲーション */}
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={prevWeek}><ChevronLeft className="size-4" /></Button>
          <span className="min-w-48 text-center text-sm font-medium">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={nextWeek}><ChevronRight className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={thisWeek}>今週</Button>
        </div>

        {/* カレンダーグリッド */}
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
            <Clock className="size-4 animate-spin" />読み込み中...
          </div>
        ) : filteredStaff.length === 0 ? (
          <p className="text-sm text-zinc-400">スタッフが登録されていません</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="w-28 py-3 pl-4 text-left text-xs font-semibold text-zinc-500">スタッフ</th>
                  {weekDays.map((d) => {
                    const { label, today } = dateLabel(d);
                    return (
                      <th
                        key={toYmd(d)}
                        className={`px-1 py-3 text-center text-xs font-semibold ${today ? "text-blue-600" : d.getDay() === 0 ? "text-red-500" : d.getDay() === 6 ? "text-blue-500" : "text-zinc-500"}`}
                      >
                        {label}
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-400">週計</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 pl-4">
                      <span className="text-sm font-medium text-zinc-900">{s.name}</span>
                    </td>
                    {weekDays.map((d) => {
                      const ymd = toYmd(d);
                      const shift = shifts.find((sh) => sh.staff_id === s.id && sh.shift_date === ymd);
                      return (
                        <td key={ymd} className="px-1 py-1 text-center align-top">
                          {shift ? (
                            <div className="group relative mx-auto max-w-[100px] rounded-md bg-blue-50 px-1.5 py-1.5 text-xs">
                              <p className="font-semibold text-blue-700">
                                {shift.start_time.slice(0, 5)}〜{shift.end_time.slice(0, 5)}
                              </p>
                              <p className="text-[10px] text-blue-500">
                                {formatHours(workHours(shift))}
                                {shift.break_minutes > 0 ? ` (休${shift.break_minutes}m)` : ""}
                              </p>
                              {shift.note ? (
                                <p className="mt-0.5 truncate text-[10px] text-zinc-400">{shift.note}</p>
                              ) : null}
                              <button
                                className="absolute right-0.5 top-0.5 hidden rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 group-hover:flex"
                                onClick={() => void deleteShift(shift.id)}
                                title="削除"
                                type="button"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-zinc-200 transition hover:bg-zinc-100 hover:text-zinc-500"
                              onClick={() => openModal(s.id, ymd)}
                              title="シフトを追加"
                              type="button"
                            >
                              <Plus className="size-4" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-600">
                      {formatHours(staffWeeklyHours(s.id))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 週合計サマリー */}
        {!loading && shifts.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {filteredStaff.map((s) => {
              const h = staffWeeklyHours(s.id);
              if (h === 0) return null;
              const days = shifts.filter((sh) => sh.staff_id === s.id && weekDays.some((d) => toYmd(d) === sh.shift_date)).length;
              return (
                <div key={s.id} className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
                  <p className="text-xs text-zinc-500">{s.name}</p>
                  <p className="mt-0.5 text-base font-semibold text-zinc-900">{formatHours(h)}</p>
                  <p className="text-[10px] text-zinc-400">{days}日出勤</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* シフト追加モーダル */}
      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm rounded-xl border-zinc-200 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {staff.find((s) => s.id === modal.staffId)?.name ?? ""}
                <span className="ml-2 text-sm font-normal text-zinc-500">{modal.date}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">開始時間</label>
                  <Input
                    type="time"
                    value={modal.startTime}
                    onChange={(e) => setModal((m) => ({ ...m, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">終了時間</label>
                  <Input
                    type="time"
                    value={modal.endTime}
                    onChange={(e) => setModal((m) => ({ ...m, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">休憩時間（分）</label>
                <Input
                  type="number"
                  min={0}
                  step={15}
                  value={modal.breakMinutes}
                  onChange={(e) => setModal((m) => ({ ...m, breakMinutes: e.target.value }))}
                  placeholder="例: 60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">メモ（任意）</label>
                <Input
                  value={modal.note}
                  onChange={(e) => setModal((m) => ({ ...m, note: e.target.value }))}
                  placeholder="例: 午後から"
                />
              </div>
              {/* 稼働時間プレビュー */}
              {modal.startTime && modal.endTime ? (() => {
                const mins = toMin(modal.endTime) - toMin(modal.startTime) - (Number(modal.breakMinutes) || 0);
                const h = Math.max(0, mins) / 60;
                return (
                  <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    稼働時間: <strong>{formatHours(h)}</strong>
                  </p>
                );
              })() : null}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setModal(MODAL_INIT)}
                  type="button"
                >
                  キャンセル
                </Button>
                <Button className="flex-1" onClick={() => void saveShift()} disabled={saving} type="button">
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// 月次シフトサマリー（ダッシュボード向けにexport）
export function calcMonthlyHours(shifts: Shift[], staffId: string, yearMonth: string) {
  // yearMonth: "YYYY-MM"
  return shifts
    .filter((s) => s.staff_id === staffId && s.shift_date.startsWith(yearMonth))
    .reduce((acc, s) => acc + workHours(s), 0);
}

export { workHours };
