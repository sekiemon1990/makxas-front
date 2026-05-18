/**
 * AI API 利用ログ (Supabase 版)
 *
 * Supabase テーブル: `api_usage_logs` (019_api_usage_logs.sql)
 *
 * Anthropic API 1 コール = 1 レコード。トークン数とコストを蓄積し、
 * /api/ai/usage 経由でダッシュボードに集計表示する。
 *
 * recording (makxas-ast) の apps/admin/src/lib/ai/usage.ts を Supabase 版に移植。
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database";

import {
  MODEL_COST_USD_PER_MTOK,
  type AiCategory,
  type ModelId,
} from "./models";

/**
 * Anthropic API の usage オブジェクトからコスト計算 → Supabase に保存。
 *
 * 呼び出し側で `await` すること (fire-and-forget だと Vercel が早期に
 * レスポンスを返した際にログが欠損する)。失敗してもアプリの動作は
 * ブロックしない (try/catch 内で握りつぶし console.error のみ)。
 *
 * 使用例:
 *   const res = await anthropic.messages.create({ ... });
 *   await logAiUsage({
 *     category: "suggest",
 *     model: "claude-haiku-4-5-20251001",
 *     usage: res.usage,
 *     endpoint: "/api/ai/suggest",
 *     inquiryId,
 *   });
 */
export async function logAiUsage(args: {
  category: AiCategory;
  model: ModelId;
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
  endpoint: string;
  inquiryId?: string | null;
  messageId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const inputTokens = args.usage.input_tokens ?? 0;
    const outputTokens = args.usage.output_tokens ?? 0;
    const cacheCreationTokens = args.usage.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = args.usage.cache_read_input_tokens ?? 0;

    const cost = MODEL_COST_USD_PER_MTOK[args.model];
    if (!cost) {
      // 型上は ModelId で守られているが、将来モデル追加時の対応漏れ用に防御
      console.warn(`[aiUsage] no cost rate for model: ${args.model}`);
      return;
    }

    // キャッシュ単価の標準目安:
    //   cache_read   ≈ input × 0.1
    //   cache_create ≈ input × 1.25 (5min ephemeral)
    // 簡易見積もりとして effectiveInputUnits を input 単価で換算する。
    const effectiveInputUnits =
      inputTokens + cacheReadTokens * 0.1 + cacheCreationTokens * 1.25;
    const costUsd =
      (effectiveInputUnits * cost.input + outputTokens * cost.output) /
      1_000_000;

    const supabase = createServiceClient();
    const { error } = await supabase.from("api_usage_logs").insert({
      category: args.category,
      model: args.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_tokens: cacheCreationTokens,
      cache_read_tokens: cacheReadTokens,
      cost_usd: Number(costUsd.toFixed(6)),
      endpoint: args.endpoint,
      inquiry_id: args.inquiryId ?? null,
      message_id: args.messageId ?? null,
      // meta は任意の Record。Supabase 型は Json なので cast (実態は JSONB)
      meta: (args.meta ?? {}) as Json,
    });
    if (error) {
      console.error("[aiUsage] log write failed:", error.message);
    }
  } catch (e) {
    // ログ書込失敗はアプリの動作を止めない
    console.error("[aiUsage] unexpected error:", e);
  }
}
