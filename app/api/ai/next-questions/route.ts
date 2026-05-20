/**
 * PR29: 対応漏れ予測（次の質問予測）
 *
 * POST /api/ai/next-questions
 * Body: { inquiry_id: string }
 *
 * 会話履歴から顧客が「次に聞きそうな質問」を 3 件予測する。
 * スタッフは事前に回答を準備することで対応漏れを減らせる。
 *
 * MAKXAS 思想：レバー2の切り出しに繋がる質問（追加買取・属性把握）も
 * 含めて提案する。
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiUsage } from "@/lib/ai/usage";
import { selectModel } from "@/lib/ai/models";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = selectModel("next-questions");

const SYSTEM_PROMPT = `あなたは買取マクサスのインサイドセールス支援AIです。
顧客との会話履歴から「顧客が次に聞きそうな質問」を3つ予測してください。

## 観点
- 顧客が直前に聞いた内容と関連する自然な続き
- 買取手続きの一般的な疑問（査定基準・出張可否・キャンセル料 等）
- レバー2につながる質問（他に売れるか・引き取り可能か・出張範囲）

## 出力（JSON のみ・説明不要）
{
  "questions": [
    { "q": "質問文（30文字以内）", "why": "なぜ聞きそうか（40文字以内）", "suggested_reply": "推奨回答の要点（80文字以内）" },
    ...
  ]
}`;

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
    .select("direction, body, is_auto")
    .eq("inquiry_id", body.inquiry_id)
    .order("created_at", { ascending: true })
    .limit(30);

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "No messages to analyze" },
      { status: 404 },
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
      max_tokens: 600,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `以下の会話から、顧客が次に聞きそうな質問を3つ予測してください。\n\n${conversation}`,
        },
      ],
    });

    await logAiUsage({
      category: "next-questions",
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/next-questions",
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
      questions?: { q: string; why?: string; suggested_reply?: string }[];
    };
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "next-questions failed" },
      { status: 500 },
    );
  }
}
