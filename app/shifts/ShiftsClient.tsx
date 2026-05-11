"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BarChart2, ChevronLeft, ChevronRight, Clock, FileImage, FileText, Plus, Table, Upload, X } from "lucide-react";
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

export function ShiftsClient({ staff }: { staff: Staff[] }) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [shifts, setShifts] = useState<ShiftWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AddModalState>(MODAL_INIT);
  const [saving, setSaving] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState<string>("all");

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

  const yearMonth = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

  const resetImport = () => {
    setCsvText(""); setFreeText(""); setImageDataUrl(null); setImageFileName("");
    setParsedRows([]); setParsing(false); setImporting(false);
    setImportError(null); setImportSuccess(null);
  };

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
