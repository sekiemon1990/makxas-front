/**
 * PR30: スタッフ別 AI アシスタント（パーソナライズ返信案）
 *
 * POST /api/ai/personalized-suggest
 * Body: { inquiry_id: string, staff_id: string }
 *
 * 指定スタッフの過去返信履歴を「文体サンプル」として参照し、本人らしい
 * 文体で返信案を生成する。文体・口癖・絵文字の使い方を継承。
 *
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiUsage } from "@/lib/ai/usage";
import { SALES_DOCTRINE_CORE } from "@makxas/ai-kit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001" as const;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inquiry_id?: string;
    staff_id?: string;
  } | null;
  if (!body?.inquiry_id || !body?.staff_id) {
    return NextResponse.json(
      { error: "inquiry_id and staff_id required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // スタッフ情報
  const { data: staff } = await supabase
    .from("staff")
    .select("id, name")
    .eq("id", body.staff_id)
    .maybeSingle();
  if (!staff) {
    return NextResponse.json({ error: "staff not found" }, { status: 404 });
  }

  // 当該反響の会話履歴
  const { data: messages } = await supabase
    .from("messages")
    .select("direction, body, is_auto")
    .eq("inquiry_id", body.inquiry_id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "No conversation context" },
      { status: 404 },
    );
  }

  // スタッフの過去返信サンプル（最新20件・他反響含む）
  const { data: styleSamples } = await supabase
    .from("messages")
    .select("body")
    .eq("sent_by", body.staff_id)
    .eq("direction", "outbound")
    .neq("body", "")
    .order("created_at", { ascending: false })
    .limit(20);

  const samples = (styleSamples ?? [])
    .map((m) => (m.body ?? "").trim())
    .filter((b) => b.length > 0 && b.length < 300)
    .slice(0, 12);

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

  const styleBlock =
    samples.length > 0
      ? samples.map((s, i) => `--- 例${i + 1} ---\n${s}`).join("\n")
      : "（過去サンプルなし。一般的な丁寧体で生成）";

  const systemPrompt = `${SALES_DOCTRINE_CORE}\n\nあなたは買取マクサスの営業支援AIです。
スタッフ「${staff.name ?? "本人"}」の文体を完全に模倣した返信案を作成してください。

## 文体サンプル（このスタッフの過去返信）
${styleBlock}

## ルール
- 上記サンプルの語尾・絵文字・敬語レベル・改行スタイルを忠実に再現
- 内容は会話の文脈に沿わせる
- 押し売り厳禁
- 返信文のみを出力（説明・JSON 不要）`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `以下の会話の続きとして、${staff.name ?? "本人"}らしい返信文を1本だけ作成してください。\n\n会話:\n${conversation}`,
        },
      ],
    });

    await logAiUsage({
      category: "suggest",
      model: MODEL,
      usage: response.usage,
      endpoint: "/api/ai/personalized-suggest",
      inquiryId: body.inquiry_id,
      messageId: null,
      meta: { staff_id: body.staff_id, samples_used: samples.length },
    });

    const reply =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : null;
    return NextResponse.json({
      body: reply,
      samples_used: samples.length,
      staff_name: staff.name,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "personalized-suggest failed" },
      { status: 500 },
    );
  }
}
