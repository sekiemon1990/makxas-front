/**
 * POST /api/ai/analyze-edit
 *
 * AI提案文章と実際の送信文章の差分を分析し、
 * 編集理由ラベルを自動生成して messages.ai_edit_reason に保存する。
 *
 * ラベルは固定カテゴリではなく Claude が自由に生成するため、
 * 新しいパターンが自動的に蓄積・学習に活用される。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { logAiUsage } from "@/lib/ai/usage";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 30;

const ANALYZE_MODEL = "claude-haiku-4-5-20251001";

type AnalyzeEditBody = {
  message_id: string;
  original_body: string;
  edited_body: string;
  msg_category?: string | null;
};

type EditReasonResult = {
  label: string;    // 短いラベル (例: "口調が堅い", "情報不足", "長すぎる")
  detail: string;   // 詳細説明
  severity: "minor" | "major"; // 軽微な修正 or 大幅な修正
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as AnalyzeEditBody | null;
  if (!body?.message_id || !body.original_body || !body.edited_body) {
    return NextResponse.json({ error: "message_id, original_body, edited_body are required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const client = new Anthropic();
  const supabase = createServiceClient();

  const prompt = `あなたはAI返信品質分析の専門家です。
買取店のカスタマーサポートAIが提案した返信と、スタッフが実際に送った返信を比較して、
「なぜスタッフが修正したか」を分析してください。

カテゴリ: ${body.msg_category ?? "不明"}

【AIが提案した文章】
${body.original_body.slice(0, 500)}

【スタッフが実際に送った文章】
${body.edited_body.slice(0, 500)}

差分を分析し、以下のJSONのみ返してください（説明文・コードブロック不要）:
{"label":"修正理由を表す短いラベル（5〜15文字の日本語、自由に命名可）","detail":"具体的に何を修正したか（50文字以内）","severity":"minor または major"}

labelの例（固定ではありません、状況に合わせて自由に命名）:
- 口調が堅すぎる
- 情報が不正確
- 個人的な一言を追加
- 長すぎて読みにくい
- 丁寧さが足りない
- 商品名を具体化
- 価格表現を調整
- など、実態に合わせて自由に`;

  try {
    const response = await client.messages.create({
      model: ANALYZE_MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    // コスト追跡
    await logAiUsage({
      category: "analyze-edit",
      model: ANALYZE_MODEL,
      usage: response.usage,
      endpoint: "/api/ai/analyze-edit",
      messageId: body.message_id,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]+?\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse Claude response", raw: text }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]) as Partial<EditReasonResult>;
    const reason: EditReasonResult = {
      label: result.label ?? "不明",
      detail: result.detail ?? "",
      severity: result.severity === "major" ? "major" : "minor",
    };

    // messages テーブルに保存
    const { error: updateError } = await supabase
      .from("messages")
      .update({ ai_edit_reason: JSON.stringify(reason) })
      .eq("id", body.message_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reason });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
