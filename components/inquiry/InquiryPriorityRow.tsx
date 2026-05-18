"use client";

/**
 * 反響詳細パネルに表示する「AI 自動優先度」操作行。
 *
 * - 判定済みなら PriorityBadge + 根拠 + スコア + 「再判定」ボタンを表示
 * - 未判定なら「AI で優先度判定」ボタンのみ
 * - 判定中はローディング表示
 * - 成功時に親 (onUpdate) へ inquiry を更新通知 → リアルタイム反映
 */
import { useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import type { InquiryWithLead } from "@/types/database";
import { PriorityBadge } from "./PriorityBadge";

export function InquiryPriorityRow({
  inquiry,
  onUpdate,
}: {
  inquiry: InquiryWithLead;
  onUpdate: (next: InquiryWithLead) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPriority =
    inquiry.ai_priority === "high" ||
    inquiry.ai_priority === "medium" ||
    inquiry.ai_priority === "low";

  async function run(force = false) {
    setLoading(true);
    setError(null);
    try {
      const qs = force ? "?force=true" : "";
      const res = await fetch(
        `/api/ai/inquiry-priority/${encodeURIComponent(inquiry.id)}${qs}`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        priority?: "high" | "medium" | "low";
        score?: number;
        reason?: string;
        setAt?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      if (body.priority && typeof body.score === "number") {
        onUpdate({
          ...inquiry,
          ai_priority: body.priority,
          ai_priority_score: body.score,
          ai_priority_reason: body.reason ?? null,
          ai_priority_set_at: body.setAt ?? new Date().toISOString(),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {hasPriority && (
          <PriorityBadge
            priority={inquiry.ai_priority as "high" | "medium" | "low"}
            score={inquiry.ai_priority_score ?? null}
          />
        )}
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <Loader2 size={11} className="animate-spin" />
            AI が優先度を判定中…
          </span>
        ) : hasPriority ? (
          <button
            type="button"
            onClick={() => void run(true)}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-violet-600 transition-colors"
            title="既存判定を破棄して再判定 (force=true)"
          >
            <RefreshCw size={10} />
            再判定
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void run(false)}
            className="inline-flex items-center gap-1 rounded-md bg-violet-50 text-violet-700 hover:bg-violet-100 px-2 py-0.5 text-[11px] font-semibold transition-colors"
          >
            <Sparkles size={11} />
            AI で優先度判定
          </button>
        )}
      </div>
      {hasPriority && inquiry.ai_priority_reason && (
        <p className="text-[10px] text-zinc-500 leading-snug max-w-2xl">
          根拠: {inquiry.ai_priority_reason}
        </p>
      )}
      {error && (
        <p className="text-[10px] text-red-600 leading-snug">{error}</p>
      )}
    </div>
  );
}
