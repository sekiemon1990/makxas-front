/**
 * PR32: LTV予測モデル
 *
 * POST /api/ai/predict-ltv
 * Body: { lead_id: string }
 *
 * リード属性（顧客プロファイル・査定履歴・反響履歴）から、
 * 今後 12 ヶ月の追加買取見込みを Haiku が推定する。
 *
 * MAKXAS思想：レバー2 視点で「再訪・追加売却」の期待値を数値化。
 * 営業優先順位の判断材料に使う。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiUsage } from "@/lib/ai/usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001" as const;

const SYSTEM_PROMPT = `あなたはマクサスのリユース営業データ分析AIです。
リード（見込み客）の属性・履歴から、今後12ヶ月の追加買取見込みを推定してください。

## MAKXAS営業思想（必須前提）
顧客単価 = 年齢 × 収入/資産 × 売却動機 の掛け算。レバー2（追加買取）こそ伸ばし余地。
高単価カテゴリ: 貴金属・時計・ブランド品・骨董品。

## 出力（JSON のみ・説明不要）
{
  "predicted_ltv_12mo": 数値（円・今後12ヶ月の追加買取見込み合計）,
  "confidence": "high" | "medium" | "low",
  "tier": "platinum" | "gold" | "silver" | "bronze",
  "reasoning": "予測根拠（80文字以内）",
  "next_action": "営業に推奨する次のアクション（60文字以内）",
  "risk_factors": ["失注リスク要因", ...] (最大3つ・各30文字以内)
}

## tier 基準（追加買取見込み）
- platinum: 300,000円以上
- gold: 100,000円以上
- silver: 30,000円以上
- bronze: 30,000円未満`;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    lead_id?: string;
  } | null;
  if (!body?.lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // リード本体
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", body.lead_id)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  // 反響履歴（最新10件・customer_profile 含む）
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, channel, status, customer_profile, suggested_items, approach_hint, created_at")
    .eq("lead_id", body.lead_id)
    .order("created_at", { ascending: false })
    .limit(10);

  // 査定商品履歴（最新20件）
  const { data: items } = await supabase
    .from("inquiry_items")
    .select("item_name, brand, condition, estimated_price_min, quote_price_min, ai_extracted")
    .in(
      "inquiry_id",
      (inquiries ?? []).map((i) => i.id),
    )
    .limit(20);

  // アポ履歴
  const { data: appts } = await supabase
    .from("appointments")
    .select("scheduled_at, item_category, status, additional_items_confirmed")
    .eq("lead_id", body.lead_id)
    .limit(20);

  const ctx = {
    display_name: (lead as { display_name?: string }).display_name ?? null,
    first_channel: (lead as { first_channel?: string }).first_channel ?? null,
    inquiry_count: inquiries?.length ?? 0,
    profiles: (inquiries ?? []).map((i) => i.customer_profile).filter(Boolean).slice(0, 3),
    suggested_items: (inquiries ?? [])
      .flatMap((i) => (i.suggested_items as string[] | null) ?? [])
      .slice(0, 10),
    item_summary: (items ?? []).map((i) => ({
      n: i.item_name,
      b: i.brand,
      p: i.quote_price_min ?? i.estimated_price_min,
    })).slice(0, 15),
    appt_summary: (appts ?? []).map((a) => ({
      cat: a.item_category,
      st: a.status,
      add: a.additional_items_confirmed,
    })),
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `以下のリード情報から、今後12ヶ月の追加買取見込み LTV を推定してください。\n\n${JSON.stringify(ctx, null, 2)}`,
        },
      ],
    });

    await logAiUsage({
      category: "inquiry-priority", // 暫定: ltv-predict 専用カテゴリ未追加
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/predict-ltv",
      inquiryId: null,
      messageId: null,
      meta: { lead_id: body.lead_id },
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: text },
        { status: 500 },
      );
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "predict-ltv failed" },
      { status: 500 },
    );
  }
}
