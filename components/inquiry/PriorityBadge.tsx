"use client";

/**
 * 反響の AI 自動優先度バッジ。
 * inquiries.ai_priority (high/medium/low) を色分けで表示。
 */
import { ChevronsUp, Equal, ChevronsDown } from "lucide-react";

type Priority = "high" | "medium" | "low";

const LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const TONE: Record<Priority, string> = {
  high: "text-red-700 bg-red-50 border-red-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-zinc-500 bg-zinc-50 border-zinc-200",
};

function icon(p: Priority) {
  switch (p) {
    case "high":
      return ChevronsUp;
    case "medium":
      return Equal;
    case "low":
      return ChevronsDown;
  }
}

export function PriorityBadge({
  priority,
  score,
  compact = false,
}: {
  priority: Priority;
  score?: number | null;
  compact?: boolean;
}) {
  const Icon = icon(priority);
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} font-semibold rounded-full border ${TONE[priority]}`}
      title={
        typeof score === "number"
          ? `AI 優先度: ${LABEL[priority]} (スコア ${score}/100)`
          : `AI 優先度: ${LABEL[priority]}`
      }
    >
      <Icon size={compact ? 9 : 11} />
      AI {LABEL[priority]}
      {!compact && typeof score === "number" && (
        <span className="opacity-60">({score})</span>
      )}
    </span>
  );
}
