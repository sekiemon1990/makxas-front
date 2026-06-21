/**
 * AI イベント契約 (ai-kit AiEventContract) ビルダー — ADR-0029 準拠。
 *
 * makxas-front の AI 呼び出し結果を横断監査フォーマットに変換する。
 * 生成した contract は api_usage_logs.meta の `ai_event` キーに埋め込む。
 * 新テーブルを追加せず既存の api_usage_logs を拡張する軽量実装。
 */
import type { AiEventContract, UsageEnvelope } from "@makxas/ai-kit";

import { MODEL_COST_USD_PER_MTOK, type ModelId } from "./models";

const USD_TO_JPY = 155;

/** Anthropic usage オブジェクト → UsageEnvelope に変換 */
export function buildUsageEnvelope(
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
  model: ModelId,
): UsageEnvelope {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;

  const cost = MODEL_COST_USD_PER_MTOK[model];
  const effectiveInputUnits =
    inputTokens + cacheReadTokens * 0.1 + cacheWriteTokens * 1.25;
  const costUsd = cost
    ? (effectiveInputUnits * cost.input + outputTokens * cost.output) /
      1_000_000
    : 0;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    model,
    cost_usd: Number(costUsd.toFixed(6)),
    cost_jpy: Number((costUsd * USD_TO_JPY).toFixed(2)),
  };
}

/** AiEventContract を構築する。actor は呼び出し元が適宜オーバーライドできる。 */
export function buildAiEvent(params: {
  conversationId: string;
  usage: UsageEnvelope | null;
  action?: AiEventContract["action"];
  sourceRef?: AiEventContract["source_ref"];
  actorId?: string;
}): AiEventContract {
  return {
    source_system: "makxas-front",
    conversation_id: params.conversationId,
    actor: {
      id: params.actorId ?? "anonymous",
      type: "user",
    },
    tenant_scope: { id: "makxas", type: "tenant" },
    account_scope: { id: "makxas-front", type: "system" },
    source_ref: params.sourceRef ?? null,
    usage: params.usage,
    action: params.action ?? "executed",
  };
}
