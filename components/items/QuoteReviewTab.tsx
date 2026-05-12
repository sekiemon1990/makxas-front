"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { ChannelBadge } from "@/components/badges";
import type { InquiryItemQuoteType } from "@/types/database";

type QuoteType = InquiryItemQuoteType | null;

function formatQuote(quoteType: QuoteType, priceMin: number | null, priceMax: number | null): string | null {
  if (!quoteType || priceMin == null) return null;
  const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  switch (quoteType) {
    case "upper":  return `最大 ${fmt(priceMin)}`;
    case "around": return `${fmt(priceMin)} 前後`;
    case "exact":  return fmt(priceMin);
    case "range":  return priceMax != null ? `${fmt(priceMin)}〜${fmt(priceMax)}` : `${fmt(priceMin)}〜`;
  }
}

type ReviewItem = {
  id: string;
  inquiry_id: string;
  lead_id: string | null;
  item_name: string;
  brand: string | null;
  condition: string | null;
  quote_type: string | null;
  quote_price_min: number | null;
  quote_price_max: number | null;
  quote_status: "pending" | "approved" | "needs_correction";
  quote_review_note: string | null;
  ai_extracted: boolean;
  created_at: string;
  inquiry_channel: string | null;
  inquiry_subject: string | null;
  inquiry_assigned_name: string | null;
  lead_name: string | null;
  reviewer_staff_id: string;
};

const STATUS_LABELS = {
  pending: { label: "未確認", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "承認済", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  needs_correction: { label: "要修正", className: "bg-red-50 text-red-700 border-red-200" },
} as const;

export function QuoteReviewTab({
  items: initialItems,
  reviewerStaffId,
}: {
  items: ReviewItem[];
  reviewerStaffId: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "needs_correction">("all");
  const [noteModal, setNoteModal] = useState<{ itemId: string; note: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const filtered = items.filter((item) =>
    filterStatus === "all" ? true : item.quote_status === filterStatus
  );

  const pendingCount = items.filter((i) => i.quote_status === "pending").length;

  const handleApprove = async (itemId: string) => {
    setSaving(itemId);
    const res = await fetch(`/api/inquiry-items/${itemId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", reviewer_staff_id: reviewerStaffId }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quote_status: "approved" } : i));
    }
    setSaving(null);
  };

  const handleNeedsCorrection = async () => {
    if (!noteModal) return;
    setSaving(noteModal.itemId);
    const res = await fetch(`/api/inquiry-items/${noteModal.itemId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "needs_correction",
        note: noteModal.note,
        reviewer_staff_id: reviewerStaffId,
      }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) =>
        i.id === noteModal.itemId
          ? { ...i, quote_status: "needs_correction", quote_review_note: noteModal.note }
          : i
      ));
      setNoteModal(null);
    }
    setSaving(null);
  };

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "approved", "needs_correction"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
              filterStatus === s
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {s === "all"
              ? `すべて（${items.length}）`
              : s === "pending"
              ? `未確認${pendingCount > 0 ? `（${pendingCount}）` : ""}`
              : s === "approved"
              ? "承認済"
              : "要修正"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          {filterStatus === "pending" ? "未確認の査定はありません ✅" : "該当する査定がありません"}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                <th className="px-4 py-2.5 text-left font-medium">商品名</th>
                <th className="px-4 py-2.5 text-left font-medium">事前査定額</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">担当者</th>
                <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">顧客 / チャネル</th>
                <th className="px-4 py-2.5 text-left font-medium">ステータス</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((item) => {
                const quoteStr = formatQuote(
                  item.quote_type as QuoteType,
                  item.quote_price_min,
                  item.quote_price_max,
                );
                const statusInfo = STATUS_LABELS[item.quote_status];

                return (
                  <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors">
                    {/* 商品名 */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800">{item.item_name}</div>
                      {item.brand && (
                        <div className="text-[11px] text-zinc-400">🏷 {item.brand}</div>
                      )}
                    </td>

                    {/* 事前査定額 */}
                    <td className="px-4 py-3">
                      {quoteStr ? (
                        <span className="text-sm font-semibold text-emerald-700">{quoteStr}</span>
                      ) : (
                        <span className="text-zinc-300 text-xs">未入力</span>
                      )}
                    </td>

                    {/* 担当者 */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-zinc-600">
                        {item.inquiry_assigned_name ?? "未アサイン"}
                      </span>
                    </td>

                    {/* 顧客/チャネル */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        {item.lead_id ? (
                          <Link
                            href={`/leads/${item.lead_id}`}
                            className="text-xs text-violet-700 hover:underline font-medium"
                          >
                            {item.lead_name ?? "名前未登録"}
                          </Link>
                        ) : null}
                        {item.inquiry_channel ? (
                          <Link
                            href={`/inbox?id=${item.inquiry_id}`}
                            className="inline-flex items-center gap-1 hover:opacity-80"
                          >
                            <ChannelBadge channel={item.inquiry_channel as Parameters<typeof ChannelBadge>[0]["channel"]} />
                            <ExternalLink className="size-2.5 text-zinc-400" />
                          </Link>
                        ) : null}
                      </div>
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                      {item.quote_status === "needs_correction" && item.quote_review_note && (
                        <p className="mt-0.5 text-[10px] text-red-500 line-clamp-1">{item.quote_review_note}</p>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 会話を確認 */}
                        <Link
                          href={`/inbox?id=${item.inquiry_id}`}
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
                        >
                          <ExternalLink className="size-3" />
                          確認
                        </Link>
                        {/* 承認 */}
                        <button
                          type="button"
                          disabled={saving === item.id || item.quote_status === "approved"}
                          onClick={() => void handleApprove(item.id)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                        >
                          <CheckCircle className="size-3" />
                          OK
                        </button>
                        {/* 要修正 */}
                        <button
                          type="button"
                          disabled={saving === item.id}
                          onClick={() => setNoteModal({ itemId: item.id, note: "" })}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          <AlertTriangle className="size-3" />
                          要修正
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 要修正コメントモーダル */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-sm font-semibold text-zinc-800">修正コメントを入力</h3>
            <p className="mb-3 text-xs text-zinc-500">
              担当スタッフの内部メモに自動記入されます
            </p>
            <textarea
              className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
              rows={3}
              placeholder="例: 査定金額が相場より高すぎます。再確認してください。"
              value={noteModal.note}
              onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => void handleNeedsCorrection()}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? "送信中…" : "要修正として送信"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
