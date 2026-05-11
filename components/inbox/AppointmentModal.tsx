"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categoryOptions } from "@/lib/inquiry-options";
import type { InquiryWithLead } from "@/types/database";

export function AppointmentModal({
  inquiry,
  onOpenChange,
  onSaved,
  open,
}: {
  inquiry: InquiryWithLead | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (inquiry: InquiryWithLead) => void;
  open: boolean;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState(categoryOptions[0]);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState<"visit" | "delivery">("visit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FS スタッフの稼働状況（日付選択時に取得）
  type FsEvent = { id: string; title: string | null; start_at: string; end_at: string; all_day: boolean; staff?: { name: string } | null };
  type FsStaff = { id: string; name: string; events: FsEvent[] };
  const [fsAvailability, setFsAvailability] = useState<FsStaff[]>([]);
  const [fsLoading, setFsLoading] = useState(false);

  // 日付が変わったら FS スタッフの予定を取得
  useEffect(() => {
    if (!date) { setFsAvailability([]); return; }
    setFsLoading(true);
    void fetch(`/api/calendar/events?from=${date}&to=${date}`)
      .then((r) => r.json())
      .then((d: { events?: (FsEvent & { staff?: { id: string; name: string; team: string } | null })[] }) => {
        // FS スタッフごとにグループ化
        const map = new Map<string, FsStaff>();
        for (const ev of d.events ?? []) {
          if (!ev.staff?.id) continue;
          if (!map.has(ev.staff.id)) {
            map.set(ev.staff.id, { id: ev.staff.id, name: ev.staff.name, events: [] });
          }
          map.get(ev.staff.id)!.events.push(ev);
        }
        setFsAvailability([...map.values()]);
      })
      .finally(() => setFsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handleSave = async () => {
    if (!inquiry || !date || !time) {
      setError("査定日と時刻を入力してください。");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiry_id: inquiry.id,
        scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
        item_category: category,
        item_description: description,
        address,
        preferred_method: method,
        staff_id: inquiry.assigned_to,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "アポの保存に失敗しました。");
      return;
    }

    const payload = (await response.json()) as { inquiry: InquiryWithLead };
    onSaved(payload.inquiry);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] rounded-lg">
        <DialogHeader>
          <DialogTitle>アポ設定</DialogTitle>
          <DialogDescription>
            査定日時と訪問方法を入力して、反響ステータスを更新します。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="査定日">
              <Input
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </Field>
            <Field label="時刻">
              <Input
                onChange={(event) => setTime(event.target.value)}
                type="time"
                value={time}
              />
            </Field>
          </div>

          {/* FS スタッフの稼働状況 */}
          {date ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
                FS（外勤）スタッフの予定 — {date}
              </p>
              {fsLoading ? (
                <p className="text-xs text-zinc-400">読み込み中…</p>
              ) : fsAvailability.length === 0 ? (
                <p className="text-xs text-zinc-400">登録済みのFSスタッフの予定はありません</p>
              ) : (
                <div className="space-y-1.5">
                  {fsAvailability.map((fs) => (
                    <div key={fs.id} className="flex items-start gap-2">
                      <span className="w-20 shrink-0 text-xs font-medium text-zinc-700">{fs.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {fs.events.length === 0 ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">予定なし（稼働可）</span>
                        ) : fs.events.map((ev) => {
                          const start = ev.all_day ? "終日" : new Date(ev.start_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
                          const end   = ev.all_day ? "" : `〜${new Date(ev.end_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
                          return (
                            <span key={ev.id} className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700" title={ev.title ?? ""}>
                              {start}{end} {ev.title ? `(${ev.title.slice(0, 12)}${ev.title.length > 12 ? "…" : ""})` : ""}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <Field label="品目カテゴリ">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="品物の説明">
            <Textarea
              className="min-h-24 resize-none"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="ブランド名、型番、状態など"
              value={description}
            />
          </Field>
          <Field label="住所">
            <Input
              onChange={(event) => setAddress(event.target.value)}
              placeholder="東京都品川区..."
              value={address}
            />
          </Field>
          <Field label="訪問方法">
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as "visit" | "delivery")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visit">訪問査定</SelectItem>
                <SelectItem value="delivery">宅配査定</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button disabled={saving} onClick={handleSave} type="button">
            {saving ? "保存中..." : "アポを確定する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
