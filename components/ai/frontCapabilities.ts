/**
 * makxas-front (インサイドセールス) の AI チャットでできることを定義。
 *
 * AI は Tool Use で以下を参照できる:
 *   - get_summary:  リード・反響・アポ集計（件数・成約率・対応漏れ）
 *   - search_data:  キーワード検索（顧客名・反響内容・対応履歴）
 *
 * + AI返信サジェスト・自動学習による継続改善も内部的に動作。
 */
import { BarChart3, Users, Search, MessageCircle } from "lucide-react";
import type { CapabilityCategory } from "./AiCapabilityIntro";

export const FRONT_CAPABILITIES: CapabilityCategory[] = [
  {
    id: "summary",
    icon: BarChart3,
    tone: "text-blue-600 bg-blue-50",
    title: "反響サマリー",
    description: "件数・成約率・チャネル別の概況",
    examples: [
      "今月の反響件数とチャネル別内訳を教えて",
      "先週と今週の反響数を比較して",
      "成約率が下がっているブランドは？",
    ],
  },
  {
    id: "rep-analysis",
    icon: Users,
    tone: "text-emerald-600 bg-emerald-50",
    title: "対応状況・担当別",
    description: "誰がどれだけ捌けているか",
    examples: [
      "未対応のリードが多い担当は？",
      "返信時間が早い担当者トップ3",
      "対応漏れがある反響を一覧で",
    ],
  },
  {
    id: "search",
    icon: Search,
    tone: "text-indigo-600 bg-indigo-50",
    title: "リード・反響の検索",
    description: "特定の顧客や反響を素早く検索",
    examples: [
      "○○様の対応履歴を要約して",
      "直近のクレーム反響を出して",
      "高優先・未対応のリードを一覧で",
    ],
  },
  {
    id: "ai-quality",
    icon: MessageCircle,
    tone: "text-amber-600 bg-amber-50",
    title: "AI返信の改善",
    description: "編集パターンから学習の手がかりを発見",
    examples: [
      "編集率が高いプロンプトはどれ？",
      "AI返信が編集される理由の上位は？",
      "今週の学習対象になりそうな編集パターン",
    ],
  },
];

/** ウィジェット向けの短縮版（2 カテゴリ） */
export const FRONT_CAPABILITIES_COMPACT: CapabilityCategory[] = [
  FRONT_CAPABILITIES[0]!, // 反響サマリー
  FRONT_CAPABILITIES[2]!, // リード検索
];
