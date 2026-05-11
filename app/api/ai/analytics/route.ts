import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AutoSendRule, AiLearningRun } from "@/types/database";

export const runtime = "nodejs";

type MsgRow = {
  id: string;
  ai_suggested: boolean;
  ai_edited: boolean | null;
  ai_theme_changed: boolean | null;
  ai_edit_reason: string | null;
  ai_auto_sent: boolean;
  inquiries: { msg_category: string | null } | null;
};

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, ai_suggested, ai_edited, ai_theme_changed, ai_edit_reason, ai_auto_sent, inquiries!inner(msg_category)")
    .eq("ai_suggested", true)
    .eq("direction", "outbound")
    .gte("created_at", since);

  const messages = (rawMessages ?? []) as MsgRow[];

  const { data: rules } = await supabase.from("auto_send_rules").select("*");
  const { data: runs } = await supabase
    .from("ai_learning_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);

  // カテゴリ別集計
  const categoryMap: Record<string, {
    total: number; edited: number; theme_changed: number;
    auto_sent: number; edit_reasons: Record<string, number>;
  }> = {};

  for (const m of messages) {
    const cat = m.inquiries?.msg_category ?? "unknown";
    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, edited: 0, theme_changed: 0, auto_sent: 0, edit_reasons: {} };
    }
    categoryMap[cat].total++;
    if (m.ai_edited) categoryMap[cat].edited++;
    if (m.ai_theme_changed) categoryMap[cat].theme_changed++;
    if (m.ai_auto_sent) categoryMap[cat].auto_sent++;
    if (m.ai_edit_reason) {
      categoryMap[cat].edit_reasons[m.ai_edit_reason] =
        (categoryMap[cat].edit_reasons[m.ai_edit_reason] ?? 0) + 1;
    }
  }

  const rulesMap = Object.fromEntries(
    ((rules ?? []) as AutoSendRule[]).map(r => [r.msg_category, r])
  );

  const categories = Object.entries(categoryMap).map(([cat, stats]) => {
    const rule = rulesMap[cat];
    const editRate = stats.total > 0 ? stats.edited / stats.total : null;
    return {
      msg_category: cat,
      total_ai_sent: stats.total,
      edit_rate: editRate !== null ? Number(editRate.toFixed(3)) : null,
      theme_change_rate: stats.total > 0 ? Number((stats.theme_changed / stats.total).toFixed(3)) : null,
      auto_sent_count: stats.auto_sent,
      edit_reasons: stats.edit_reasons,
      auto_send_rule: rule ?? null,
      is_auto_eligible: rule
        ? (editRate !== null && editRate <= rule.edit_rate_threshold && stats.total >= rule.min_sample_size)
        : false,
    };
  });

  const totalAiSent = messages.length;
  const totalEdited = messages.filter(m => m.ai_edited).length;

  return NextResponse.json({
    categories,
    recent_runs: (runs ?? []) as AiLearningRun[],
    total_ai_sent_30d: totalAiSent,
    overall_edit_rate: totalAiSent > 0 ? Number((totalEdited / totalAiSent).toFixed(3)) : null,
  });
}
