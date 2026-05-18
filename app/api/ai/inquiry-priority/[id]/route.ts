/**
 * POST /api/ai/inquiry-priority/[id]
 *
 * 反響の優先度を Haiku で自動判定する。
 * 営業思想（マクサス）に沿った優先度評価:
 *   - 高: 売却動機が強い・高単価カテゴリ言及・購入余地大
 *   - 中: 通常の反響
 *   - 低: 冷やかし・関係ない問合せ・既対応済の連絡
 *
 * `?force=true` で既存判定を上書き再生成。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/requireApiAuth";
import { logAiUsage } from "@/lib/ai/usage";
import { selectModel } from "@/lib/ai/models";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `あなたはマクサス（出張買取・反響営業）の優先度判定 AI です。
営業思想の核「**追加買取（レバー2）優先**」と「**顧客属性 × ニーズ**」に基づいて
反響メッセージの優先度を判定してください。

## 優先度判定基準

### high（高優先・即対応）
- 売却動機が強い（遺品整理・引越し）
- 高単価カテゴリ（貴金属/時計/宝石/ブランド/着物）への明示的言及
- 「すぐ見て欲しい」「複数まとめて」等の緊急性
- 高所得層シグナル（高級ブランド名・高級住宅地名）

### medium（中優先・通常対応）
- 一般的な買取相談
- 中単価カテゴリ（カメラ/楽器/オーディオ）
- 動機が明確で意思が固い

### low（低優先・後回し可）
- 査定額の確認のみで売却意思が薄い
- 「ちょっと聞いてみたい」程度のニュアンス
- 5,000円以下しか期待できない少量・低単価品
- 競合他社との比較目的が明確

## 出力フォーマット（JSON のみ、説明文不要）
{
  "priority": "high|medium|low",
  "score": 0〜100の整数（high=70-100, medium=40-69, low=0-39 を目安に細粒度評価）,
  "reason": "判定根拠を 60〜120文字で。営業思想用語（売却動機/動機強さ/単価カテゴリ等）を含めること。"
}`;

type AiResult = {
  priority: "high" | "medium" | "low";
  score: number;
  reason: string;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiAuth(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const supabase = await createClient();
  const { data: inquiry, error: fetchErr } = await supabase
    .from("inquiries")
    .select(
      "id, subject, ai_priority, ai_priority_score, ai_priority_reason, ai_priority_set_at",
    )
    .eq("id", id)
    .single();

  if (fetchErr || !inquiry) {
    return NextResponse.json({ error: "inquiry not found" }, { status: 404 });
  }

  // キャッシュチェック: AI 判定済み & force=false なら既存返却
  if (!force && inquiry.ai_priority && inquiry.ai_priority_score !== null) {
    return NextResponse.json({
      inquiryId: id,
      cached: true,
      priority: inquiry.ai_priority,
      score: inquiry.ai_priority_score,
      reason: inquiry.ai_priority_reason,
      setAt: inquiry.ai_priority_set_at,
    });
  }

  // 最新メッセージ本文を取得 (反響の文脈材料)
  const { data: messages } = await supabase
    .from("messages")
    .select("body, direction, created_at")
    .eq("inquiry_id", id)
    .order("created_at", { ascending: true })
    .limit(10);

  const conversationLines = (messages ?? [])
    .filter((m) => typeof m.body === "string" && m.body.trim())
    .map((m) => `[${m.direction}] ${m.body}`)
    .join("\n");

  if (!conversationLines) {
    return NextResponse.json(
      {
        error: "no_messages",
        message: "反響メッセージが空のため AI 判定できません",
      },
      { status: 422 },
    );
  }

  const userContent = `## 反響件名
${inquiry.subject ?? "(件名なし)"}

## 会話履歴
${conversationLines.slice(0, 4000)}`;

  const anthropic = new Anthropic();
  let result: AiResult;
  try {
    const res = await anthropic.messages.create({
      model: selectModel("suggest"), // Haiku (反響系は Haiku で十分)
      max_tokens: 500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    await logAiUsage({
      category: "suggest",
      model: selectModel("suggest"),
      usage: res.usage,
      endpoint: `/api/ai/inquiry-priority/${id}`,
      inquiryId: id,
      meta: { force },
    });

    const text =
      res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
    const match = text.match(/\{[\s\S]+\}/);
    if (!match) {
      return NextResponse.json(
        { error: "parse_failed", raw: text.slice(0, 300) },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(match[0]) as Partial<AiResult>;
    const priority =
      parsed.priority === "high" || parsed.priority === "medium" || parsed.priority === "low"
        ? parsed.priority
        : "medium";
    const score =
      typeof parsed.score === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.score)))
        : 50;
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "";
    result = { priority, score, reason };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const setAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("inquiries")
    .update({
      ai_priority: result.priority,
      ai_priority_score: result.score,
      ai_priority_reason: result.reason,
      ai_priority_set_at: setAt,
    })
    .eq("id", id);

  if (updateErr) {
    // 書込失敗はログのみ、結果は返す
    console.error("[inquiry-priority] update failed:", updateErr);
  }

  return NextResponse.json({
    inquiryId: id,
    cached: false,
    priority: result.priority,
    score: result.score,
    reason: result.reason,
    setAt,
  });
}
