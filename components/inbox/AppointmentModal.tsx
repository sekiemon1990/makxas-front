"use client";

import { useState } from "react";

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
