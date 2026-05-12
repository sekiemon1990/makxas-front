"use client";

import { useState } from "react";
import { GitMerge, Phone, Loader2, X, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type DuplicateLead = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  first_channel: string | null;
};

type Props = {
  primaryLead: { id: string; display_name: string | null; phone: string | null };
  duplicates: DuplicateLead[];
  onMerged: () => void;
  onClose: () => void;
};

export function LeadMergeModal({ primaryLead, duplicates, onMerged, onClose }: Props) {
  const [merging, setMerging] = useState<string | null>(null);
  const [merged, setMerged] = useState<string[]>([]);

  async function handleMerge(secondary: DuplicateLead) {
    if (!confirm(`「${secondary.display_name ?? secondary.phone ?? "名前なし"}」を「${primaryLead.display_name ?? primaryLead.phone ?? "このリード"}」に統合しますか？\n\n統合後、元のリードはアーカイブされます。`)) return;

    setMerging(secondary.id);
    try {
      const res = await fetch("/api/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryLeadId: primaryLead.id,
          secondaryLeadId: secondary.id,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setMerged((prev) => [...prev, secondary.id]);
      onMerged();
    } catch {
      alert("統合に失敗しました");
    } finally {
      setMerging(null);
    }
  }

  const remaining = duplicates.filter((d) => !merged.includes(d.id));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <GitMerge className="size-4 text-red-500" />
              重複リードの統合
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              選択したリードの反響・連絡先がすべて移行されます
            </p>
          </div>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" type="button">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* 統合先（primary） */}
          <div className="rounded-xl border-2 border-zinc-900 bg-zinc-50 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-1">統合先（メインリード）</p>
            <p className="text-sm font-semibold text-zinc-900">{primaryLead.display_name ?? "名前未登録"}</p>
            {primaryLead.phone && (
              <p className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                <Phone className="size-3" />{primaryLead.phone}
              </p>
            )}
          </div>

          {/* 重複候補 */}
          <p className="text-xs font-medium text-zinc-500">以下のリードを統合できます</p>
          {remaining.length === 0 ? (
            <p className="py-4 text-center text-sm text-emerald-600 font-medium">✓ 重複はすべて解消されました</p>
          ) : (
            remaining.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{d.display_name ?? "名前未登録"}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                    {d.phone && <span className="flex items-center gap-0.5"><Phone className="size-3" />{d.phone}</span>}
                    {d.email && <span>{d.email}</span>}
                    {d.first_channel && <span>初回: {d.first_channel}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="shrink-0 h-8 gap-1.5 text-xs"
                  disabled={merging !== null}
                  onClick={() => handleMerge(d)}
                >
                  {merging === d.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3.5" />
                  )}
                  統合
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-zinc-100 px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full text-xs">閉じる</Button>
        </div>
      </div>
    </div>
  );
}
