/**
 * makxas-front デザイントークン
 *
 * UI/UX レビュー（2026-05-19）で散在していた色・余白・バッジを統一するための
 * シングルソース。新規実装時はここから参照すること。
 */

/* ----------------- カラー ----------------- */

/** ステータスバッジ用カラーセット（背景・文字・枠線） */
export const STATUS_COLORS = {
  new: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  in_progress: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  appointment_set: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  transferred: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
  pending: { bg: "bg-zinc-50", text: "text-zinc-700", border: "border-zinc-200", dot: "bg-zinc-500" },
  lost: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
  closed: { bg: "bg-zinc-100", text: "text-zinc-500", border: "border-zinc-200", dot: "bg-zinc-400" },
} as const;

export const STATUS_LABELS: Record<keyof typeof STATUS_COLORS, string> = {
  new: "新着",
  in_progress: "対応中",
  appointment_set: "アポ取得済",
  transferred: "引継完了",
  pending: "保留",
  lost: "失注",
  closed: "クローズ",
};

/** AI機能の統一カラー（紫）— 全 AI ボタンで使用 */
export const AI_COLOR = {
  bg: "bg-violet-50",
  text: "text-violet-700",
  border: "border-violet-200",
  hoverBg: "hover:bg-violet-100",
  active: "bg-violet-100 text-violet-800 border-violet-300",
  iconColor: "text-violet-500",
} as const;

/** レバー2（追加買取）カラー — MAKXAS思想 */
export const LEVER_TWO_COLOR = {
  bg: "bg-amber-50",
  text: "text-amber-700",
  border: "border-amber-200",
} as const;

/** 高単価カラー */
export const HIGH_VALUE_COLOR = {
  bg: "bg-rose-50",
  text: "text-rose-700",
  border: "border-rose-200",
} as const;

/* ----------------- 余白（8pxグリッド） ----------------- */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/* ----------------- タグ統一スタイル ----------------- */

/** 標準タグスタイル（rounded-md・薄背景・枠線あり） */
export const TAG_STYLE = "inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-700";

/** AI示唆タグ（紫系） */
export const AI_TAG_STYLE = "inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700";

/* ----------------- 未返信時間バッジ ----------------- */

/**
 * 未返信時間を「N分／N時間／N日」の日本語ラベル＋段階色に変換
 */
export function formatUnansweredBadge(hours: number): {
  label: string;
  variant: "normal" | "warn" | "danger";
  bg: string;
  text: string;
} {
  if (hours < 1) {
    return {
      label: `${Math.max(1, Math.round(hours * 60))}分未返信`,
      variant: "normal",
      bg: "bg-zinc-100",
      text: "text-zinc-700",
    };
  }
  if (hours < 24) {
    return {
      label: `${Math.round(hours)}時間未返信`,
      variant: "normal",
      bg: "bg-amber-50",
      text: "text-amber-700",
    };
  }
  const days = Math.floor(hours / 24);
  if (days < 3) {
    return {
      label: `${days}日未返信`,
      variant: "warn",
      bg: "bg-orange-100",
      text: "text-orange-800",
    };
  }
  return {
    label: `${days}日未返信`,
    variant: "danger",
    bg: "bg-rose-100",
    text: "text-rose-800",
  };
}

/* ----------------- 件数表示の統一 ----------------- */

/** 「N 件」を統一フォーマットで返す */
export function formatCount(n: number): string {
  return `${n.toLocaleString("ja-JP")} 件`;
}
