import type { InquiryChannel, InquiryStatus } from "@/types/database";

export const statusMeta: Record<
  InquiryStatus,
  { label: string; className: string }
> = {
  // UI/UXレビュー B2: コントラスト強化（背景塗りつぶし + font-semibold）
  // 失注・完了はグレースケール寄りに沈ませて視線分離を強める
  new: {
    label: "新着",
    className: "border-blue-300 bg-blue-100 text-blue-800 font-semibold",
  },
  in_progress: {
    label: "対応中",
    className: "border-amber-300 bg-amber-100 text-amber-800 font-semibold",
  },
  pending: {
    label: "保留",
    className: "border-zinc-300 bg-zinc-100 text-zinc-700 font-semibold",
  },
  appointment_set: {
    label: "アポ取得済",
    className: "border-emerald-300 bg-emerald-100 text-emerald-800 font-semibold",
  },
  transferred: {
    label: "引継完了",
    className: "border-indigo-300 bg-indigo-100 text-indigo-800 font-semibold",
  },
  lost: {
    label: "失注",
    className: "border-zinc-200 bg-zinc-50 text-zinc-500 line-through",
  },
  closed: {
    label: "完了",
    className: "border-zinc-200 bg-zinc-50 text-zinc-500",
  },
};

export const channelMeta: Record<
  InquiryChannel,
  { label: string; shortLabel: string; className: string }
> = {
  line: {
    label: "LINE",
    shortLabel: "L",
    className: "border-green-200 bg-green-100 text-green-800",
  },
  phone: {
    label: "電話",
    shortLabel: "TEL",
    className: "border-yellow-200 bg-yellow-100 text-yellow-900",
  },
  web_form: {
    label: "フォーム",
    shortLabel: "W",
    className: "border-sky-200 bg-sky-100 text-sky-800",
  },
  email: {
    label: "メール",
    shortLabel: "M",
    className: "border-zinc-200 bg-zinc-100 text-zinc-700",
  },
  hikakaku: {
    label: "ヒカカク",
    shortLabel: "ヒ",
    className: "border-red-200 bg-red-100 text-red-800",
  },
  uridoki: {
    label: "ウリドキ",
    shortLabel: "ウ",
    className: "border-violet-200 bg-violet-100 text-violet-800",
  },
  oikura: {
    label: "おいくら",
    shortLabel: "お",
    className: "border-orange-200 bg-orange-100 text-orange-800",
  },
};

export const statusFilters: Array<{
  value: InquiryStatus | "all";
  label: string;
}> = [
  { value: "all", label: "全て" },
  { value: "new", label: "新着" },
  { value: "in_progress", label: "対応中" },
  { value: "pending", label: "保留" },
  { value: "appointment_set", label: "アポ取得済" },
  { value: "transferred", label: "引継完了" },
  { value: "lost", label: "失注" },
  { value: "closed", label: "完了" },
];

export const channelFilters: InquiryChannel[] = [
  "line",
  "web_form",
  "email",
  "oikura",
  "uridoki",
  "hikakaku",
];

export const categoryOptions = [
  "貴金属",
  "時計",
  "ブランド品",
  "骨董品",
  "スマートフォン",
  "PC・タブレット",
  "ゲーム機",
  "カメラ",
  "楽器",
  "その他",
];

/** 高価古物カテゴリ（追加買取の最優先ターゲット） */
export const HIGH_VALUE_CATEGORIES = ["貴金属", "時計", "ブランド品", "骨董品"] as const;

/** この金額以上（円）の事前査定・見込み金額は ⭐ 高単価バッジを表示 */
export const HIGH_VALUE_PRICE_THRESHOLD = 30000;

/** 追加買取の提案対象とする中古価格の最低ライン（円）—— これ未満の商材は提案しない */
export const BUYOUT_MIN_THRESHOLD = 5000;
