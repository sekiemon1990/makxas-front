/**
 * GET /api/ai/usage
 *
 * 過去 N 日 (default 30) の Anthropic API 利用ログを集計して返す。
 * AI 管理ダッシュボードの統計に統合してコスト可視化に使う。
 *
 * クエリ:
 *   ?days=30 (1..90)
 *
 * recording (makxas-ast) の /api/ai/usage を Supabase 版に移植。
 */
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type AggregateBucket = {
  total_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
};

function emptyBucket(): AggregateBucket {
  return {
    total_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    cost_usd: 0,
  };
}

function addToBucket(
  bucket: AggregateBucket,
  d: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    cost_usd: number;
  },
): void {
  bucket.total_calls++;
  bucket.input_tokens += d.input_tokens;
  bucket.output_tokens += d.output_tokens;
  bucket.cache_creation_tokens += d.cache_creation_tokens;
  bucket.cache_read_tokens += d.cache_read_tokens;
  bucket.cost_usd += d.cost_usd;
}

function round(b: AggregateBucket): AggregateBucket {
  return { ...b, cost_usd: Number(b.cost_usd.toFixed(4)) };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const days = Math.max(
    1,
    Math.min(90, Number(url.searchParams.get("days") ?? 30) || 30),
  );

  const since = new Date(Date.now() - days * 86400000);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("api_usage_logs")
    .select(
      "category, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd, created_at",
    )
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("[ai/usage] supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overall = emptyBucket();
  const byCategory: Record<string, AggregateBucket> = {};
  const byModel: Record<string, AggregateBucket> = {};
  const byDay: Record<string, AggregateBucket> = {};

  for (const row of data ?? []) {
    addToBucket(overall, row);

    const cat = row.category ?? "unknown";
    if (!byCategory[cat]) byCategory[cat] = emptyBucket();
    addToBucket(byCategory[cat], row);

    const model = row.model ?? "unknown";
    if (!byModel[model]) byModel[model] = emptyBucket();
    addToBucket(byModel[model], row);

    const dayKey = row.created_at?.slice(0, 10);
    if (dayKey) {
      if (!byDay[dayKey]) byDay[dayKey] = emptyBucket();
      addToBucket(byDay[dayKey], row);
    }
  }

  return NextResponse.json({
    period_days: days,
    since: since.toISOString(),
    overall: round(overall),
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, round(v)]),
    ),
    by_model: Object.fromEntries(
      Object.entries(byModel).map(([k, v]) => [k, round(v)]),
    ),
    by_day: Object.fromEntries(
      Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, round(v)]),
    ),
  });
}
