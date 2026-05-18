/**
 * Anthropic モデル定義と単価。
 *
 * recording (makxas-ast) の apps/admin/src/lib/ai/models.ts と同等。
 * カテゴリは front 固有 (suggest / chat / extract-items / analyze-edit / learning)。
 */

/** front で使う AI カテゴリ */
export type AiCategory =
  | "suggest" // 反響メッセージへの返信案生成 (Haiku)
  | "chat" // 管理画面 AI チャット (Sonnet, Tool Use)
  | "extract-items" // 商品情報抽出 (Vision, Haiku)
  | "analyze-edit" // 修正理由ラベル生成 (Haiku)
  | "learning"; // AI 学習パイプライン (Sonnet)

/** Anthropic モデル ID */
export type ModelId =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6"
  | "claude-opus-4-7";

/** カテゴリ別の既定モデル */
const MODEL_BY_CATEGORY: Record<AiCategory, ModelId> = {
  suggest: "claude-haiku-4-5-20251001",
  chat: "claude-sonnet-4-6",
  "extract-items": "claude-haiku-4-5-20251001",
  "analyze-edit": "claude-haiku-4-5-20251001",
  learning: "claude-sonnet-4-6",
};

/** カテゴリに応じた推奨モデルを返す */
export function selectModel(category: AiCategory): ModelId {
  return MODEL_BY_CATEGORY[category];
}

/**
 * モデル別の per-million-token コスト目安 (USD)。
 * Anthropic 公式 (2026年5月時点)。
 */
export const MODEL_COST_USD_PER_MTOK: Record<
  ModelId,
  { input: number; output: number }
> = {
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
};

/** UI 表示用ラベル */
export const CATEGORY_LABELS: Record<AiCategory, string> = {
  suggest: "返信サジェスト",
  chat: "AIチャット",
  "extract-items": "商品抽出 (Vision)",
  "analyze-edit": "修正理由分析",
  learning: "プロンプト学習",
};

/** UI で列挙する場合に使うカテゴリ一覧 */
export const AI_CATEGORIES: AiCategory[] = [
  "suggest",
  "chat",
  "extract-items",
  "analyze-edit",
  "learning",
];
