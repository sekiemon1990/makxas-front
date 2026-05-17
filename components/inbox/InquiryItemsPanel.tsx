"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HIGH_VALUE_CATEGORIES, HIGH_VALUE_PRICE_THRESHOLD } from "@/lib/inquiry-options";
import { cn } from "@/lib/utils";
import type { InquiryItem, InquiryItemCondition, InquiryItemQuoteType } from "@/types/database";

export type CustomerProfile = {
  age_group: "middle_senior" | "young" | "unknown";
  income_level: "affluent" | "general" | "unknown";
  sell_motivation: "estate" | "moving" | "declutter" | "replacement" | "unknown";
  motivation_strength: "strong" | "medium" | "weak" | "unknown";
};

const MOTIVATION_LABELS: Record<CustomerProfile["sell_motivation"], string> = {
  estate: "遺品整理",
  moving: "引越し",
  declutter: "片付け",
  replacement: "買い換え",
  unknown: "不明",
};

const MOTIVATION_STRENGTH_LABELS: Record<CustomerProfile["motivation_strength"], string> = {
  strong: "強",
  medium: "中",
  weak: "弱",
  unknown: "不明",
};

const CONDITION_LABELS: Record<InquiryItemCondition, string> = {
  N: "新品未使用",
  S: "未使用に近い",
  A: "目立った傷なし",
  B: "少し傷あり",
  C: "傷・汚れあり",
  D: "かなり傷あり",
  J: "ジャンク",
  不明: "不明",
  その他: "その他",
};

const CONDITION_COLORS: Record<InquiryItemCondition, string> = {
  N: "bg-emerald-100 text-emerald-800",
  S: "bg-green-100 text-green-800",
  A: "bg-sky-100 text-sky-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  J: "bg-red-100 text-red-800",
  不明: "bg-zinc-100 text-zinc-600",
  その他: "bg-zinc-100 text-zinc-600",
};

const QUOTE_TYPE_LABELS: Record<InquiryItemQuoteType, string> = {
  upper: "上限",
  around: "前後",
  exact: "ちょうど",
  range: "幅あり",
};

function formatQuote(item: InquiryItem): string | null {
  if (!item.quote_type || item.quote_price_min == null) return null;
  const fmt = (n: number) => n.toLocaleString("ja-JP");
  switch (item.quote_type) {
    case "upper":
      return `最大 ¥${fmt(item.quote_price_min)}`;
    case "around":
      return `¥${fmt(item.quote_price_min)} 前後`;
    case "exact":
      return `¥${fmt(item.quote_price_min)}`;
    case "range":
      return item.quote_price_max != null
        ? `¥${fmt(item.quote_price_min)}〜¥${fmt(item.quote_price_max)}`
        : `¥${fmt(item.quote_price_min)}〜`;
  }
}

type ItemFormValues = {
  item_name: string;
  brand: string;
  model_number: string;
  condition: InquiryItemCondition | "";
  accessories: string;
  estimated_price_min: string;
  quote_type: InquiryItemQuoteType | "";
  quote_price_min: string;
  quote_price_max: string;
  notes: string;
};

const EMPTY_FORM: ItemFormValues = {
  item_name: "",
  brand: "",
  model_number: "",
  condition: "",
  accessories: "",
  estimated_price_min: "",
  quote_type: "",
  quote_price_min: "",
  quote_price_max: "",
  notes: "",
};

function itemToForm(item: InquiryItem): ItemFormValues {
  return {
    item_name: item.item_name,
    brand: item.brand ?? "",
    model_number: item.model_number ?? "",
    condition: item.condition ?? "",
    accessories: item.accessories ?? "",
    estimated_price_min: item.estimated_price_min != null ? String(item.estimated_price_min) : "",
    quote_type: item.quote_type ?? "",
    quote_price_min: item.quote_price_min != null ? String(item.quote_price_min) : "",
    quote_price_max: item.quote_price_max != null ? String(item.quote_price_max) : "",
    notes: item.notes ?? "",
  };
}

export function InquiryItemsPanel({
  inquiryId,
  leadId,
  className,
  onProfileExtracted,
}: {
  inquiryId: string;
  leadId?: string | null;
  className?: string;
  onProfileExtracted?: (profile: CustomerProfile, suggestedItems: string[], approachHint: string) => void;
}) {
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [open, setOpen] = useState(false);

  // 追加買取サジェスト
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [suggestedItems, setSuggestedItems] = useState<string[]>([]);
  const [approachHint, setApproachHint] = useState<string>("");

  // 編集中アイテム（id=新規 or 既存ID）
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<ItemFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inquiry-items?inquiry_id=${inquiryId}`);
      if (res.ok) {
        const data = await res.json() as InquiryItem[];
        setItems(data);
        if (data.length > 0) setOpen(true); // アイテムがあれば自動オープン
      }
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // 反響が切り替わったらプロファイルをリセットしてデータを再取得
    setCustomerProfile(null);
    setSuggestedItems([]);
    setApproachHint("");
    void fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAiExtract = async () => {
    setExtracting(true);
    try {
      const res = await fetch("/api/ai/extract-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry_id: inquiryId, lead_id: leadId }),
      });
      if (res.ok) {
        const data = await res.json() as {
          saved: InquiryItem[];
          customer_profile?: CustomerProfile;
          suggested_items?: string[];
          approach_hint?: string;
        };
        if (data.saved.length > 0) {
          await fetchItems();
          setOpen(true);
        }
        if (data.customer_profile) {
          setCustomerProfile(data.customer_profile);
          setSuggestedItems(data.suggested_items ?? []);
          setApproachHint(data.approach_hint ?? "");
          onProfileExtracted?.(
            data.customer_profile,
            data.suggested_items ?? [],
            data.approach_hint ?? "",
          );
        }
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        item_name: form.item_name.trim(),
        brand: form.brand || null,
        model_number: form.model_number || null,
        condition: (form.condition as InquiryItemCondition) || null,
        accessories: form.accessories || null,
        estimated_price_min: form.estimated_price_min ? parseInt(form.estimated_price_min) : null,
        quote_type: (form.quote_type as InquiryItemQuoteType) || null,
        quote_price_min: form.quote_price_min ? parseInt(form.quote_price_min) : null,
        quote_price_max: form.quote_price_max ? parseInt(form.quote_price_max) : null,
        notes: form.notes || null,
      };

      if (editId === "new") {
        const res = await fetch("/api/inquiry-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inquiry_id: inquiryId, lead_id: leadId, ...payload }),
        });
        if (res.ok) {
          await fetchItems();
          setEditId(null);
          setForm(EMPTY_FORM);
        }
      } else if (editId) {
        const res = await fetch(`/api/inquiry-items/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await fetchItems();
          setEditId(null);
          setForm(EMPTY_FORM);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/inquiry-items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const startEdit = (item: InquiryItem) => {
    setEditId(item.id);
    setForm(itemToForm(item));
  };

  const startNew = () => {
    setEditId("new");
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  /** 商品名・ブランド名に高価古物キーワードが含まれるか判定 */
  const isHighValueItem = (item: InquiryItem) => {
    const nameText = `${item.item_name} ${item.brand ?? ""}`.toLowerCase();
    return HIGH_VALUE_CATEGORIES.some((cat) => nameText.includes(cat.toLowerCase()));
  };

  // 高単価アイテムを先頭にソート
  const sortedItems = [...items].sort((a, b) => {
    const aHighCat = isHighValueItem(a);
    const bHighCat = isHighValueItem(b);
    const aHighPrice = (a.quote_price_min ?? a.estimated_price_min ?? 0) >= HIGH_VALUE_PRICE_THRESHOLD;
    const bHighPrice = (b.quote_price_min ?? b.estimated_price_min ?? 0) >= HIGH_VALUE_PRICE_THRESHOLD;
    const aScore = (aHighCat ? 2 : 0) + (aHighPrice ? 1 : 0);
    const bScore = (bHighCat ? 2 : 0) + (bHighPrice ? 1 : 0);
    return bScore - aScore;
  });

  const motivationLabel = customerProfile ? MOTIVATION_LABELS[customerProfile.sell_motivation] : null;
  const motivationStrengthLabel = customerProfile ? MOTIVATION_STRENGTH_LABELS[customerProfile.motivation_strength] : null;

  return (
    <div className={cn("border border-zinc-200 rounded-lg overflow-hidden", className)}>
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between bg-zinc-50 px-3 py-2 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Package className="size-3.5 text-zinc-500" aria-hidden="true" />
          <span className="text-xs font-semibold text-zinc-700">商品情報</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
              {items.length}
            </Badge>
          )}
          {loading && <span className="text-[10px] text-zinc-400">読込中…</span>}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
            disabled={extracting}
            onClick={handleAiExtract}
            title="最新メッセージからAIで商品情報を自動抽出"
            type="button"
          >
            <Bot className="size-3" />
            {extracting ? "抽出中…" : "AI抽出"}
          </button>
          <button
            className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 transition hover:bg-zinc-50"
            onClick={startNew}
            type="button"
          >
            <Plus className="size-3" />
            追加
          </button>
          {open ? (
            <ChevronUp className="size-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="size-3.5 text-zinc-400" />
          )}
        </div>
      </div>

      {/* 追加買取サジェストバナー */}
      {customerProfile && suggestedItems.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="size-3 text-amber-600 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-semibold text-amber-800">追加買取サジェスト</span>
            {motivationLabel && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                動機: {motivationLabel}（{motivationStrengthLabel}）
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {suggestedItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800"
              >
                {item}
              </span>
            ))}
          </div>
          {approachHint && (
            <p className="text-[10px] text-amber-700 leading-4">{approachHint}</p>
          )}
        </div>
      )}

      {/* コンテンツ */}
      {open && (
        <div className="divide-y divide-zinc-100">
          {items.length === 0 && editId !== "new" && (
            <div className="px-3 py-3 text-center space-y-1.5">
              <p className="text-[11px] text-zinc-400">
                商品情報がありません。「AI抽出」または「追加」から登録してください。
              </p>
              {!customerProfile && (
                <p className="text-[10px] text-violet-500">
                  💡 AI抽出で顧客プロファイルと追加買取候補も確認できます
                </p>
              )}
            </div>
          )}

          {sortedItems.map((item) =>
            editId === item.id ? (
              <ItemForm
                key={item.id}
                form={form}
                onChange={setForm}
                onCancel={cancelEdit}
                onSave={handleSave}
                saving={saving}
              />
            ) : (
              <ItemRow
                key={item.id}
                item={item}
                onEdit={() => startEdit(item)}
                onDelete={() => void handleDelete(item.id)}
              />
            ),
          )}

          {editId === "new" && (
            <ItemForm
              form={form}
              onChange={setForm}
              onCancel={cancelEdit}
              onSave={handleSave}
              saving={saving}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: InquiryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const quoteStr = formatQuote(item);
  const nameText = `${item.item_name} ${item.brand ?? ""}`.toLowerCase();
  const isHighValueCat = HIGH_VALUE_CATEGORIES.some((cat) => nameText.includes(cat.toLowerCase()));
  const effectivePrice = item.quote_price_min ?? item.estimated_price_min ?? 0;
  const isHighValuePrice = effectivePrice >= HIGH_VALUE_PRICE_THRESHOLD;
  const isHighValue = isHighValueCat || isHighValuePrice;

  return (
    <div className="group flex items-start gap-2 px-3 py-2.5 hover:bg-zinc-50/80">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-zinc-800">{item.item_name}</span>
          {item.condition && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", CONDITION_COLORS[item.condition])}>
              {item.condition}
            </span>
          )}
          {isHighValue && (
            <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <Star className="size-2.5" />
              高単価
            </span>
          )}
          {item.ai_extracted && (
            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600">AI</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
          {item.brand && <span>🏷 {item.brand}</span>}
          {item.model_number && <span>#{item.model_number}</span>}
          {item.accessories && <span>📦 {item.accessories}</span>}
        </div>
        {quoteStr && (
          <div className="text-[11px] font-medium text-emerald-700">
            事前査定: {quoteStr}
            {item.quote_type && (
              <span className="ml-1 text-[10px] font-normal text-zinc-400">
                ({QUOTE_TYPE_LABELS[item.quote_type]})
              </span>
            )}
          </div>
        )}
        {item.estimated_price_min != null && (
          <div className="text-[11px] text-zinc-500">
            見込: ¥{item.estimated_price_min.toLocaleString("ja-JP")}
          </div>
        )}
        {item.notes && <p className="text-[11px] text-zinc-400 line-clamp-2">{item.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="rounded p-1 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600"
          onClick={onEdit}
          type="button"
          aria-label="編集"
        >
          <Pencil className="size-3" />
        </button>
        <button
          className="rounded p-1 hover:bg-red-50 text-zinc-400 hover:text-red-500"
          onClick={onDelete}
          type="button"
          aria-label="削除"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

function ItemForm({
  form,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  form: ItemFormValues;
  onChange: (v: ItemFormValues) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (key: keyof ItemFormValues, value: string) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="px-3 py-2.5 space-y-2 bg-violet-50/40">
      {/* 品名（必須） */}
      <div>
        <label className="text-[10px] text-zinc-500 font-medium">品名 *</label>
        <Input
          className="h-7 text-xs mt-0.5"
          value={form.item_name}
          onChange={(e) => set("item_name", e.target.value)}
          placeholder="例: ルイヴィトン バッグ"
        />
      </div>

      {/* ブランド・型番 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10px] text-zinc-500 font-medium">ブランド</label>
          <Input
            className="h-7 text-xs mt-0.5"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="例: Louis Vuitton"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-medium">型番</label>
          <Input
            className="h-7 text-xs mt-0.5"
            value={form.model_number}
            onChange={(e) => set("model_number", e.target.value)}
            placeholder="例: M41526"
          />
        </div>
      </div>

      {/* 状態 */}
      <div>
        <label className="text-[10px] text-zinc-500 font-medium">状態</label>
        <Select
          value={form.condition}
          onValueChange={(v) => set("condition", v)}
        >
          <SelectTrigger className="h-7 text-xs mt-0.5">
            <SelectValue placeholder="状態を選択" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(CONDITION_LABELS) as [InquiryItemCondition, string][]).map(
              ([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {k} — {v}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      {/* 付属品 */}
      <div>
        <label className="text-[10px] text-zinc-500 font-medium">付属品</label>
        <Input
          className="h-7 text-xs mt-0.5"
          value={form.accessories}
          onChange={(e) => set("accessories", e.target.value)}
          placeholder="例: 箱、保証書、ストラップ"
        />
      </div>

      {/* 見込金額 */}
      <div>
        <label className="text-[10px] text-zinc-500 font-medium">見込金額（スタッフ見込）</label>
        <Input
          className="h-7 text-xs mt-0.5"
          type="number"
          value={form.estimated_price_min}
          onChange={(e) => set("estimated_price_min", e.target.value)}
          placeholder="例: 30000"
        />
      </div>

      {/* 事前査定金額 */}
      <div>
        <label className="text-[10px] text-zinc-500 font-medium">事前査定金額</label>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          <Select
            value={form.quote_type}
            onValueChange={(v) => set("quote_type", v)}
          >
            <SelectTrigger className="h-7 text-xs w-24 shrink-0">
              <SelectValue placeholder="種別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upper" className="text-xs">上限</SelectItem>
              <SelectItem value="around" className="text-xs">前後</SelectItem>
              <SelectItem value="exact" className="text-xs">ちょうど</SelectItem>
              <SelectItem value="range" className="text-xs">範囲</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="h-7 text-xs min-w-0 flex-1"
            type="number"
            value={form.quote_price_min}
            onChange={(e) => set("quote_price_min", e.target.value)}
            placeholder="金額（円）"
          />
          {form.quote_type === "range" && (
            <Input
              className="h-7 text-xs min-w-0 flex-1"
              type="number"
              value={form.quote_price_max}
              onChange={(e) => set("quote_price_max", e.target.value)}
              placeholder="上限（円）"
            />
          )}
        </div>
      </div>

      {/* 備考 */}
      <div>
        <label className="text-[10px] text-zinc-500 font-medium">備考</label>
        <Textarea
          className="min-h-0 h-14 resize-none text-xs mt-0.5"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="その他補足"
        />
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-1.5 pt-1">
        <button
          className="rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
          onClick={onCancel}
          type="button"
        >
          <X className="size-3 inline mr-1" />
          キャンセル
        </button>
        <Button
          className="h-7 px-3 text-xs bg-indigo-500 hover:bg-indigo-600"
          disabled={!form.item_name.trim() || saving}
          onClick={onSave}
          type="button"
        >
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}
