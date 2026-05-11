"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BarChart2, ChevronLeft, ChevronRight, Clock, FileImage, FileText, Plus, Table, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Shift, Staff } from "@/types/database";

type ShiftWithStaff = Shift & { staff?: Pick<Staff, "id" | "name"> | null };

type CalendarEvent = {
  id: string;
  staff_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: string;
  staff?: Pick<Staff, "id" | "name"> | null;
};

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

// ---- 一括インポート型 ----
type ImportTab = "csv" | "text" | "image";

type ParsedRow = {
  staff_name: string;
  staff_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  note: string;
  match_error?: string;
};

// CSV を ParsedRow[] に変換（クライアントサイド）
function parseCsv(text: string, staff: Staff[]): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  // ヘッダー行をスキップ（スタッフ名が含まれない行は無視）
  const start = lines[0]!.includes("スタッフ") || lines[0]!.includes("日付") ? 1 : 0;
  return lines.slice(start).map((line) => {
    const cols = line.split(/,|\t/).map((c) => c.trim());
    const staffName = cols[0] ?? "";
    const shiftDate = cols[1] ?? "";
    const startTime = (cols[2] ?? "").replace(/[^0-9:]/g, "").slice(0, 5);
    const endTime   = (cols[3] ?? "").replace(/[^0-9:]/g, "").slice(0, 5);
    const breakMin  = parseInt(cols[4] ?? "0", 10) || 0;
    const note      = cols[5] ?? "";
    const matched   = staff.find((s) => s.name === staffName || s.name.includes(staffName) || staffName.includes(s.name));
    return {
      staff_name: staffName,
      staff_id: matched?.id ?? null,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMin,
      note,
      match_error: matched ? undefined : `スタッフ「${staffName}」が登録されていません`,
    };
  }).filter((r) => r.staff_name && r.shift_date && r.start_time && r.end_time);
}

type ViewMode = "week" | "month" | "list" | "staff";

function getMonthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function getMonthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function getDaysInMonth(d: Date) {
  const start = getMonthStart(d);
  const end = getMonthEnd(d);
  const days: Date[] = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    days.push(new Date(cur));
  }
  return days;
}

const fsStaffOf = (staff: Staff[]) => staff.filter((s) => (s as Staff & { team?: string }).team === "FS");
const isStaffOf = (staff: Staff[]) => staff.filter((s) => (s as Staff & { team?: string }).team !== "FS");

export function ShiftsClient({ staff }: { staff: Staff[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [monthRef, setMonthRef] = useState<Date>(() => new Date());
  const [shifts, setShifts] = useState<ShiftWithStaff[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AddModalState>(MODAL_INIT);
  const [saving, setSaving] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [showFsEvents, setShowFsEvents] = useState(true);

  // 一括インポート
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>("csv");
  const [csvText, setCsvText] = useState("");
  const [freeText, setFreeText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const yearMonth = `${monthRef.getFullYear()}-${String(monthRef.getMonth() + 1).padStart(2, "0")}`;

  const resetImport = () => {
    setCsvText(""); setFreeText(""); setImageDataUrl(null); setImageFileName("");
    setParsedRows([]); setParsing(false); setImporting(false);
    setImportError(null); setImportSuccess(null);
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const monthDays = useMemo(() => getDaysInMonth(monthRef), [monthRef]);

  // 表示モードに応じてfetch範囲を決定
  const { fetchFrom, fetchTo } = useMemo(() => {
    if (viewMode === "month" || viewMode === "staff") {
      return { fetchFrom: toYmd(getMonthStart(monthRef)), fetchTo: toYmd(getMonthEnd(monthRef)) };
    }
    if (viewMode === "list") {
      // リストは2週間分表示
      return { fetchFrom: toYmd(weekDays[0]!), fetchTo: toYmd(addDays(weekDays[0]!, 13)) };
    }
    return { fetchFrom: toYmd(weekDays[0]!), fetchTo: toYmd(weekDays[6]!) };
  }, [viewMode, weekDays, monthRef]);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    // IS シフト + FS カレンダーイベントを並列取得
    const [shiftsRes, calRes] = await Promise.all([
      fetch(`/api/shifts?from=${fetchFrom}&to=${fetchTo}`),
      fetch(`/api/calendar/events?from=${fetchFrom}&to=${fetchTo}`),
    ]);
    const shiftsData = (await shiftsRes.json()) as { shifts?: ShiftWithStaff[] };
    const calData = (await calRes.json()) as { events?: CalendarEvent[] };
    setShifts(shiftsData.shifts ?? []);
    setCalEvents(calData.events ?? []);
    setLoading(false);
  }, [fetchFrom, fetchTo]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadShifts(); }, [loadShifts]);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d,  7));
  const thisWeek = () => setWeekStart(getMondayOf(new Date()));
  const prevMonth = () => setMonthRef((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setMonthRef((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const thisMonth = () => setMonthRef(new Date());

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

  // ---- 一括インポート操作 ----

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setParsedRows(parseCsv(text, staff));
      setImportError(null);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageDataUrl(ev.target?.result as string);
      setParsedRows([]);
      setImportError(null);
    };
    reader.readAsDataURL(file);
  };

  const parseWithAi = async (type: "text" | "image") => {
    const content = type === "text" ? freeText : imageDataUrl;
    if (!content) return;
    setParsing(true);
    setImportError(null);
    const res = await fetch("/api/shifts/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, year_month: yearMonth }),
    });
    const d = (await res.json()) as { rows?: ParsedRow[]; error?: string };
    setParsing(false);
    if (d.error) { setImportError(d.error); return; }
    setParsedRows(d.rows ?? []);
  };

  const executeImport = async () => {
    const validRows = parsedRows.filter((r) => r.staff_id && !r.match_error);
    if (validRows.length === 0) { setImportError("インポートできる行がありません"); return; }
    setImporting(true);
    setImportError(null);
    const res = await fetch("/api/shifts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    const d = (await res.json()) as { inserted?: number; errors?: string[] };
    setImporting(false);
    if (d.errors && d.errors.length > 0) {
      setImportError(d.errors.join("\n"));
    }
    if ((d.inserted ?? 0) > 0) {
      setImportSuccess(`${d.inserted}件のシフトをインポートしました`);
      void loadShifts();
      setTimeout(() => { setImportOpen(false); resetImport(); }, 1500);
    }
  };

  const isStaff = useMemo(() => isStaffOf(staff), [staff]);
  const fsStaff = useMemo(() => fsStaffOf(staff), [staff]);

  const filteredIsStaff = filterStaffId === "all" ? isStaff : isStaff.filter((s) => s.id === filterStaffId);
  const filteredFsStaff = filterStaffId === "all" ? fsStaff : fsStaff.filter((s) => s.id === filterStaffId);

  // FS カレンダーイベントを日付と staff_id で引く
  const getFsEventsForDay = (staffId: string, ymd: string) =>
    calEvents.filter((e) => {
      const eventDate = e.start_at.slice(0, 10);
      return e.staff_id === staffId && eventDate === ymd;
    });

  const getFsEventsForDateRange = (staffId: string, fromYmd: string, toYmd_: string) =>
    calEvents.filter((e) => {
      const d = e.start_at.slice(0, 10);
      return e.staff_id === staffId && d >= fromYmd && d <= toYmd_;
    });

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
            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-200" />IS（内勤）</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-200" />FS（外勤・Googleカレンダー連携）</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/shifts/report"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <BarChart2 className="size-4" />
              月次レポート
            </Link>
            <button
              onClick={() => setShowFsEvents((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition ${showFsEvents ? "border-green-300 bg-green-50 text-green-700" : "border-zinc-200 bg-white text-zinc-500"}`}
              type="button"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" />
              FSの稼働{showFsEvents ? "表示中" : "非表示"}
            </button>
            <button
              onClick={() => { resetImport(); setImportOpen(true); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              type="button"
            >
              <Upload className="size-4" />
              一括インポート
            </button>
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

        {/* 表示モード切替 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm shadow-sm">
            {([
              { id: "week" as ViewMode, label: "週" },
              { id: "month" as ViewMode, label: "月" },
              { id: "list" as ViewMode, label: "リスト" },
              { id: "staff" as ViewMode, label: "個人" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${viewMode === id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {/* ナビゲーション */}
          {(viewMode === "week" || viewMode === "list") ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek}><ChevronLeft className="size-4" /></Button>
              <span className="min-w-44 text-center text-sm font-medium">{weekLabel}</span>
              <Button variant="outline" size="sm" onClick={nextWeek}><ChevronRight className="size-4" /></Button>
              <Button variant="outline" size="sm" onClick={thisWeek}>今週</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="size-4" /></Button>
              <span className="min-w-32 text-center text-sm font-medium">
                {monthRef.getFullYear()}年{monthRef.getMonth() + 1}月
              </span>
              <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
              <Button variant="outline" size="sm" onClick={thisMonth}>今月</Button>
            </div>
          )}
        </div>

        {/* ローディング */}
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
            <Clock className="size-4 animate-spin" />読み込み中...
          </div>
        ) : filteredIsStaff.length === 0 ? (
          <p className="text-sm text-zinc-400">スタッフが登録されていません</p>
        ) : (
          <>
            {/* ===== 週表示 ===== */}
            {viewMode === "week" ? (
              <>
                <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <table className="w-full min-w-[700px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="w-28 py-3 pl-4 text-left text-xs font-semibold text-zinc-500">スタッフ</th>
                        {weekDays.map((d) => {
                          const { label, today } = dateLabel(d);
                          return (
                            <th key={toYmd(d)} className={`px-1 py-3 text-center text-xs font-semibold ${today ? "text-blue-600" : d.getDay() === 0 ? "text-red-500" : d.getDay() === 6 ? "text-blue-500" : "text-zinc-500"}`}>
                              {label}
                            </th>
                          );
                        })}
                        <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-400">週計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* IS スタッフ行（青）*/}
                      {filteredIsStaff.map((s) => (
                        <tr key={s.id} className="border-b border-zinc-50 last:border-0">
                          <td className="py-2 pl-4">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                              <span className="text-sm font-medium text-zinc-900">{s.name}</span>
                            </div>
                          </td>
                          {weekDays.map((d) => {
                            const ymd = toYmd(d);
                            const shift = shifts.find((sh) => sh.staff_id === s.id && sh.shift_date === ymd);
                            return (
                              <td key={ymd} className="px-1 py-1 text-center align-top">
                                {shift ? (
                                  <div className="group relative mx-auto max-w-[100px] rounded-md bg-blue-50 px-1.5 py-1.5 text-xs">
                                    <p className="font-semibold text-blue-700">{shift.start_time.slice(0, 5)}〜{shift.end_time.slice(0, 5)}</p>
                                    <p className="text-[10px] text-blue-500">{formatHours(workHours(shift))}{shift.break_minutes > 0 ? ` (休${shift.break_minutes}m)` : ""}</p>
                                    {shift.note ? <p className="mt-0.5 truncate text-[10px] text-zinc-400">{shift.note}</p> : null}
                                    <button className="absolute right-0.5 top-0.5 hidden rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 group-hover:flex" onClick={() => void deleteShift(shift.id)} title="削除" type="button"><X className="size-3" /></button>
                                  </div>
                                ) : (
                                  <button className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-zinc-200 transition hover:bg-zinc-100 hover:text-zinc-500" onClick={() => openModal(s.id, ymd)} title="シフトを追加" type="button"><Plus className="size-4" /></button>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-600">{formatHours(staffWeeklyHours(s.id))}</td>
                        </tr>
                      ))}
                      {/* FS スタッフ行（緑・Googleカレンダー由来）*/}
                      {showFsEvents && filteredFsStaff.map((s) => (
                        <tr key={`fs-${s.id}`} className="border-b border-zinc-50 bg-green-50/30 last:border-0">
                          <td className="py-2 pl-4">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                              <span className="text-sm font-medium text-zinc-800">{s.name}</span>
                              <span className="rounded bg-green-100 px-1 py-0.5 text-[9px] font-bold text-green-600">FS</span>
                            </div>
                          </td>
                          {weekDays.map((d) => {
                            const ymd = toYmd(d);
                            const events = getFsEventsForDay(s.id, ymd);
                            return (
                              <td key={ymd} className="px-1 py-1 align-top">
                                <div className="flex flex-col gap-0.5">
                                  {events.length > 0 ? events.map((ev) => {
                                    const startHm = new Date(ev.start_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
                                    const endHm   = new Date(ev.end_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
                                    return (
                                      <div key={ev.id} className="rounded-md bg-green-50 px-1.5 py-1 text-xs" title={ev.title ?? ""}>
                                        {ev.all_day ? (
                                          <p className="font-semibold text-green-700 truncate">{ev.title ?? "終日"}</p>
                                        ) : (
                                          <>
                                            <p className="font-semibold text-green-700">{startHm}〜{endHm}</p>
                                            {ev.title ? <p className="truncate text-[10px] text-green-600">{ev.title}</p> : null}
                                          </>
                                        )}
                                      </div>
                                    );
                                  }) : (
                                    <div className="flex h-8 items-center justify-center text-[10px] text-zinc-300">予定なし</div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right text-[10px] text-green-600">
                            {getFsEventsForDateRange(s.id, toYmd(weekDays[0]!), toYmd(weekDays[6]!)).length}件
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 週合計サマリー */}
                {shifts.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {filteredIsStaff.map((s) => {
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
              </>
            ) : null}

            {/* ===== 月間カレンダー表示 ===== */}
            {viewMode === "month" ? (
              <div>
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 rounded-t-xl border border-zinc-200 bg-white">
                  {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                    <div key={d} className={`py-2 text-center text-xs font-semibold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500"}`}>{d}</div>
                  ))}
                </div>
                {/* カレンダーグリッド */}
                <div className="grid grid-cols-7 rounded-b-xl border-b border-l border-r border-zinc-200 bg-white">
                  {/* 月初の空白 */}
                  {Array.from({ length: monthDays[0]!.getDay() }, (_, i) => (
                    <div key={`blank-${i}`} className="min-h-[80px] border-r border-t border-zinc-100 bg-zinc-50/50 last:border-r-0" />
                  ))}
                  {monthDays.map((d) => {
                    const ymd = toYmd(d);
                    const dayShifts = shifts.filter((sh) => sh.shift_date === ymd);
                    const isToday = ymd === toYmd(new Date());
                    const isSun = d.getDay() === 0;
                    const isSat = d.getDay() === 6;
                    const isLastCol = d.getDay() === 6;
                    return (
                      <div key={ymd} className={`min-h-[80px] border-r border-t border-zinc-100 p-1.5 ${isLastCol ? "border-r-0" : ""} ${isToday ? "bg-blue-50/40" : ""}`}>
                        <p className={`mb-1 text-right text-xs font-semibold ${isToday ? "text-blue-600" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-zinc-600"}`}>{d.getDate()}</p>
                        <div className="flex flex-col gap-0.5">
                          {dayShifts.map((sh) => {
                            const sName = staff.find((s) => s.id === sh.staff_id)?.name ?? "?";
                            return (
                              <div key={sh.id} className="group relative flex items-center gap-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-800">
                                <span className="truncate font-medium">{sName}</span>
                                <span className="shrink-0 text-blue-500">{sh.start_time.slice(0, 5)}</span>
                                <button className="absolute right-0 top-0 hidden rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 group-hover:flex" onClick={() => void deleteShift(sh.id)} title="削除" type="button"><X className="size-2.5" /></button>
                              </div>
                            );
                          })}
                          <button className="mt-0.5 flex items-center justify-center rounded p-0.5 text-zinc-200 hover:bg-zinc-100 hover:text-zinc-500" onClick={() => openModal(filteredIsStaff[0]?.id ?? "", ymd)} title="シフトを追加" type="button"><Plus className="size-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {/* 月末の空白 */}
                  {Array.from({ length: (6 - (monthDays[monthDays.length - 1]?.getDay() ?? 6)) }, (_, i) => (
                    <div key={`tail-${i}`} className="min-h-[80px] border-r border-t border-zinc-100 bg-zinc-50/50 last:border-r-0" />
                  ))}
                </div>
              </div>
            ) : null}

            {/* ===== リスト表示 ===== */}
            {viewMode === "list" ? (() => {
              const listDays = Array.from({ length: 14 }, (_, i) => addDays(weekDays[0]!, i));
              return (
                <div className="flex flex-col gap-3">
                  {listDays.map((d) => {
                    const ymd = toYmd(d);
                    const dayShifts = shifts.filter((sh) => sh.shift_date === ymd);
                    const { today } = dateLabel(d);
                    return (
                      <div key={ymd} className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${today ? "border-blue-300" : ""}`}>
                        <div className={`flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 ${today ? "bg-blue-50" : ""}`}>
                          <p className={`text-sm font-semibold ${today ? "text-blue-700" : d.getDay() === 0 ? "text-red-600" : d.getDay() === 6 ? "text-blue-600" : "text-zinc-700"}`}>
                            {d.getMonth() + 1}/{d.getDate()}（{DAY_LABELS[d.getDay()]}）{today ? " ← 今日" : ""}
                          </p>
                          <p className="text-xs text-zinc-400">{dayShifts.length > 0 ? `${dayShifts.length}名出勤` : "シフトなし"}</p>
                        </div>
                        {dayShifts.length > 0 ? (
                          <div className="divide-y divide-zinc-50 px-4">
                            {dayShifts.map((sh) => {
                              const sName = staff.find((s) => s.id === sh.staff_id)?.name ?? "?";
                              return (
                                <div key={sh.id} className="flex items-center justify-between py-2.5">
                                  <span className="text-sm font-medium text-zinc-900">{sName}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm text-zinc-700">{sh.start_time.slice(0, 5)} 〜 {sh.end_time.slice(0, 5)}</span>
                                    <span className="text-xs text-zinc-400">{formatHours(workHours(sh))}</span>
                                    {sh.note ? <span className="text-xs text-zinc-400">{sh.note}</span> : null}
                                    <button className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500" onClick={() => void deleteShift(sh.id)} title="削除" type="button"><X className="size-3.5" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2.5">
                            <button className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-500" onClick={() => openModal(filteredIsStaff[0]?.id ?? "", ymd)} type="button"><Plus className="size-3" />シフトを追加</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })() : null}

            {/* ===== 個人別表示 ===== */}
            {viewMode === "staff" ? (
              <div className="flex flex-col gap-6">
                {filteredIsStaff.map((s) => {
                  const sShifts = shifts.filter((sh) => sh.staff_id === s.id);
                  const totalH = sShifts.reduce((acc, sh) => acc + workHours(sh), 0);
                  return (
                    <div key={s.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                        <div>
                          <p className="font-semibold text-zinc-900">{s.name}</p>
                          <p className="text-xs text-zinc-500">{monthRef.getFullYear()}年{monthRef.getMonth() + 1}月 — {sShifts.length}日出勤 / {formatHours(totalH)}</p>
                        </div>
                      </div>
                      {/* スタッフの月間シフトを曜日グリッドで */}
                      <div className="grid grid-cols-7 border-b border-zinc-50">
                        {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
                          <div key={day} className={`py-1.5 text-center text-[10px] font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-zinc-400"}`}>{day}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 px-1 pb-2 pt-1">
                        {Array.from({ length: monthDays[0]!.getDay() }, (_, i) => <div key={`b-${i}`} />)}
                        {monthDays.map((d) => {
                          const ymd = toYmd(d);
                          const sh = sShifts.find((sh) => sh.shift_date === ymd);
                          const isToday = ymd === toYmd(new Date());
                          return (
                            <div key={ymd} className="p-0.5">
                              {sh ? (
                                <div className={`group relative rounded-md p-1 text-center text-[10px] ${isToday ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-700"}`}>
                                  <p className="font-semibold">{d.getDate()}</p>
                                  <p className={isToday ? "text-blue-100" : "text-blue-500"}>{sh.start_time.slice(0, 5)}</p>
                                  <button className="absolute right-0 top-0 hidden rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 group-hover:flex" onClick={() => void deleteShift(sh.id)} title="削除" type="button"><X className="size-2.5" /></button>
                                </div>
                              ) : (
                                <button className="flex h-10 w-full flex-col items-center justify-center rounded-md text-zinc-200 hover:bg-zinc-100 hover:text-zinc-400" onClick={() => openModal(s.id, ymd)} title="シフトを追加" type="button">
                                  <span className="text-[10px] text-zinc-300">{d.getDate()}</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
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

      {/* ======== 一括インポートモーダル ======== */}
      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-2xl">
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">シフト一括インポート</h2>
                <p className="mt-0.5 text-xs text-zinc-500">CSV・テキスト・画像からシフトをまとめて登録できます</p>
              </div>
              <button onClick={() => { setImportOpen(false); resetImport(); }} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" type="button">
                <X className="size-5" />
              </button>
            </div>

            {/* タブ */}
            <div className="flex gap-0 border-b border-zinc-100">
              {([
                { id: "csv" as ImportTab, label: "CSV", icon: Table },
                { id: "text" as ImportTab, label: "テキスト", icon: FileText },
                { id: "image" as ImportTab, label: "画像", icon: FileImage },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setImportTab(id); setParsedRows([]); setImportError(null); setImportSuccess(null); }}
                  className={`flex items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-medium transition ${importTab === id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"}`}
                  type="button"
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* ===== CSV タブ ===== */}
              {importTab === "csv" ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                    <p className="font-semibold">CSV フォーマット（ヘッダー行は任意）:</p>
                    <p className="mt-1 font-mono text-[11px]">スタッフ名, 日付(YYYY-MM-DD), 開始時間(HH:MM), 終了時間(HH:MM), 休憩(分), メモ</p>
                    <p className="mt-1 font-mono text-[11px]">例: 田中 太郎,2025-05-12,10:00,19:00,60,早番</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={handleCsvFileChange} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700"
                    type="button"
                  >
                    <Upload className="size-5" />
                    CSVファイルを選択
                  </button>
                  {csvText ? (
                    <div>
                      <p className="mb-1 text-xs text-zinc-500">テキストで貼り付けることもできます:</p>
                      <textarea
                        className="h-28 w-full rounded-lg border border-zinc-200 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950"
                        value={csvText}
                        onChange={(e) => { setCsvText(e.target.value); setParsedRows(parseCsv(e.target.value, staff)); }}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="mb-1 text-xs text-zinc-500">またはここに直接貼り付け:</p>
                      <textarea
                        className="h-28 w-full rounded-lg border border-zinc-200 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950"
                        placeholder={"田中 太郎,2025-05-12,10:00,19:00,60\n鈴木 花子,2025-05-12,10:00,18:00,60"}
                        value={csvText}
                        onChange={(e) => { setCsvText(e.target.value); setParsedRows(parseCsv(e.target.value, staff)); }}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {/* ===== テキストタブ ===== */}
              {importTab === "text" ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg bg-violet-50 px-4 py-3 text-xs text-violet-700">
                    <p className="font-semibold">✦ AIが自動解析します — 自由形式で入力OK</p>
                    <p className="mt-1">例: 「田中 5/12 10〜19時 休憩1時間」「鈴木さん 12日 10:00-18:00」</p>
                  </div>
                  <textarea
                    className="h-36 w-full rounded-lg border border-zinc-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    placeholder={"田中 太郎 5/12 10時〜19時 休憩60分\n鈴木 花子 5/13 10:00-18:00\n..."}
                    value={freeText}
                    onChange={(e) => { setFreeText(e.target.value); setParsedRows([]); }}
                  />
                  <Button
                    onClick={() => void parseWithAi("text")}
                    disabled={!freeText.trim() || parsing}
                    className="self-start"
                    type="button"
                  >
                    {parsing ? "解析中…" : "AIで解析"}
                  </Button>
                </div>
              ) : null}

              {/* ===== 画像タブ ===== */}
              {importTab === "image" ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg bg-violet-50 px-4 py-3 text-xs text-violet-700">
                    <p className="font-semibold">✦ シフト表の写真・スクリーンショットをアップロード</p>
                    <p className="mt-1">Claude Vision APIがシフト内容を読み取り、自動でインポートデータを生成します</p>
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
                  {imageDataUrl ? (
                    <div className="flex flex-col gap-3">
                      <img src={imageDataUrl} alt="シフト表プレビュー" className="max-h-48 rounded-lg border border-zinc-200 object-contain" />
                      <p className="text-xs text-zinc-500">{imageFileName}</p>
                      <div className="flex gap-2">
                        <Button onClick={() => void parseWithAi("image")} disabled={parsing} type="button">
                          {parsing ? "解析中…" : "AIで読み取り"}
                        </Button>
                        <Button variant="outline" onClick={() => { setImageDataUrl(null); setImageFileName(""); setParsedRows([]); }} type="button">
                          画像を変更
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700"
                      type="button"
                    >
                      <FileImage className="size-6" />
                      画像ファイルを選択（JPG / PNG）
                    </button>
                  )}
                </div>
              ) : null}

              {/* エラー表示 */}
              {importError ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <pre className="whitespace-pre-wrap text-xs">{importError}</pre>
                </div>
              ) : null}

              {/* 成功表示 */}
              {importSuccess ? (
                <div className="mt-4 rounded-lg bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700">
                  ✓ {importSuccess}
                </div>
              ) : null}

              {/* ===== プレビューテーブル ===== */}
              {parsedRows.length > 0 ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">解析結果 — {parsedRows.length}件</p>
                    <p className="text-xs text-zinc-500">
                      インポート可能: <span className="font-semibold text-zinc-900">{parsedRows.filter((r) => r.staff_id && !r.match_error).length}件</span>
                      {parsedRows.some((r) => r.match_error) ? <span className="ml-2 text-red-600">エラー: {parsedRows.filter((r) => r.match_error).length}件</span> : null}
                    </p>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-50">
                        <tr className="border-b border-zinc-200">
                          <th className="px-3 py-2 text-left font-semibold text-zinc-600">スタッフ</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-600">日付</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-600">開始</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-600">終了</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-600">休憩</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-600">メモ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, i) => (
                          <tr key={i} className={`border-b border-zinc-100 last:border-0 ${row.match_error ? "bg-red-50" : ""}`}>
                            <td className="px-3 py-2">
                              {row.match_error ? (
                                <span className="text-red-600" title={row.match_error}>{row.staff_name} ⚠</span>
                              ) : (
                                <span className="text-zinc-900">{row.staff_name}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-700">{row.shift_date}</td>
                            <td className="px-3 py-2 text-zinc-700">{row.start_time}</td>
                            <td className="px-3 py-2 text-zinc-700">{row.end_time}</td>
                            <td className="px-3 py-2 text-zinc-500">{row.break_minutes}分</td>
                            <td className="px-3 py-2 text-zinc-400">{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* インポート実行ボタン */}
                  <div className="mt-4 flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={() => { setImportOpen(false); resetImport(); }} type="button">
                      キャンセル
                    </Button>
                    <Button
                      onClick={() => void executeImport()}
                      disabled={importing || parsedRows.filter((r) => r.staff_id && !r.match_error).length === 0}
                      type="button"
                    >
                      {importing ? "インポート中…" : `${parsedRows.filter((r) => r.staff_id && !r.match_error).length}件をインポート`}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
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
