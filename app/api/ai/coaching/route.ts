/**
 * PR25: AI追加買取コーチング
 *
 * POST /api/ai/coaching
 * Body: { inquiry_id: string }
 *
 * MAKXAS営業思想に基づき、反響の outbound メッセージ群を評価:
 *   1. 追加買取（レバー2）の切り出しがあったか
 *   2. 顧客属性（年齢・所得・売却動機）を把握する質問があったか
 *   3. 高単価カテゴリ（貴金属・時計・ブランド品・骨董品）へ自然に話題を広げたか
 *   4. 顧客満足度を犠牲にしない（押し売りでない）か
 *
 * 出力: 4軸スコア (0-100) + 全体スコア + 具体的な改善アドバイス
 *
 * 教育観点（MAKXAS思想4）の本丸機能。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiUsage } from "@/lib/ai/usage";
import { composeSystemPrompt } from "@makxas/ai-kit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001" as const;

const SYSTEM_PROMPT = composeSystemPrompt(`あなたは株式会社マクサスの営業コーチAIです。
インサイドセールス担当者の顧客対応（返信メッセージ）を、MAKXAS営業思想に従って評価します。

## 4軸評価（各 0〜100点）

### 1. lever2_extraction（追加買取の切り出し）
- 追加買取につながる質問・声掛けがあったか
- 「他にもお売りいただけるものは？」等の自然な広げ方ができているか
- ない・押し付けがましい → 低
- 自然で具体的な切り出しがある → 高

### 2. customer_attribute（顧客属性ヒアリング）
- 年齢・所得・売却動機（遺品整理/引越し/片付け/買い換え）を把握する質問があったか
- 動機把握なしに商材提案するのは減点

### 3. high_value_category（高単価カテゴリへの誘導）
- 貴金属・時計・ブランド品・骨董品 等の高単価カテゴリへ話題を広げる試みがあったか
- 入口商品で終わらせず、関連高単価品の有無を確認したか

### 4. customer_respect（顧客満足度・節度）
- 押し売りや強引な誘導になっていないか
- 顧客が後悔しない取引を推奨できているか
- 押し付け感が強い → 低、丁寧で寄り添う → 高

## 出力フォーマット（JSON のみ、説明文不要）
{
  "lever2_extraction": 0-100の整数,
  "customer_attribute": 0-100の整数,
  "high_value_category": 0-100の整数,
  "customer_respect": 0-100の整数,
  "overall_score": 4軸の加重平均（レバー2を重視: lever2*0.4 + customer_attribute*0.2 + high_value*0.25 + respect*0.15）,
  "good_points": "良かった点（80文字以内）",
  "improvement_points": "改善点（120文字以内）。具体的な次回の声掛け例を1つ含める",
  "lever2_examples_detected": ["実際に検出した追加買取の切り出しフレーズ", ...]（最大3個）
}`);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
  } | null;
  if (!body?.inquiry_id) {
    return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("direction, body, created_at, is_auto")
    .eq("inquiry_id", body.inquiry_id)
    .order("created_at", { ascending: true })
    .limit(30);

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "No messages to evaluate" },
      { status: 404 },
    );
  }

  // outbound メッセージ（非自動）が存在しないと評価できない
  const staffMessages = messages.filter(
    (m) => m.direction === "outbound" && !m.is_auto,
  );
  if (staffMessages.length === 0) {
    return NextResponse.json(
      { error: "スタッフの返信がまだないため評価できません" },
      { status: 400 },
    );
  }

  const conversation = messages
    .map((m) => {
      const who =
        m.direction === "inbound"
          ? "顧客"
          : m.is_auto
          ? "システム自動"
          : "スタッフ";
      return `${who}: ${m.body ?? ""}`;
    })
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `以下の会話を評価してください。スタッフの返信が MAKXAS 営業思想にどれだけ沿っているかを 4 軸で評価し、JSON で返してください。\n\n${conversation}`,
        },
      ],
    });

    await logAiUsage({
      category: "auto-tag", // coaching カテゴリは未定義のため近接の auto-tag を流用
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/coaching",
      inquiryId: body.inquiry_id,
      messageId: null,
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
    const parsed = JSON.parse(jsonMatch[0]) as {
      lever2_extraction?: number;
      customer_attribute?: number;
      high_value_category?: number;
      customer_respect?: number;
      overall_score?: number;
      good_points?: string;
      improvement_points?: string;
      lever2_examples_detected?: string[];
    };

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "coaching evaluation failed" },
      { status: 500 },
    );
  }
}
