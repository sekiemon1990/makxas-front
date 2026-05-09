import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    context?: {
      subject?: string | null;
      channel?: string;
      status?: string;
      customerName?: string | null;
      storeName?: string | null;
      brandName?: string | null;
      recentMessages?: Array<{ direction: string; body: string }>;
      internalNote?: string | null;
      tags?: string[];
    };
  } | null;

  if (!body?.messages || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const ctx = body.context;
  const contextLines: string[] = [];

  if (ctx) {
    if (ctx.customerName) contextLines.push(`顧客名: ${ctx.customerName}`);
    if (ctx.subject) contextLines.push(`件名: ${ctx.subject}`);
    if (ctx.channel) contextLines.push(`チャネル: ${ctx.channel}`);
    if (ctx.status) contextLines.push(`ステータス: ${ctx.status}`);
    if (ctx.storeName) contextLines.push(`店舗: ${ctx.storeName}`);
    if (ctx.brandName) contextLines.push(`ブランド: ${ctx.brandName}`);
    if (ctx.tags && ctx.tags.length > 0)
      contextLines.push(`タグ: ${ctx.tags.join(", ")}`);
    if (ctx.internalNote)
      contextLines.push(`内部メモ: ${ctx.internalNote}`);
    if (ctx.recentMessages && ctx.recentMessages.length > 0) {
      const msgLines = ctx.recentMessages
        .map(
          (m) =>
            `${m.direction === "inbound" ? "顧客" : "担当者"}: ${m.body}`,
        )
        .join("\n");
      contextLines.push(`\n直近のメッセージ:\n${msgLines}`);
    }
  }

  const systemPrompt = `あなたは買取マクサスのインサイドセールスをサポートするAIアシスタントです。
スタッフからの質問に対して、以下の反響情報を参考に的確なアドバイスや返信案を提供してください。

${contextLines.length > 0 ? `【現在の反響情報】\n${contextLines.join("\n")}` : ""}

- 返信案を求められたら、具体的な文章を提案する
- 会話の要約を求められたら、簡潔にまとめる
- 次のアクションを聞かれたら、状況に応じた具体的な提案をする
- 日本語で回答する`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: body.messages,
    });

    const text = response.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("AI chat error", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
