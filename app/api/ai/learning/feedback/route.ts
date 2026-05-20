/**
 * PR41: 査定結果フィードバック学習 - 集計API
 *
 * GET /api/ai/learning/feedback?days=30
 *
 * AI 予測（事前査定・優先度・LTV予測）と実際の core_result_amount を
 * 比較し、AI 精度の集計値を返す。
 *
 * MAKXAS思想：レバー2の AI が正しく動いているかを定量的に把握。
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();

  // 結果が返ってきた完了アポを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appts } = await (supabase as any)
    .from("appointments")
    .select(
      "id, status, core_result_amount, core_result_received_at, item_category, additional_items_confirmed, inquiry:inquiry_id(ai_priority, customer_profile)",
    )
    .not("core_result_received_at", "is", null)
    .gte("core_result_received_at", since);

  const rows = (appts ?? []) as Array<{
    status: string;
    core_result_amount: number | null;
    item_category: string | null;
    additional_items_confirmed: Record<string, boolean> | null;
    inquiry: { ai_priority: string | null; customer_profile: { age_group?: string; income_level?: string } | null } | null;
  }>;

  const won = rows.filter((r) => r.status === "completed");
  const lost = rows.filter((r) => r.status === "cancelled");
  const totalAmount = won.reduce((a, r) => a + (r.core_result_amount ?? 0), 0);
  const avgAmount = won.length > 0 ? Math.round(totalAmount / won.length) : 0;

  // 優先度別の成約率
  const byPriority: Record<string, { total: number; won: number; revenue: number }> = {
    high: { total: 0, won: 0, revenue: 0 },
    medium: { total: 0, won: 0, revenue: 0 },
    low: { total: 0, won: 0, revenue: 0 },
    unknown: { total: 0, won: 0, revenue: 0 },
  };
  for (const r of rows) {
    const p = (r.inquiry?.ai_priority ?? "unknown").toLowerCase();
    const bucket = byPriority[p] ?? byPriority.unknown;
    bucket.total++;
    if (r.status === "completed") {
      bucket.won++;
      bucket.revenue += r.core_result_amount ?? 0;
    }
  }
  const priorityStats = Object.entries(byPriority)
    .filter(([, v]) => v.total > 0)
    .map(([key, v]) => ({
      priority: key,
      total: v.total,
      won: v.won,
      win_rate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0,
      avg_revenue: v.won > 0 ? Math.round(v.revenue / v.won) : 0,
    }));

  // 顧客プロファイル別: 高単価層 vs 一般
  const highValueProfile = rows.filter(
    (r) =>
      r.inquiry?.customer_profile?.age_group === "middle_senior" &&
      r.inquiry?.customer_profile?.income_level === "affluent",
  );
  const otherProfile = rows.filter((r) => !(
    r.inquiry?.customer_profile?.age_group === "middle_senior" &&
    r.inquiry?.customer_profile?.income_level === "affluent"
  ));
  const hvWon = highValueProfile.filter((r) => r.status === "completed");
  const otWon = otherProfile.filter((r) => r.status === "completed");

  // 追加品確認の有無と成約金額の相関
  const withAdditional = won.filter(
    (r) =>
      r.additional_items_confirmed &&
      typeof r.additional_items_confirmed === "object" &&
      Object.values(r.additional_items_confirmed).some((v) => v === true),
  );
  const withoutAdditional = won.filter(
    (r) =>
      !r.additional_items_confirmed ||
      typeof r.additional_items_confirmed !== "object" ||
      !Object.values(r.additional_items_confirmed).some((v) => v === true),
  );
  const additionalAvg = withAdditional.length > 0
    ? Math.round(withAdditional.reduce((a, r) => a + (r.core_result_amount ?? 0), 0) / withAdditional.length)
    : 0;
  const noAdditionalAvg = withoutAdditional.length > 0
    ? Math.round(withoutAdditional.reduce((a, r) => a + (r.core_result_amount ?? 0), 0) / withoutAdditional.length)
    : 0;

  return NextResponse.json({
    period_days: days,
    total_results: rows.length,
    won: won.length,
    lost: lost.length,
    win_rate: rows.length > 0 ? Math.round((won.length / rows.length) * 100) : 0,
    total_revenue: totalAmount,
    avg_revenue_won: avgAmount,
    by_priority: priorityStats,
    high_value_profile: {
      total: highValueProfile.length,
      won: hvWon.length,
      win_rate: highValueProfile.length > 0 ? Math.round((hvWon.length / highValueProfile.length) * 100) : 0,
      avg_revenue: hvWon.length > 0 ? Math.round(hvWon.reduce((a, r) => a + (r.core_result_amount ?? 0), 0) / hvWon.length) : 0,
    },
    other_profile: {
      total: otherProfile.length,
      won: otWon.length,
      win_rate: otherProfile.length > 0 ? Math.round((otWon.length / otherProfile.length) * 100) : 0,
      avg_revenue: otWon.length > 0 ? Math.round(otWon.reduce((a, r) => a + (r.core_result_amount ?? 0), 0) / otWon.length) : 0,
    },
    additional_confirm_impact: {
      with_additional_count: withAdditional.length,
      without_additional_count: withoutAdditional.length,
      with_additional_avg: additionalAvg,
      without_additional_avg: noAdditionalAvg,
      lift_pct: noAdditionalAvg > 0
        ? Math.round(((additionalAvg - noAdditionalAvg) / noAdditionalAvg) * 100)
        : null,
    },
  });
}
